/* MD-Bundle Context-Aware Floating Toolbar.
 *
 * Architecture:
 * - A ViewPlugin tracks selection changes and renders a floating toolbar
 *   positioned above the selected text. The toolbar contents change based
 *   on the current context (text selected, cursor in table, on image, etc.).
 * - Context is determined from the block model (getBlocks/getBlockAt) and
 *   the current selection.
 * - Toolbar buttons dispatch commands via the CommandRegistry.
 * - The toolbar is hidden for empty lines and normal paragraphs without
 *   selection.
 *
 * Positioning mirrors the slash menu: uses view.coordsAtPos() to find the
 * cursor/selection coordinates, then absolutely positions a div relative
 * to the editor's dom node.
 */

import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import { type EditorState, type Extension } from '@codemirror/state';
import { getThemeColor } from './theme';
import { commandRegistry } from './commands';
import { getBlocks, getBlockAt } from './block-model';

// --- Toolbar context types --------------------------------------------------

/**
 * The kind of context the cursor/selection is in.
 * Determines which toolbar buttons to show.
 */
export type ToolbarContext =
  | { kind: 'empty' }
  | { kind: 'text-selected'; from: number; to: number }
  | { kind: 'table' }
  | { kind: 'image' }
  | { kind: 'link' }
  | { kind: 'code-block' }
  | { kind: 'normal' };

/**
 * A single toolbar button descriptor.
 */
export interface ToolbarButton {
  id: string;
  icon: string;
  label: string;
  commandId: string;
}

// --- Context detection ------------------------------------------------------

/**
 * Detect the current toolbar context from the editor state.
 * Returns 'empty' or 'normal' when the toolbar should be hidden.
 */
export function detectContext(state: EditorState): ToolbarContext {
  const { selection } = state;
  const { main } = selection;
  const head = main.head;
  const anchor = main.anchor;

  // Text selected (non-empty range)
  if (!main.empty) {
    return { kind: 'text-selected', from: Math.min(anchor, head), to: Math.max(anchor, head) };
  }

  // Cursor position — check what block we're in
  const blocks = getBlocks(state);
  const block = getBlockAt(head, blocks);

  if (!block) {
    return { kind: 'normal' };
  }

  // Check for inline link at cursor position
  if (isLinkAtCursor(state, block, head)) {
    return { kind: 'link' };
  }

  switch (block.type) {
    case 'table':
      return { kind: 'table' };
    case 'image':
      return { kind: 'image' };
    case 'fencedCode':
    case 'codeBlock':
      return { kind: 'code-block' };
    case 'paragraph': {
      const line = state.doc.lineAt(head);
      if (line.text.trim() === '') {
        return { kind: 'empty' };
      }
      return { kind: 'normal' };
    }
    default:
      return { kind: 'normal' };
  }
}

/**
 * Check if the cursor is positioned on an inline link within the block.
 * Looks for link syntax `[text](url)` around the cursor.
 */
function isLinkAtCursor(state: EditorState, block: { from: number; to: number }, head: number): boolean {
  const doc = state.doc.toString();
  const beforeCursor = doc.slice(block.from, head);

  // Find the nearest `[` before cursor
  const openBracket = beforeCursor.lastIndexOf('[');
  if (openBracket === -1) return false;

  // Find `](` after the `[`
  const linkStart = block.from + openBracket;
  const parenOpen = doc.indexOf('](', linkStart);
  if (parenOpen === -1 || parenOpen >= block.to) return false;

  // Find the closing `)`
  const parenClose = doc.indexOf(')', parenOpen + 2);
  if (parenClose === -1 || parenClose >= block.to) return false;

  // Cursor must be within the link range
  return head >= linkStart && head <= parenClose + 1;
}

// --- Toolbar button definitions ---------------------------------------------

/**
 * Returns the toolbar buttons for a given context.
 * Every commandId here must be registered in the command registry.
 */
export function getButtonsForContext(context: ToolbarContext): ToolbarButton[] {
  switch (context.kind) {
    case 'text-selected':
      return [
        { id: 'toolbar-bold', icon: 'B', label: '加粗', commandId: 'toggle-bold' },
        { id: 'toolbar-italic', icon: 'I', label: '斜体', commandId: 'toggle-italic' },
        { id: 'toolbar-strikethrough', icon: 'S', label: '删除线', commandId: 'toggle-strikethrough' },
        { id: 'toolbar-code', icon: '`', label: '行内代码', commandId: 'toggle-code' },
        { id: 'toolbar-link', icon: '🔗', label: '插入链接', commandId: 'toggle-link' },
      ];
    case 'code-block':
      return [{ id: 'toolbar-copy-code', icon: '📋', label: '复制代码', commandId: 'code-copy' }];
    case 'empty':
    case 'normal':
      return [];
    default:
      return [];
  }
}

// --- Toolbar DOM rendering --------------------------------------------------

interface ToolbarState {
  dom: HTMLDivElement | null;
  visible: boolean;
}

const toolbars = new WeakMap<EditorView, ToolbarState>();

function createToolbarDom(view: EditorView): HTMLDivElement {
  const dom = document.createElement('div');
  dom.className = 'mdb-toolbar';
  dom.style.position = 'absolute';
  dom.style.display = 'none';
  dom.style.zIndex = '900';
  dom.style.fontSize = '13px';
  dom.style.borderRadius = '6px';
  dom.style.padding = '4px 6px';
  dom.style.gap = '2px';
  dom.style.display = 'none';
  dom.style.alignItems = 'center';
  dom.style.background = getThemeColor('dark', 'bg-secondary');
  dom.style.border = `1px solid ${getThemeColor('dark', 'border')}`;
  dom.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
  dom.style.pointerEvents = 'auto';
  dom.style.whiteSpace = 'nowrap';

  if (view.dom.style.position === 'static' || view.dom.style.position === '') {
    view.dom.style.position = 'relative';
  }

  return dom;
}

function renderToolbar(view: EditorView, state: ToolbarState): void {
  if (!state.dom) return;

  const context = detectContext(view.state);
  const buttons = getButtonsForContext(context);

  // Clear existing content
  state.dom.textContent = '';

  if (buttons.length === 0) {
    state.dom.style.display = 'none';
    state.visible = false;
    return;
  }

  state.dom.style.display = 'flex';
  state.visible = true;

  for (const btn of buttons) {
    const button = document.createElement('button');
    button.className = 'mdb-toolbar-btn';
    button.textContent = btn.icon;
    button.title = btn.label;
    button.style.background = 'transparent';
    button.style.border = 'none';
    button.style.color = getThemeColor('dark', 'text');
    button.style.cursor = 'pointer';
    button.style.padding = '4px 8px';
    button.style.borderRadius = '4px';
    button.style.fontSize = '13px';
    button.style.lineHeight = '1';
    button.style.display = 'flex';
    button.style.alignItems = 'center';
    button.style.justifyContent = 'center';
    button.style.minWidth = '28px';
    button.style.height = '28px';

    button.addEventListener('mouseenter', () => {
      button.style.background = 'rgba(255,255,255,0.1)';
    });
    button.addEventListener('mouseleave', () => {
      button.style.background = 'transparent';
    });

    button.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      commandRegistry.execute(btn.commandId, view);
    });

    state.dom.appendChild(button);
  }

  // Position the toolbar above the selection
  positionToolbar(view, state.dom);
}

function positionToolbar(view: EditorView, dom: HTMLDivElement): void {
  try {
    const { selection } = view.state;
    const { main } = selection;
    const pos = main.empty ? main.head : Math.min(main.anchor, main.head);
    const coords = view.coordsAtPos(pos);

    if (coords) {
      const editorRect = view.dom.getBoundingClientRect();
      const left = coords.left - editorRect.left;
      const top = coords.top - editorRect.top - 36; // 36px above cursor

      // Clamp to editor bounds
      const clampedLeft = Math.max(4, Math.min(left, editorRect.width - dom.offsetWidth - 4));
      dom.style.left = `${clampedLeft}px`;
      dom.style.top = `${Math.max(4, top)}px`;
    }
  } catch {
    // jsdom / unmeasured content — leave at default position
  }
}

function showToolbar(view: EditorView): void {
  let state = toolbars.get(view);
  if (!state) {
    const dom = createToolbarDom(view);
    view.dom.appendChild(dom);
    state = { dom, visible: false };
    toolbars.set(view, state);
  }
  renderToolbar(view, state);
}

function hideToolbar(view: EditorView): void {
  const state = toolbars.get(view);
  if (state?.dom) {
    state.dom.style.display = 'none';
    state.visible = false;
  }
}

function destroyToolbar(view: EditorView): void {
  const state = toolbars.get(view);
  if (state?.dom && state.dom.parentNode) {
    state.dom.parentNode.removeChild(state.dom);
  }
  toolbars.delete(view);
}

// --- ViewPlugin --------------------------------------------------------------

/**
 * ViewPlugin that tracks selection changes and shows/hides the toolbar.
 */
const toolbarPlugin = ViewPlugin.define((view) => {
  return {
    update(u: ViewUpdate): void {
      if (u.selectionSet || u.docChanged) {
        const v = u.view;
        const context = detectContext(v.state);
        const buttons = getButtonsForContext(context);

        if (buttons.length === 0) {
          hideToolbar(v);
        } else {
          showToolbar(v);
        }
      }
    },
    destroy(): void {
      destroyToolbar(view);
    },
  };
});

/**
 * Extension that enables the context-aware floating toolbar.
 * Pass to `createMarkdownEditor` via the `extensions` option.
 */
export function contextToolbar(): Extension {
  return toolbarPlugin;
}

/**
 * Manually update the toolbar for the given view.
 * Useful for tests or external triggers.
 */
export function updateToolbar(view: EditorView): void {
  const context = detectContext(view.state);
  const buttons = getButtonsForContext(context);
  if (buttons.length === 0) {
    hideToolbar(view);
  } else {
    showToolbar(view);
  }
}

/**
 * Manually hide the toolbar for the given view.
 */
export function hideContextToolbar(view: EditorView): void {
  hideToolbar(view);
}

// Toolbar commands (toggle-bold, toggle-italic, toggle-strikethrough,
// toggle-code, toggle-link) are registered in commands.ts with Chinese
// labels and groups. The toolbar references them by id; no re-registration
// here avoids last-write-wins clobbering.
