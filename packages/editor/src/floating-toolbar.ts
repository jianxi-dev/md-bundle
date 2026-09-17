/**
 * Floating toolbar — appears immediately when text is selected.
 *
 * The toolbar shows formatting actions (bold, italic, code, link) and
 * updates its position in real-time as the selection changes. It
 * disappears immediately when the selection is cleared.
 *
 * Architecture:
 * - A ViewPlugin listens for selection changes via EditorView.updateListener.
 * - On selection change, the toolbar DOM is repositioned to the selection head.
 * - No animation or delay on first appearance — the toolbar is shown/hidden
 *   synchronously with the selection state.
 */
import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import { getThemeColor } from './theme';
import type { Command } from './commands';

export interface FloatingToolbarOptions {
  /** Commands to show in the toolbar. Defaults to a built-in set. */
  commands?: Command[];
}

const DEFAULT_TOOLBAR_COMMANDS: Command[] = [
  {
    id: 'bold',
    label: 'Bold',
    icon: 'B',
    execute(view) {
      const { from, to } = view.state.selection.main;
      const selected = view.state.doc.sliceString(from, to);
      view.dispatch({
        changes: { from, to, insert: `**${selected}**` },
        selection: { anchor: from + 2 + selected.length },
      });
    },
  },
  {
    id: 'italic',
    label: 'Italic',
    icon: 'I',
    execute(view) {
      const { from, to } = view.state.selection.main;
      const selected = view.state.doc.sliceString(from, to);
      view.dispatch({
        changes: { from, to, insert: `*${selected}*` },
        selection: { anchor: from + 1 + selected.length },
      });
    },
  },
  {
    id: 'code',
    label: 'Code',
    icon: '</>',
    execute(view) {
      const { from, to } = view.state.selection.main;
      const selected = view.state.doc.sliceString(from, to);
      view.dispatch({
        changes: { from, to, insert: `\`${selected}\`` },
        selection: { anchor: from + 1 + selected.length },
      });
    },
  },
  {
    id: 'link',
    label: 'Link',
    icon: '🔗',
    execute(view) {
      const { from, to } = view.state.selection.main;
      const selected = view.state.doc.sliceString(from, to);
      view.dispatch({
        changes: { from, to, insert: `[${selected}](url)` },
        selection: { anchor: from + selected.length + 3 },
      });
    },
  },
];

interface ToolbarState {
  dom: HTMLDivElement | null;
  visible: boolean;
}

function createToolbarDom(view: EditorView, commands: Command[]): HTMLDivElement {
  const toolbar = document.createElement('div');
  toolbar.className = 'mdb-floating-toolbar';
  toolbar.style.position = 'absolute';
  toolbar.style.background = getThemeColor('dark', 'bg-secondary');
  toolbar.style.border = `1px solid ${getThemeColor('dark', 'border')}`;
  toolbar.style.borderRadius = '6px';
  toolbar.style.padding = '4px';
  toolbar.style.display = 'flex';
  toolbar.style.gap = '2px';
  toolbar.style.zIndex = '1000';
  toolbar.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.18)';

  for (const cmd of commands) {
    const btn = document.createElement('button');
    btn.className = 'mdb-toolbar-btn';
    btn.textContent = cmd.icon ?? cmd.label;
    btn.title = cmd.label;
    btn.style.background = 'transparent';
    btn.style.border = 'none';
    btn.style.color = getThemeColor('dark', 'text');
    btn.style.padding = '4px 8px';
    btn.style.cursor = 'pointer';
    btn.style.borderRadius = '4px';
    btn.style.fontSize = '13px';
    btn.style.fontWeight = cmd.icon === 'B' ? '600' : 'normal';
    btn.style.fontStyle = cmd.icon === 'I' ? 'italic' : 'normal';
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      cmd.execute(view);
    });
    toolbar.appendChild(btn);
  }

  return toolbar;
}

function positionToolbar(view: EditorView, toolbar: HTMLDivElement): void {
  try {
    const coords = view.coordsAtPos(view.state.selection.main.head);
    if (coords) {
      toolbar.style.left = `${coords.left}px`;
      toolbar.style.top = `${coords.bottom + 4}px`;
    }
  } catch {
    // jsdom / unmeasured content — leave at 0,0
  }
}

/**
 * Creates the floating toolbar ViewPlugin.
 *
 * The toolbar appears immediately on selection, updates position in
 * real-time, and disappears immediately on selection clear.
 */
export function floatingToolbar(options: FloatingToolbarOptions = {}) {
  const commands = options.commands ?? DEFAULT_TOOLBAR_COMMANDS;

  return ViewPlugin.define((view) => {
    const state: ToolbarState = { dom: null, visible: false };

    function showToolbar(): void {
      if (!state.dom) {
        state.dom = createToolbarDom(view, commands);
        if (view.dom.style.position === 'static' || view.dom.style.position === '') {
          view.dom.style.position = 'relative';
        }
        view.dom.appendChild(state.dom);
      }
      state.dom.style.display = 'flex';
      state.visible = true;
      positionToolbar(view, state.dom);
    }

    function hideToolbar(): void {
      if (state.dom) {
        state.dom.style.display = 'none';
      }
      state.visible = false;
    }

    return {
      update(u: ViewUpdate): void {
        if (u.selectionSet) {
          const { from, to } = u.state.selection.main;
          if (from !== to) {
            // Selection is non-empty — show toolbar immediately
            if (!state.visible) {
              showToolbar();
            } else {
              // Already visible — just reposition
              if (state.dom) positionToolbar(view, state.dom);
            }
          } else {
            // Selection is empty — hide immediately
            if (state.visible) {
              hideToolbar();
            }
          }
        }
      },
      destroy(): void {
        if (state.dom?.parentNode) {
          state.dom.parentNode.removeChild(state.dom);
        }
        state.dom = null;
        state.visible = false;
      },
    };
  });
}
