/* MD-Bundle Command Palette — Cmd+K fuzzy search with pinyin support.
 *
 * Architecture:
 * - Module-level `WeakMap<EditorView, PaletteState>` holds the open palette
 *   per view, matching the slash menu pattern (slash.ts).
 * - The backdrop + panel are appended to `document.body` (NOT `view.dom`) so
 *   `position:fixed` centering is viewport-relative rather than clipped by the
 *   editor's scroll container. Both nodes are removed on close and on view
 *   destroy.
 * - Matching + recency ordering live in `command-palette-search.ts`; element
 *   factories live in `command-palette-dom.ts`. This file owns only state,
 *   rendering orchestration, and keyboard handling.
 * - The results list is a single vertical flex column (NOT a grid): every row
 *   shares one column so ↑↓ navigation is a straight line, and the keyboard
 *   shortcut sits flush right after a `flex: 1` description.
 * - Keyboard navigation: ArrowUp/Down, Enter, Escape — from the search input
 *   itself (CM6's keymap only fires when the contentDOM has focus).
 */

import { EditorView, ViewPlugin, keymap, type ViewUpdate } from '@codemirror/view';
import { Prec, type Extension } from '@codemirror/state';
import { commandRegistry } from './commands';
import { markUsed, searchCommands, type MatchEntry } from './command-palette-search';
import {
  createGroupHeader,
  createPaletteBackdrop,
  createPaletteChips,
  createPaletteEmptyState,
  createPaletteFooter,
  createPaletteRow,
} from './command-palette-dom';

// --- Palette state -------------------------------------------------------------

interface PaletteState {
  open: boolean;
  query: string;
  /** Active category chip (null = 全部). Recent section only shows when null. */
  activeGroup: string | null;
  selected: number;
  matches: MatchEntry[];
  dom: HTMLDivElement | null;
  backdrop: HTMLDivElement | null;
}

const palettes = new WeakMap<EditorView, PaletteState>();

// --- DOM rendering -------------------------------------------------------------

function renderPalette(view: EditorView, state: PaletteState): void {
  if (!state.dom) return;
  state.dom.textContent = '';

  // Header: search input + explicit close button
  const header = document.createElement('div');
  header.className = 'mdb-palette-header';
  Object.assign(header.style, {
    display: 'flex',
    alignItems: 'center',
    paddingRight: '8px',
    flex: 'none',
  });

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'mdb-palette-input';
  input.setAttribute('data-testid', 'command-palette-input');
  input.placeholder = '输入命令…（支持拼音首字母，如 jc = 加粗）';
  input.value = state.query;
  Object.assign(input.style, {
    flex: '1',
    minWidth: '0',
    padding: '8px 12px',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: 'var(--mdb-text)',
    fontSize: '14px',
    boxSizing: 'border-box',
  });
  input.addEventListener('input', () => {
    state.query = input.value;
    state.matches = searchCommands(state.query, state.activeGroup);
    state.selected = 0;
    renderPalette(view, state);
  });
  // The input owns its own key handling: CM6's keymap is only reachable while
  // the contentDOM has focus, so Escape/Arrow/Enter must be acted on here.
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      paletteSelectNext(view);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      paletteSelectPrev(view);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      paletteApply(view);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      paletteClose(view);
    }
  });
  header.appendChild(input);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'mdb-palette-close';
  closeBtn.setAttribute('data-testid', 'command-palette-close');
  closeBtn.setAttribute('aria-label', '关闭');
  closeBtn.textContent = '×';
  Object.assign(closeBtn.style, {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--mdb-text-secondary)',
    fontSize: '18px',
    lineHeight: '1',
    padding: '6px 10px',
  });
  closeBtn.addEventListener('mousedown', (e) => e.preventDefault());
  closeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    paletteClose(view);
  });
  header.appendChild(closeBtn);
  state.dom.appendChild(header);

  // Category chips narrow the result set; activeGroup persists across typing.
  state.dom.appendChild(
    createPaletteChips(state.activeGroup, (group) => {
      state.activeGroup = group;
      state.matches = searchCommands(state.query, group);
      state.selected = 0;
      renderPalette(view, state);
    }),
  );

  // Results list: a single vertical flex column grouped by `cmd.group ?? '其他'`.
  const list = document.createElement('div');
  list.className = 'mdb-palette-list';
  Object.assign(list.style, {
    flex: '1 1 auto',
    minHeight: '0',
    overflowY: 'auto',
    borderTop: `1px solid var(--mdb-border)`,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    padding: '6px 8px 8px',
  });

  if (state.matches.length === 0) {
    list.appendChild(
      createPaletteEmptyState((text) => {
        state.query = text;
        state.matches = searchCommands(text, state.activeGroup);
        state.selected = 0;
        renderPalette(view, state);
      }),
    );
  } else {
    // Recent entries are hoisted to the front by searchCommands; emit a single
    // 最近 header for that contiguous block, then normal group headers.
    let renderedHeader: string | null = null;
    state.matches.forEach((entry, i) => {
      const header = entry.inRecentSection ? '最近' : entry.group;
      if (header !== renderedHeader) {
        renderedHeader = header;
        list.appendChild(createGroupHeader(header));
      }
      list.appendChild(
        createPaletteRow(entry, i === state.selected, () => executeEntry(view, entry)),
      );
    });
  }

  state.dom.appendChild(list);

  // Footer hint bar sits below the scrollable list, always visible.
  state.dom.appendChild(createPaletteFooter());

  // Focus the input after render
  requestAnimationFrame(() => input.focus());
}

function executeEntry(view: EditorView, entry: MatchEntry): void {
  closeCommandPalette(view);
  markUsed(entry.id);
  commandRegistry.execute(entry.id, view);
}

// --- Open / Close --------------------------------------------------------------

export function openCommandPalette(view: EditorView): boolean {
  if (palettes.get(view)?.open) return false;

  const backdrop = createPaletteBackdrop(() => paletteClose(view));

  const panel = document.createElement('div');
  panel.className = 'mdb-command-palette';
  panel.setAttribute('data-testid', 'command-palette');
  Object.assign(panel.style, {
    position: 'fixed',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: '640px',
    maxWidth: 'calc(100vw - 24px)',
    maxHeight: '64vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--mdb-bg-secondary)',
    border: `1px solid var(--mdb-border)`,
    borderRadius: '14px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    zIndex: '2001',
    overflow: 'hidden',
  });

  const state: PaletteState = {
    open: true,
    query: '',
    activeGroup: null,
    selected: 0,
    matches: searchCommands(''),
    dom: panel,
    backdrop,
  };
  palettes.set(view, state);
  renderPalette(view, state);

  document.body.appendChild(backdrop);
  document.body.appendChild(panel);
  return true;
}

export function closeCommandPalette(view: EditorView): boolean {
  const state = palettes.get(view);
  if (!state?.open) return false;
  for (const node of [state.dom, state.backdrop]) node?.parentNode?.removeChild(node);
  palettes.delete(view);
  return true;
}

// --- Keyboard navigation -------------------------------------------------------

export function paletteSelectNext(view: EditorView): boolean {
  const state = palettes.get(view);
  if (!state?.open || !state.dom || state.matches.length === 0) return false;
  state.selected = Math.min(state.selected + 1, state.matches.length - 1);
  renderPalette(view, state);
  return true;
}

export function paletteSelectPrev(view: EditorView): boolean {
  const state = palettes.get(view);
  if (!state?.open || !state.dom || state.matches.length === 0) return false;
  state.selected = Math.max(state.selected - 1, 0);
  renderPalette(view, state);
  return true;
}

export function paletteApply(view: EditorView): boolean {
  const state = palettes.get(view);
  if (!state?.open || !state.dom) return false;
  const entry = state.matches[state.selected];
  if (!entry) return false;
  executeEntry(view, entry);
  return true;
}

export function paletteClose(view: EditorView): boolean {
  return closeCommandPalette(view);
}

// --- ViewPlugin: close on doc change / destroy ---------------------------------

const paletteCloserPlugin = ViewPlugin.define((view) => ({
  update(u: ViewUpdate): void {
    if (u.docChanged && palettes.get(u.view)?.open) {
      closeCommandPalette(u.view);
    }
  },
  destroy(): void {
    closeCommandPalette(view);
  },
}));

// --- Keymap: Cmd+K to open, arrows + Enter + Escape when open -----------------

/**
 * Command palette keymap extension. Binds Cmd+K/Ctrl+K to open the palette,
 * and ArrowUp/Down/Enter/Escape to navigate/apply/close when open.
 */
export function commandPaletteKeymap(): Extension {
  return [
    Prec.high(
      keymap.of([
        {
          key: 'Mod-k',
          run: (view) => {
            const state = palettes.get(view);
            if (state?.open) {
              closeCommandPalette(view);
              return true;
            }
            return openCommandPalette(view);
          },
        },
        { key: 'ArrowDown', run: (view) => paletteSelectNext(view) },
        { key: 'ArrowUp', run: (view) => paletteSelectPrev(view) },
        { key: 'Enter', run: (view) => paletteApply(view) },
        { key: 'Escape', run: (view) => paletteClose(view) },
      ]),
    ),
    paletteCloserPlugin,
  ];
}
