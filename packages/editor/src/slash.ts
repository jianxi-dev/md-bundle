/* MD-Bundle Slash Commands — `/` command menu for CodeMirror 6.
 *
 * Architecture:
 * - Module-level `WeakMap<EditorView, SlashMenuState>` holds the open-menu state
 *   per view, so tests can drive the menu by calling the exported functions
 *   directly with a view (no DOM event simulation needed).
 * - Exported keymap `run` targets double as testable command functions.
 * - `slashKeymap()` returns `Prec.high(...)` so its Enter/Arrow/Escape/`/`
 *   bindings beat `defaultKeymap` when the consumer wires it AFTER
 *   `defaultKeymap` in the editor's extension list.
 * - Every binding returns false when the menu is closed, so default CM6
 *   behavior (newline, cursor motion, inserting the slash) is untouched.
 */

import { EditorView, ViewPlugin, keymap, type ViewUpdate } from '@codemirror/view';
import { Prec, type EditorState, type Extension } from '@codemirror/state';
import { getThemeColor } from './theme';

export interface SlashCommand {
  id: string;
  label: string;
  hint?: string;
  icon?: string;
  /**
   * Returns the change that replaces the `/` (the character immediately to the
   * left of the cursor) with the template text. Called with the state where
   * the `/` is still in the document and the cursor sits right after it, so
   * `head - 1` is the slash position.
   */
  insert(state: EditorState): { from: number; to: number; text: string };
}

export const defaultCommands: SlashCommand[] = [
  {
    id: 'heading',
    label: 'Heading',
    hint: '## ',
    icon: '#',
    insert(state) {
      const head = state.selection.main.head;
      return { from: head - 1, to: head, text: '## ' };
    },
  },
  {
    id: 'callout',
    label: 'Callout',
    hint: '> [!NOTE]',
    icon: '\u275D',
    insert(state) {
      const head = state.selection.main.head;
      // Standard blockquote callout — no private syntax.
      return { from: head - 1, to: head, text: '> [!NOTE]\n> ' };
    },
  },
  {
    id: 'image-ref',
    label: 'Image ref',
    hint: '![](...)',
    icon: '\u25A3',
    insert(state) {
      const head = state.selection.main.head;
      return {
        from: head - 1,
        to: head,
        text: '![](https://example.com/image.png)',
      };
    },
  },
  {
    id: 'code-block',
    label: 'Code block',
    hint: '```',
    icon: '{ }',
    insert(state) {
      const head = state.selection.main.head;
      return { from: head - 1, to: head, text: '```\n\n```' };
    },
  },
  {
    id: 'table',
    label: 'Table',
    hint: '| a | b |',
    icon: '\u25A6',
    insert(state) {
      const head = state.selection.main.head;
      return {
        from: head - 1,
        to: head,
        text: '| A | B |\n| --- | --- |\n| 1 | 2 |',
      };
    },
  },
  {
    id: 'quote',
    label: 'Quote',
    hint: '> ',
    icon: '\u00BB',
    insert(state) {
      const head = state.selection.main.head;
      return { from: head - 1, to: head, text: '> ' };
    },
  },
];

interface SlashMenuState {
  open: boolean;
  slashPos: number;
  selected: number;
  commands: SlashCommand[];
  dom: HTMLDivElement | null;
}

const menus = new WeakMap<EditorView, SlashMenuState>();

/** Closes the menu for `view` without touching the document. */
function closeMenu(view: EditorView): void {
  const state = menus.get(view);
  if (!state) return;
  if (state.dom && state.dom.parentNode) {
    state.dom.parentNode.removeChild(state.dom);
  }
  menus.delete(view);
}

function renderMenu(view: EditorView, state: SlashMenuState): void {
  if (!state.dom) return;
  state.dom.textContent = '';
  state.commands.forEach((cmd, i) => {
    const row = document.createElement('div');
    row.className = 'mdb-slash-item';
    row.style.padding = '6px 12px';
    row.style.cursor = 'pointer';
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '8px';
    if (i === state.selected) {
      row.setAttribute('data-selected', 'true');
      row.style.background = 'rgb(22,93,255,0.18)';
      row.style.fontWeight = '600';
    }

    const icon = document.createElement('span');
    icon.textContent = cmd.icon ?? '';
    icon.style.width = '18px';
    icon.style.color = getThemeColor('dark', 'primary');
    row.appendChild(icon);

    const label = document.createElement('span');
    label.textContent = cmd.label;
    row.appendChild(label);

    if (cmd.hint) {
      const hint = document.createElement('span');
      hint.textContent = cmd.hint;
      hint.style.marginLeft = 'auto';
      hint.style.color = getThemeColor('dark', 'text-secondary');
      hint.style.fontSize = '11px';
      hint.style.opacity = '0.8';
      row.appendChild(hint);
    }

    row.addEventListener('mousedown', (e) => {
      e.preventDefault();
      state.selected = i;
      applyCommand(view, cmd);
    });

    state.dom!.appendChild(row);
  });
}

function openMenu(
  view: EditorView,
  slashPos: number,
  commands: SlashCommand[],
): void {
  const menu = document.createElement('div');
  menu.className = 'mdb-slash-menu';
  menu.setAttribute('data-theme', 'dark');
  menu.style.position = 'absolute';
  menu.style.background = getThemeColor('dark', 'bg-secondary');
  menu.style.border = `1px solid ${getThemeColor('dark', 'border')}`;
  menu.style.color = getThemeColor('dark', 'text');
  menu.style.zIndex = '1000';
  menu.style.fontSize = '13px';
  menu.style.borderRadius = '6px';
  menu.style.minWidth = '160px';
  menu.style.padding = '4px 0';
  menu.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.24)';

  const state: SlashMenuState = {
    open: true,
    slashPos,
    selected: 0,
    commands,
    dom: menu,
  };
  menus.set(view, state);
  renderMenu(view, state);

  // Position near the cursor; jsdom has no layout, so a failure leaves 0,0.
  try {
    const coords = view.coordsAtPos(slashPos + 1);
    if (coords) {
      menu.style.left = `${coords.left}px`;
      menu.style.top = `${coords.bottom + 4}px`;
    }
  } catch {
    // ignore — jsdom / unmeasured content
  }

  if (view.dom.style.position === 'static' || view.dom.style.position === '') {
    view.dom.style.position = 'relative';
  }
  view.dom.appendChild(menu);
}

function applyCommand(view: EditorView, cmd: SlashCommand): void {
  // Close FIRST so the docChanged closer in the ViewPlugin never fights the
  // transaction we are about to dispatch.
  closeMenu(view);
  const change = cmd.insert(view.state);
  // `text` is our interface field; CM6's ChangeSpec field is `insert`.
  view.dispatch({
    changes: { from: change.from, to: change.to, insert: change.text },
    selection: { anchor: change.from + change.text.length },
    scrollIntoView: true,
  });
}

/**
 * Handles typing `/`. Opens the command menu at the cursor. If a menu is
 * already open (a second consecutive `/`), closes it and returns false so the
 * keymap falls through to default behavior — no duplicate menu, no
 * double-insert.
 */
export function insertSlashChar(
  view: EditorView,
  commands: SlashCommand[] = defaultCommands,
): boolean {
  const current = menus.get(view);
  if (current?.open) {
    closeMenu(view);
    return false;
  }
  const head = view.state.selection.main.head;
  view.dispatch({
    changes: { from: head, insert: '/' },
    selection: { anchor: head + 1 },
  });
  // Open AFTER the dispatch so the ViewPlugin docChanged closer (if any)
  // doesn't immediately close it.
  openMenu(view, head, commands);
  return true;
}

/** ArrowDown: move the selected row down while the menu is open. */
export function slashMenuSelectNext(view: EditorView): boolean {
  const state = menus.get(view);
  if (!state?.open || !state.dom) return false;
  state.selected = Math.min(state.selected + 1, state.commands.length - 1);
  renderMenu(view, state);
  return true;
}

/** ArrowUp: move the selected row up while the menu is open. */
export function slashMenuSelectPrev(view: EditorView): boolean {
  const state = menus.get(view);
  if (!state?.open || !state.dom) return false;
  state.selected = Math.max(state.selected - 1, 0);
  renderMenu(view, state);
  return true;
}

/** Enter: apply the selected command (replaces the `/` with the template). */
export function slashMenuApply(view: EditorView): boolean {
  const state = menus.get(view);
  if (!state?.open || !state.dom) return false;
  const cmd = state.commands[state.selected];
  if (!cmd) return false;
  applyCommand(view, cmd);
  return true;
}

/** Escape: close the menu without inserting anything (the `/` remains). */
export function slashMenuClose(view: EditorView): boolean {
  const state = menus.get(view);
  if (!state?.open) return false;
  closeMenu(view);
  return true;
}

/** Closes the menu whenever the document changes (e.g. typing a character). */
const menuCloserPlugin = ViewPlugin.define((view) => ({
  update(u: ViewUpdate): void {
    if (u.docChanged && menus.get(u.view)?.open) {
      closeMenu(u.view);
    }
  },
  destroy(): void {
    closeMenu(view);
  },
}));

/**
 * Keymap extension wiring the slash menu. Returns `Prec.high(...)` so its
 * bindings beat `defaultKeymap`; every binding returns false when the menu is
 * closed, preserving default CodeMirror behavior.
 */
export function slashKeymap(options: { commands?: SlashCommand[] } = {}): Extension {
  const commands = options.commands ?? defaultCommands;
  return [
    Prec.high(
      keymap.of([
        {
          key: '/',
          scope: 'typing',
          run: (view) => insertSlashChar(view, commands),
        },
        { key: 'ArrowDown', run: (view) => slashMenuSelectNext(view) },
        { key: 'ArrowUp', run: (view) => slashMenuSelectPrev(view) },
        { key: 'Enter', run: (view) => slashMenuApply(view) },
        { key: 'Escape', run: (view) => slashMenuClose(view) },
      ]),
    ),
    menuCloserPlugin,
  ];
}
