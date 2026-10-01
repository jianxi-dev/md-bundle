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
 * - The menu renders from `defaultCommands` directly (`applyCommand` calls
 *   `cmd.insert`); it does NOT register into the shared commandRegistry.
 *   Registering would duplicate palette rows and shadow the canonical
 *   cursor-insert `insert-html` / `insert-css` commands from commands.ts.
 */

import { EditorView, ViewPlugin, keymap, type ViewUpdate } from '@codemirror/view';
import { Prec, type EditorState, type Extension } from '@codemirror/state';

export interface SlashCommand {
  id: string;
  label: string;
  hint?: string;
  icon?: string;
  /** Group heading this row is shown under (root level only). */
  group?: string;
  /** When present, activating the row opens this second-level panel of rows. */
  children?: SlashCommand[];
  /** When present, activating the row opens a rows×cols grid picker instead. */
  grid?: { rows: number; cols: number };
  /**
   * Returns the change that replaces the `/` (the character immediately to the
   * left of the cursor) with the template text. Called with the state where
   * the `/` is still in the document and the cursor sits right after it, so
   * `head - 1` is the slash position. Leaf rows only; submenu openers omit it.
   */
  insert?(state: EditorState): { from: number; to: number; text: string };
}

function headingLevel(level: 1 | 2 | 3 | 4 | 5 | 6): SlashCommand {
  const prefix = `${'#'.repeat(level)} `;
  return {
    id: `heading-${level}`,
    label: `${level} 级标题`,
    hint: prefix.trimEnd(),
    icon: `H${level}`,
    insert(state) {
      const head = state.selection.main.head;
      return { from: head - 1, to: head, text: prefix };
    },
  };
}

export const defaultCommands: SlashCommand[] = [
  {
    id: 'heading',
    label: '标题',
    hint: 'H1–H6',
    icon: '#',
    group: '基础',
    children: ([1, 2, 3, 4, 5, 6] as const).map(headingLevel),
  },
  {
    id: 'quote',
    label: '引用',
    hint: '> ',
    icon: '\u00BB',
    group: '基础',
    insert(state) {
      const head = state.selection.main.head;
      return { from: head - 1, to: head, text: '> ' };
    },
  },
  {
    id: 'code-block',
    label: '代码块',
    hint: '```',
    icon: '{ }',
    group: '基础',
    insert(state) {
      const head = state.selection.main.head;
      return { from: head - 1, to: head, text: '```\n\n```' };
    },
  },
  {
    id: 'table',
    label: '表格',
    hint: 'N × M',
    icon: '\u25A6',
    group: '常用',
    grid: { rows: 10, cols: 10 },
  },
  {
    id: 'callout',
    label: '标注',
    hint: '> [!NOTE]',
    icon: '\u275D',
    group: '常用',
    insert(state) {
      const head = state.selection.main.head;
      return { from: head - 1, to: head, text: '> [!NOTE]\n> ' };
    },
  },
  {
    id: 'image-ref',
    label: '图片引用',
    hint: '![](...)',
    icon: '\u25A3',
    group: '常用',
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
    id: 'insert-html',
    label: '插入 HTML',
    hint: '<div>',
    icon: '</>',
    group: '小组件',
    insert(state) {
      const head = state.selection.main.head;
      return { from: head - 1, to: head, text: '<div align="center">\n\n</div>' };
    },
  },
  {
    id: 'insert-css',
    label: '插入 CSS',
    hint: '<style>',
    icon: '#',
    group: '小组件',
    insert(state) {
      const head = state.selection.main.head;
      return { from: head - 1, to: head, text: '<style>\n\n</style>' };
    },
  },
];

/** Active grid picker: bounds plus the hovered cell that will be inserted. */
interface GridState {
  rows: number;
  cols: number;
  hoverR: number;
  hoverC: number;
}

interface SlashMenuState {
  open: boolean;
  slashPos: number;
  selected: number;
  /** Root rows (may include submenu openers). */
  commands: SlashCommand[];
  /** Rows currently displayed (root, or the open submenu's children). */
  rows: SlashCommand[];
  /** The opener whose children are displayed, or null at root. */
  submenuParent: SlashCommand | null;
  /** Active grid picker, or null when a row list is displayed. */
  grid: GridState | null;
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
  if (state.grid) {
    renderGrid(view, state);
    return;
  }
  state.dom.textContent = '';
  let lastGroup: string | undefined;
  state.rows.forEach((cmd, i) => {
    if (!state.submenuParent && cmd.group && cmd.group !== lastGroup) {
      const header = document.createElement('div');
      header.className = 'mdb-slash-group';
      header.textContent = cmd.group;
      header.style.padding = '6px 12px 2px';
      header.style.fontSize = '11px';
      header.style.color = 'var(--mdb-text-secondary)';
      header.style.opacity = '0.8';
      state.dom!.appendChild(header);
      lastGroup = cmd.group;
    }

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
    icon.style.color = 'var(--mdb-primary)';
    row.appendChild(icon);

    const label = document.createElement('span');
    label.textContent = cmd.label;
    row.appendChild(label);

    const hint = document.createElement('span');
    hint.style.marginLeft = 'auto';
    hint.style.color = 'var(--mdb-text-secondary)';
    hint.style.fontSize = '11px';
    hint.style.opacity = '0.8';
    hint.textContent = cmd.children ? '\u25B8' : (cmd.hint ?? '');
    row.appendChild(hint);

    row.addEventListener('mousedown', (e) => {
      e.preventDefault();
      state.selected = i;
      activateRow(view, cmd);
    });

    state.dom!.appendChild(row);
  });
}

/** Build a GFM pipe table with `cols` columns and `rows` body rows. */
function buildTable(cols: number, rows: number): string {
  const header = `| ${Array.from({ length: cols }, (_, c) => String.fromCharCode(65 + c)).join(' | ')} |`;
  const separator = `| ${Array.from({ length: cols }, () => '---').join(' | ')} |`;
  const body = Array.from({ length: rows }, (_, r) =>
    `| ${Array.from({ length: cols }, (_, c) => String(r * cols + c + 1)).join(' | ')} |`,
  ).join('\n');
  return `${header}\n${separator}\n${body}`;
}

/** Open the grid picker for a command carrying a `grid` spec. */
function openGrid(view: EditorView, cmd: SlashCommand): void {
  const state = menus.get(view);
  if (!state?.open || !state.dom || !cmd.grid) return;
  state.submenuParent = cmd;
  state.rows = [];
  state.grid = { rows: cmd.grid.rows, cols: cmd.grid.cols, hoverR: 1, hoverC: 1 };
  renderMenu(view, state);
}

/** Insert the hovered table size and close the menu. */
function applyGrid(view: EditorView, r: number, c: number): void {
  const state = menus.get(view);
  if (!state?.open) return;
  const slashPos = state.slashPos;
  closeMenu(view);
  const text = buildTable(c, r);
  view.dispatch({
    changes: { from: slashPos, to: slashPos + 1, insert: text },
    selection: { anchor: slashPos + text.length },
    scrollIntoView: true,
  });
}

/** Render the rows×cols grid picker with an N × M readout and hover preview. */
function renderGrid(view: EditorView, state: SlashMenuState): void {
  if (!state.dom || !state.grid) return;
  const grid = state.grid;
  state.dom.textContent = '';

  const label = document.createElement('div');
  label.className = 'mdb-slash-grid-label';
  label.textContent = `${grid.hoverR} \u00d7 ${grid.hoverC}`;
  label.style.padding = '4px 10px';
  label.style.fontSize = '11px';
  label.style.color = 'var(--mdb-text-secondary)';
  state.dom.appendChild(label);

  const wrap = document.createElement('div');
  wrap.className = 'mdb-slash-grid';
  wrap.style.display = 'grid';
  wrap.style.gridTemplateColumns = `repeat(${grid.cols}, 18px)`;
  wrap.style.gap = '2px';
  wrap.style.padding = '4px 10px 8px';

  const paint = (r: number, c: number): void => {
    for (const el of Array.from(wrap.children) as HTMLElement[]) {
      const on = Number(el.dataset.r) <= r && Number(el.dataset.c) <= c;
      el.style.background = on ? 'rgb(22,93,255,0.55)' : 'var(--mdb-surface)';
    }
  };

  for (let r = 1; r <= grid.rows; r++) {
    for (let c = 1; c <= grid.cols; c++) {
      const cell = document.createElement('div');
      cell.className = 'mdb-slash-grid-cell';
      cell.dataset.r = String(r);
      cell.dataset.c = String(c);
      cell.style.width = '18px';
      cell.style.height = '18px';
      cell.style.borderRadius = '3px';
      cell.style.border = '1px solid var(--mdb-border)';
      cell.style.background = r <= 1 && c <= 1 ? 'rgb(22,93,255,0.55)' : 'var(--mdb-surface)';
      cell.addEventListener('mouseenter', () => {
        grid.hoverR = r;
        grid.hoverC = c;
        label.textContent = `${r} \u00d7 ${c}`;
        paint(r, c);
      });
      cell.addEventListener('mousedown', (e) => {
        e.preventDefault();
        applyGrid(view, r, c);
      });
      wrap.appendChild(cell);
    }
  }
  state.dom.appendChild(wrap);
}

function openMenu(
  view: EditorView,
  slashPos: number,
  commands: SlashCommand[],
): void {
  const menu = document.createElement('div');
  menu.className = 'mdb-slash-menu';
  menu.style.position = 'absolute';
  menu.style.background = 'var(--mdb-bg-secondary)';
  menu.style.border = `1px solid var(--mdb-border)`;
  menu.style.color = 'var(--mdb-text)';
  menu.style.zIndex = '1000';
  menu.style.fontSize = '13px';
  menu.style.borderRadius = '6px';
  menu.style.minWidth = '160px';
  menu.style.padding = '4px 0';
  menu.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.24)';

  menu.style.overflowY = 'auto';

  const state: SlashMenuState = {
    open: true,
    slashPos,
    selected: 0,
    commands,
    rows: commands,
    submenuParent: null,
    grid: null,
    dom: menu,
  };
  menus.set(view, state);
  renderMenu(view, state);

  if (view.dom.style.position === 'static' || view.dom.style.position === '') {
    view.dom.style.position = 'relative';
  }
  view.dom.appendChild(menu);
  positionMenu(view, menu, slashPos);
}

/**
 * Place the menu at the cursor, clamping its right/bottom edges into the
 * viewport and capping its height so long or second-level menus scroll instead
 * of overflowing (#250). coordsAtPos is viewport-relative but the menu is a
 * child of view.dom, so the editor origin is subtracted (issue #203). jsdom has
 * no layout; the try/catch leaves the menu at 0,0 there.
 */
function positionMenu(view: EditorView, menu: HTMLDivElement, slashPos: number): void {
  try {
    const coords = view.coordsAtPos(slashPos + 1);
    if (!coords) return;
    const rect = view.dom.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    let leftV = coords.left;
    let topV = coords.bottom + 4;
    if (leftV + menuRect.width > viewportW - 8) {
      leftV = Math.max(8, viewportW - 8 - menuRect.width);
    }
    if (topV + menuRect.height > viewportH - 8) {
      topV = Math.max(8, viewportH - 8 - menuRect.height);
    }

    menu.style.left = `${leftV - rect.left}px`;
    menu.style.top = `${topV - rect.top}px`;
    menu.style.maxHeight = `${Math.max(120, viewportH - 8 - topV)}px`;
  } catch {
    // ignore — jsdom / unmeasured content
  }
}

function applyCommand(view: EditorView, cmd: SlashCommand): void {
  if (!cmd.insert) return;
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

/** Activate a row: open its submenu, or apply its insert. */
function activateRow(view: EditorView, cmd: SlashCommand): void {
  if (cmd.grid) {
    openGrid(view, cmd);
    return;
  }
  if (cmd.children && cmd.children.length > 0) {
    enterSubmenu(view, cmd);
    return;
  }
  applyCommand(view, cmd);
}

/** Show a row's second-level panel of children. */
function enterSubmenu(view: EditorView, cmd: SlashCommand): void {
  const state = menus.get(view);
  if (!state?.open || !state.dom || !cmd.children?.length) return;
  state.submenuParent = cmd;
  state.rows = cmd.children;
  state.selected = 0;
  renderMenu(view, state);
}

/** Return from a submenu to the root row list. */
function backToRoot(view: EditorView): void {
  const state = menus.get(view);
  if (!state?.open || !state.dom || !state.submenuParent) return;
  state.submenuParent = null;
  state.grid = null;
  state.rows = state.commands;
  state.selected = 0;
  renderMenu(view, state);
}

/**
 * Module-level IME composition guard. Set by the ViewPlugin's eventHandlers
 * in slashKeymap, read by insertSlashChar to skip during active composition.
 */
let slashComposing = false;

/**
 * Handles typing `/`. Opens the command menu at the cursor. If a menu is
 * already open (a second consecutive `/`), closes it and returns false so the
 * keymap falls through to default behavior — no duplicate menu, no
 * double-insert.
 *
 * Only triggers when:
 * - The `/` is ASCII (U+002F), not full-width `／` (U+FF0F).
 * - The cursor is at word start (nothing before it on the line, or the
 *   character immediately before it is whitespace).
 * - IME is not actively composing.
 */
export function insertSlashChar(
  view: EditorView,
  commands: SlashCommand[] = defaultCommands,
): boolean {
  if (slashComposing) return false;

  const current = menus.get(view);
  if (current?.open) {
    closeMenu(view);
    return false;
  }

  const head = view.state.selection.main.head;
  const line = view.state.doc.lineAt(head);
  const textBeforeCursor = line.text.slice(0, head - line.from);

  // Trigger at word start: the text from line start to caret must be empty
  // or end with whitespace. Typing "/" immediately after a non-whitespace
  // character (mid-word) must NOT open the menu.
  if (textBeforeCursor.length > 0 && !/\s$/.test(textBeforeCursor)) return false;

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
  state.selected = Math.min(state.selected + 1, state.rows.length - 1);
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

/**
 * Enter: activate the selected row — open its submenu, or replace the `/` with
 * the template for a leaf row.
 */
export function slashMenuApply(view: EditorView): boolean {
  const state = menus.get(view);
  if (!state?.open || !state.dom) return false;
  const cmd = state.rows[state.selected];
  if (!cmd) return false;
  activateRow(view, cmd);
  return true;
}

/** ArrowRight: open the selected row's submenu when it has children. */
export function slashMenuSubmenuEnter(view: EditorView): boolean {
  const state = menus.get(view);
  if (!state?.open || !state.dom) return false;
  const cmd = state.rows[state.selected];
  if (cmd?.grid) {
    openGrid(view, cmd);
    return true;
  }
  if (!cmd?.children?.length) return false;
  enterSubmenu(view, cmd);
  return true;
}

/** ArrowLeft: leave an open submenu and return to the root rows. */
export function slashMenuSubmenuBack(view: EditorView): boolean {
  const state = menus.get(view);
  if (!state?.open || !state.dom || !state.submenuParent) return false;
  backToRoot(view);
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
 * Tracks IME composition state for the slash menu. Sets slashComposing so
 * insertSlashChar can skip during active composition (avoids full-width /
 * triggering the menu).
 */
const slashCompositionGuard = ViewPlugin.define(() => ({}), {
  eventHandlers: {
    compositionstart() {
      slashComposing = true;
    },
    compositionend() {
      slashComposing = false;
    },
  },
});

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
          // No `scope` — CM6's default keydown handler only runs the "editor"
          // scope; a custom scope (e.g. "typing") would make this binding
          // unreachable. Default scope fires whenever the editor is focused.
          run: (view) => insertSlashChar(view, commands),
        },
        { key: 'ArrowDown', run: (view) => slashMenuSelectNext(view) },
        { key: 'ArrowUp', run: (view) => slashMenuSelectPrev(view) },
        { key: 'ArrowRight', run: (view) => slashMenuSubmenuEnter(view) },
        { key: 'ArrowLeft', run: (view) => slashMenuSubmenuBack(view) },
        { key: 'Enter', run: (view) => slashMenuApply(view) },
        { key: 'Escape', run: (view) => slashMenuClose(view) },
      ]),
    ),
    menuCloserPlugin,
    slashCompositionGuard,
  ];
}
