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
 * - Keyboard navigation: ArrowUp/Down, Enter, Escape — from the search input
 *   itself (CM6's keymap only fires when the contentDOM has focus).
 */

import { EditorView, ViewPlugin, keymap, type ViewUpdate } from '@codemirror/view';
import { Prec, type Extension } from '@codemirror/state';
import { getThemeColor } from './theme';
import { commandRegistry } from './commands';
import { markUsed, searchCommands, type MatchEntry } from './command-palette-search';
import {
  createGroupHeader,
  createPaletteBackdrop,
  createPaletteRow,
} from './command-palette-dom';

// --- Palette state -------------------------------------------------------------

interface PaletteState {
  open: boolean;
  query: string;
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
    color: getThemeColor('dark', 'text'),
    fontSize: '14px',
    boxSizing: 'border-box',
  });
  input.addEventListener('input', () => {
    state.query = input.value;
    state.matches = searchCommands(state.query);
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
    color: getThemeColor('dark', 'text-secondary'),
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

  // Results list, grouped by `cmd.group ?? '其他'`
  const list = document.createElement('div');
  list.className = 'mdb-palette-list';
  Object.assign(list.style, {
    maxHeight: '300px',
    overflowY: 'auto',
    borderTop: `1px solid ${getThemeColor('dark', 'border')}`,
  });

  if (state.matches.length === 0) {
    const empty = document.createElement('div');
    empty.textContent = '未找到匹配命令';
    Object.assign(empty.style, {
      padding: '12px',
      color: getThemeColor('dark', 'text-secondary'),
      fontSize: '13px',
      textAlign: 'center',
    });
    list.appendChild(empty);
  }

  let renderedGroup: string | null = null;
  state.matches.forEach((entry, i) => {
    if (entry.group !== renderedGroup) {
      renderedGroup = entry.group;
      list.appendChild(createGroupHeader(entry.group));
    }
    list.appendChild(createPaletteRow(entry, i === state.selected, () => executeEntry(view, entry)));
  });

  state.dom.appendChild(list);

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
  panel.setAttribute('data-theme', 'dark');
  Object.assign(panel.style, {
    position: 'fixed',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: '360px',
    maxWidth: 'calc(100vw - 24px)',
    background: getThemeColor('dark', 'bg-secondary'),
    border: `1px solid ${getThemeColor('dark', 'border')}`,
    borderRadius: '8px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    zIndex: '2001',
    overflow: 'hidden',
  });

  const state: PaletteState = {
    open: true,
    query: '',
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
