/* MD-Bundle Slash Commands — `/` command menu for CodeMirror 6.
 *
 * Architecture:
 * - Module-level `WeakMap<EditorView, SlashMenuState>` holds the open-menu state
 *   per view, so tests can drive the menu by calling the exported functions
 *   directly with a view (no DOM event simulation needed).
 * - Root rows render as an icon grid; a row with children opens a flyout panel
 *   beside its cell (the root grid stays visible) instead of replacing the
 *   root list in place. The table size picker keeps its own grid panel.
 * - Typing after the `/` filters the root grid. The typed characters are real
 *   document text: `readQuery` derives the filter from `[slashPos + 1, head]`
 *   on every doc change, so filtering never fights the doc-change closer and
 *   every apply replaces the whole `/query` range.
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
import { calloutTypeMap } from '@md-bundle/renderer';

export interface SlashCommand {
  id: string;
  label: string;
  hint?: string;
  icon?: string;
  /** Single-key code typed after `/` (e.g. `r` task, `t` table, `q` quote). */
  code?: string;
  /** Extra codes that resolve to this command (e.g. `w` for the bullet list). */
  aliases?: readonly string[];
  /** Group heading this row is shown under (root level only). */
  group?: string;
  /** When present, activating the row opens this second-level panel of rows. */
  children?: SlashCommand[];
  /** When present, activating the row opens a rows×cols grid picker instead. */
  grid?: { rows: number; cols: number };
  /**
   * Returns the change whose `text` replaces the menu range with the template
   * text. Called with the state where the `/` (and any typed filter) is still
   * in the document. `applyCommand` replaces `[slashPos, head]` itself, so the
   * returned `from`/`to` are advisory (they locate the slash for the
   * no-query case). Leaf rows only; submenu openers omit it.
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
    code: String(level),
    insert(state) {
      const head = state.selection.main.head;
      return { from: head - 1, to: head, text: prefix };
    },
  };
}

const CALLOUT_TYPES = [
  'note',
  'info',
  'tip',
  'success',
  'warning',
  'danger',
  'error',
  'question',
] as const;

const CALLOUT_CODES: Record<string, string> = {
  note: 'nn',
  info: 'ni',
  tip: 'nt',
  success: 'ns',
  warning: 'nw',
  danger: 'nd',
  error: 'ne',
  question: 'nq',
};

function calloutType(type: string): SlashCommand {
  const marker = type.toUpperCase();
  return {
    id: `callout-${type}`,
    label: calloutTypeMap[type]?.label ?? type,
    hint: `> [!${marker}]`,
    icon: '\u275D',
    code: CALLOUT_CODES[type],
    insert(state) {
      const head = state.selection.main.head;
      return { from: head - 1, to: head, text: `> [!${marker}]\n> ` };
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
    code: 'q',
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
    code: 'c',
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
    code: 't',
    group: '常用',
    grid: { rows: 10, cols: 10 },
  },
  {
    id: 'callout',
    label: '标注',
    hint: '> [!NOTE]',
    icon: '\u275D',
    code: 'n',
    group: '常用',
    children: CALLOUT_TYPES.map(calloutType),
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
    code: 'p',
    aliases: ['img'],
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
    code: 'm',
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
    aliases: ['css'],
    group: '小组件',
    insert(state) {
      const head = state.selection.main.head;
      return { from: head - 1, to: head, text: '<style>\n\n</style>' };
    },
  },
  {
    id: 'task',
    label: '任务',
    hint: '- [ ]',
    icon: '\u2610',
    code: 'r',
    group: '常用',
    insert(state) {
      const head = state.selection.main.head;
      return { from: head - 1, to: head, text: '- [ ] ' };
    },
  },
  {
    id: 'divider',
    label: '分割线',
    hint: '---',
    icon: '\u2014',
    code: 'd',
    group: '基础',
    insert(state) {
      const head = state.selection.main.head;
      return { from: head - 1, to: head, text: '---' };
    },
  },
];

/**
 * Pinyin initials for the CJK characters used by the root labels. Kept local
 * (the palette matcher is not exported) and intentionally small — extend when
 * root commands grow more labels.
 */
const PINYIN_INITIALS: Record<string, string> = {
  标: 'b',
  题: 't',
  引: 'y',
  用: 'y',
  代: 'd',
  码: 'm',
  块: 'k',
  表: 'b',
  格: 'g',
  注: 'z',
  图: 't',
  片: 'p',
  插: 'c',
  入: 'r',
};

/** Case-insensitive subsequence test: are all `query` chars in `text`, in order? */
function isSubsequence(query: string, text: string): boolean {
  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < lowerText.length && qi < lowerQuery.length; ti++) {
    if (lowerText[ti] === lowerQuery[qi]) qi++;
  }
  return qi === lowerQuery.length;
}

/** Pinyin first letters for a label; non-CJK characters keep their lowercase form. */
function pinyinInitials(text: string): string {
  return [...text].map((ch) => PINYIN_INITIALS[ch] ?? ch.toLowerCase()).join('');
}

/**
 * Root rows matching the typed filter, original order preserved. Matches the
 * label directly (ASCII case-insensitive subsequence) or through pinyin
 * initials, so `bt` finds 「标题」. Single-key codes (#280) slot in before this.
 */
function matchesCode(cmd: SlashCommand, query: string): boolean {
  const q = query.toLowerCase();
  if (cmd.code !== undefined && cmd.code.toLowerCase() === q) return true;
  return (cmd.aliases ?? []).some((alias) => alias.toLowerCase() === q);
}

/** First root or child command whose code/alias equals `query` (leaf-applyable). */
function findCodeMatch(commands: SlashCommand[], query: string): SlashCommand | null {
  const q = query.toLowerCase();
  for (const cmd of commands) {
    if (cmd.code?.toLowerCase() === q || (cmd.aliases ?? []).some((a) => a.toLowerCase() === q)) {
      return cmd;
    }
    for (const child of cmd.children ?? []) {
      if (child.code?.toLowerCase() === q || (child.aliases ?? []).some((a) => a.toLowerCase() === q)) {
        return child;
      }
    }
  }
  return null;
}

function filterCommands(commands: SlashCommand[], query: string): SlashCommand[] {
  if (!query) return commands;
  return commands.filter(
    (cmd) =>
      matchesCode(cmd, query) ||
      (cmd.children ?? []).some((child) => matchesCode(child, query)) ||
      isSubsequence(query, cmd.label) ||
      isSubsequence(query, pinyinInitials(cmd.label)),
  );
}

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
  /** Filter typed after the `/`, derived from the document. */
  query: string;
  selected: number;
  /** Root rows (may include submenu openers). */
  commands: SlashCommand[];
  /** Root rows currently displayed (filtered by `query`). */
  rows: SlashCommand[];
  /** The opener whose children are shown in the flyout, or null. */
  submenuParent: SlashCommand | null;
  /** Children displayed in the open flyout. */
  flyoutRows: SlashCommand[];
  /** Selection index inside the open flyout. */
  flyoutSelected: number;
  /** The parent cell the flyout is anchored to. */
  parentCell: HTMLElement | null;
  /** Cells of the current root render, index-aligned with `rows`. */
  cells: HTMLElement[];
  /** Active grid picker, or null when a row list is displayed. */
  grid: GridState | null;
  dom: HTMLDivElement | null;
  flyoutDom: HTMLDivElement | null;
}

const menus = new WeakMap<EditorView, SlashMenuState>();

/** Closes the menu (root panel + flyout) for `view` without touching the document. */
function closeMenu(view: EditorView): void {
  const state = menus.get(view);
  if (!state) return;
  if (state.dom && state.dom.parentNode) {
    state.dom.parentNode.removeChild(state.dom);
  }
  if (state.flyoutDom && state.flyoutDom.parentNode) {
    state.flyoutDom.parentNode.removeChild(state.flyoutDom);
  }
  menus.delete(view);
}

function renderMenu(view: EditorView, state: SlashMenuState): void {
  if (!state.dom) return;
  if (state.grid) {
    renderGrid(view, state);
    return;
  }
  renderRootGrid(view, state);
  if (isFlyoutOpen(state)) {
    renderFlyout(view, state);
    positionFlyout(view, state);
  }
}

/** True when a second-level flyout is present. */
function isFlyoutOpen(state: SlashMenuState): boolean {
  return state.submenuParent !== null && state.flyoutRows.length > 0;
}

/**
 * Render the root rows as an icon grid: one cell per command (icon above
 * label), grouped by `cmd.group` with full-width group headings. `rows` is the
 * query-filtered list; `data-selected` tracks keyboard selection.
 */
function renderRootGrid(view: EditorView, state: SlashMenuState): void {
  if (!state.dom) return;
  state.dom.textContent = '';
  state.cells = [];

  const grid = document.createElement('div');
  grid.className = 'mdb-slash-grid-menu';
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(3, minmax(0, 1fr))';
  grid.style.gap = '2px';
  grid.style.padding = '6px';
  state.dom.appendChild(grid);

  let lastGroup: string | undefined;
  state.rows.forEach((cmd, i) => {
    if (cmd.group && cmd.group !== lastGroup) {
      const header = document.createElement('div');
      header.className = 'mdb-slash-group';
      header.textContent = cmd.group;
      header.style.gridColumn = '1 / -1';
      header.style.padding = '6px 6px 2px';
      header.style.fontSize = '11px';
      header.style.color = 'var(--mdb-text-secondary)';
      header.style.opacity = '0.8';
      grid.appendChild(header);
      lastGroup = cmd.group;
    }

    const cell = document.createElement('div');
    cell.className = 'mdb-slash-item';
    cell.dataset.cmd = cmd.id;
    cell.style.display = 'flex';
    cell.style.flexDirection = 'column';
    cell.style.alignItems = 'center';
    cell.style.gap = '3px';
    cell.style.padding = '8px 6px';
    cell.style.borderRadius = '6px';
    cell.style.cursor = 'pointer';
    cell.style.minWidth = '0';
    cell.style.textAlign = 'center';
    if (i === state.selected) {
      cell.setAttribute('data-selected', 'true');
      cell.style.background = 'rgb(22,93,255,0.18)';
      cell.style.fontWeight = '600';
    }

    const icon = document.createElement('span');
    icon.textContent = cmd.icon ?? '';
    icon.style.height = '18px';
    icon.style.lineHeight = '18px';
    icon.style.color = 'var(--mdb-primary)';
    cell.appendChild(icon);

    const label = document.createElement('span');
    label.textContent = cmd.label;
    label.style.maxWidth = '100%';
    label.style.overflow = 'hidden';
    label.style.textOverflow = 'ellipsis';
    label.style.whiteSpace = 'nowrap';
    cell.appendChild(label);

    if (cmd.children?.length || cmd.hint) {
      const hint = document.createElement('span');
      hint.style.color = 'var(--mdb-text-secondary)';
      hint.style.fontSize = '10px';
      hint.style.opacity = '0.8';
      hint.textContent = cmd.children?.length ? '\u25B8' : (cmd.hint ?? '');
      cell.appendChild(hint);
    }

    cell.addEventListener('mouseenter', () => {
      if (!cmd.children?.length) return;
      state.selected = i;
      enterSubmenu(view, cmd);
    });

    cell.addEventListener('mousedown', (e) => {
      e.preventDefault();
      state.selected = i;
      activateRow(view, cmd);
    });

    grid.appendChild(cell);
    state.cells.push(cell);
  });

  if (state.rows.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'mdb-slash-empty';
    empty.textContent = '无匹配项';
    empty.style.gridColumn = '1 / -1';
    empty.style.padding = '8px 10px';
    empty.style.fontSize = '12px';
    empty.style.color = 'var(--mdb-text-secondary)';
    grid.appendChild(empty);
  }
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
  closeFlyout(state);
  state.rows = [];
  state.grid = { rows: cmd.grid.rows, cols: cmd.grid.cols, hoverR: 1, hoverC: 1 };
  renderMenu(view, state);
}

/** Insert the hovered table size and close the menu. */
function applyGrid(view: EditorView, r: number, c: number): void {
  const state = menus.get(view);
  if (!state?.open) return;
  const slashPos = state.slashPos;
  // Replace the `/` plus any typed filter — not just the single slash char.
  const to = Math.max(view.state.selection.main.head, slashPos + 1);
  closeMenu(view);
  const text = buildTable(c, r);
  view.dispatch({
    changes: { from: slashPos, to, insert: text },
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
  menu.style.minWidth = '224px';
  menu.style.padding = '0';
  menu.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.24)';

  menu.style.overflowY = 'auto';

  const state: SlashMenuState = {
    open: true,
    slashPos,
    query: '',
    selected: 0,
    commands,
    rows: commands,
    submenuParent: null,
    flyoutRows: [],
    flyoutSelected: 0,
    parentCell: null,
    cells: [],
    grid: null,
    dom: menu,
    flyoutDom: null,
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
  const state = menus.get(view);
  const head = view.state.selection.main.head;
  // The `/` plus any typed filter is one replaceable range; command `insert`
  // implementations only supply the replacement text.
  const from = state ? state.slashPos : head - 1;
  // Close FIRST so the doc-change sync plugin never fights the transaction we
  // are about to dispatch.
  closeMenu(view);
  if (head < from) return;
  const change = cmd.insert(view.state);
  // `text` is our interface field; CM6's ChangeSpec field is `insert`.
  view.dispatch({
    changes: { from, to: head, insert: change.text },
    selection: { anchor: from + change.text.length },
    scrollIntoView: true,
  });
}

/** Activate a row: open its flyout or grid, or apply its insert. */
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

/** Open a row's second-level flyout beside its cell; the root grid stays put. */
function enterSubmenu(view: EditorView, cmd: SlashCommand): void {
  const state = menus.get(view);
  if (!state?.open || !state.dom || state.grid || !cmd.children?.length) return;
  state.submenuParent = cmd;
  state.flyoutRows = cmd.children;
  state.flyoutSelected = 0;
  state.parentCell = state.cells[state.selected] ?? null;

  if (!state.flyoutDom) {
    const flyout = document.createElement('div');
    flyout.className = 'mdb-slash-flyout';
    flyout.style.position = 'absolute';
    flyout.style.background = 'var(--mdb-bg-secondary)';
    flyout.style.border = '1px solid var(--mdb-border)';
    flyout.style.color = 'var(--mdb-text)';
    flyout.style.zIndex = '1001';
    flyout.style.fontSize = '13px';
    flyout.style.borderRadius = '6px';
    flyout.style.minWidth = '150px';
    flyout.style.padding = '4px 0';
    flyout.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.24)';
    flyout.style.overflowY = 'auto';
    state.flyoutDom = flyout;
  }
  if (state.flyoutDom.parentNode !== view.dom) {
    view.dom.appendChild(state.flyoutDom);
  }
  renderFlyout(view, state);
  positionFlyout(view, state);
}

/** Close the second-level flyout; the root grid and query stay as they are. */
function closeFlyout(state: SlashMenuState): void {
  if (state.flyoutDom?.parentNode) {
    state.flyoutDom.parentNode.removeChild(state.flyoutDom);
  }
  state.submenuParent = null;
  state.flyoutRows = [];
  state.flyoutSelected = 0;
  state.parentCell = null;
}

/** Render the flyout rows, marking the keyboard selection. */
function renderFlyout(view: EditorView, state: SlashMenuState): void {
  if (!state.flyoutDom) return;
  state.flyoutDom.textContent = '';
  state.flyoutRows.forEach((cmd, i) => {
    const row = document.createElement('div');
    row.className = 'mdb-slash-flyout-item';
    row.dataset.cmd = cmd.id;
    row.style.padding = '6px 12px';
    row.style.cursor = 'pointer';
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '8px';
    if (i === state.flyoutSelected) {
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
    hint.textContent = cmd.hint ?? '';
    row.appendChild(hint);

    row.addEventListener('mousedown', (e) => {
      e.preventDefault();
      state.flyoutSelected = i;
      activateRow(view, cmd);
    });

    state.flyoutDom!.appendChild(row);
  });
}

/**
 * Place the flyout beside its parent cell, flipping to the cell's left and
 * clamping top/bottom when the viewport edge is reached. Same coordinate
 * recipe as `positionMenu` (viewport coords minus the editor origin).
 */
function positionFlyout(view: EditorView, state: SlashMenuState): void {
  const flyout = state.flyoutDom;
  const anchor = state.parentCell;
  if (!flyout || !anchor) return;
  try {
    const cellRect = anchor.getBoundingClientRect();
    const editorRect = view.dom.getBoundingClientRect();
    const flyoutRect = flyout.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    let leftV = cellRect.right + 4;
    if (leftV + flyoutRect.width > viewportW - 8) {
      leftV = Math.max(8, cellRect.left - flyoutRect.width - 4);
    }
    let topV = cellRect.top;
    if (topV + flyoutRect.height > viewportH - 8) {
      topV = Math.max(8, viewportH - 8 - flyoutRect.height);
    }

    flyout.style.left = `${leftV - editorRect.left}px`;
    flyout.style.top = `${topV - editorRect.top}px`;
    flyout.style.maxHeight = `${Math.max(120, viewportH - 8 - topV)}px`;
  } catch {
    // ignore — jsdom / unmeasured content
  }
}

/** Leave the grid picker and restore the (filtered) root row list. */
function backToRoot(view: EditorView): void {
  const state = menus.get(view);
  if (!state?.open || !state.dom || !state.grid) return;
  state.grid = null;
  state.rows = filterCommands(state.commands, state.query);
  state.selected = Math.min(state.selected, Math.max(0, state.rows.length - 1));
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

/** ArrowDown: move the flyout selection, or the root selection, down. */
export function slashMenuSelectNext(view: EditorView): boolean {
  const state = menus.get(view);
  if (!state?.open || !state.dom) return false;
  if (state.grid) return true;
  if (isFlyoutOpen(state)) {
    state.flyoutSelected = Math.min(state.flyoutSelected + 1, state.flyoutRows.length - 1);
    renderFlyout(view, state);
    return true;
  }
  state.selected = Math.min(state.selected + 1, state.rows.length - 1);
  renderRootGrid(view, state);
  return true;
}

/** ArrowUp: move the flyout selection, or the root selection, up. */
export function slashMenuSelectPrev(view: EditorView): boolean {
  const state = menus.get(view);
  if (!state?.open || !state.dom) return false;
  if (state.grid) return true;
  if (isFlyoutOpen(state)) {
    state.flyoutSelected = Math.max(state.flyoutSelected - 1, 0);
    renderFlyout(view, state);
    return true;
  }
  state.selected = Math.max(state.selected - 1, 0);
  renderRootGrid(view, state);
  return true;
}

/**
 * Enter: activate the selected row — a flyout open means the selected child,
 * otherwise the selected root row (which may itself open a flyout or grid).
 */
function applyTableSize(
  view: EditorView,
  state: SlashMenuState,
  cols: number,
  rows: number,
): void {
  const head = view.state.selection.main.head;
  const from = state.slashPos;
  const text = buildTable(cols, rows);
  closeMenu(view);
  if (head < from) return;
  view.dispatch({
    changes: { from, to: head, insert: text },
    selection: { anchor: from + text.length },
    scrollIntoView: true,
  });
}

export function slashMenuApply(view: EditorView): boolean {
  const state = menus.get(view);
  if (!state?.open || !state.dom || state.grid) return false;
  const tableSize = /^t([1-9])([1-9])?$/.exec(state.query);
  if (!isFlyoutOpen(state) && tableSize) {
    const rows = tableSize[2] !== undefined ? Number(tableSize[2]) : 1;
    applyTableSize(view, state, Number(tableSize[1]), rows);
    return true;
  }
  if (!isFlyoutOpen(state) && state.query !== '') {
    const codeMatch = findCodeMatch(state.commands, state.query);
    if (codeMatch && !codeMatch.children?.length && !codeMatch.grid) {
      applyCommand(view, codeMatch);
      return true;
    }
  }
  const cmd = isFlyoutOpen(state)
    ? state.flyoutRows[state.flyoutSelected]
    : state.rows[state.selected];
  if (!cmd) return false;
  activateRow(view, cmd);
  return true;
}

/** ArrowRight: open the selected row's flyout when it has children. */
export function slashMenuSubmenuEnter(view: EditorView): boolean {
  const state = menus.get(view);
  if (!state?.open || !state.dom || state.grid || isFlyoutOpen(state)) return false;
  const cmd = state.rows[state.selected];
  if (cmd?.grid) {
    openGrid(view, cmd);
    return true;
  }
  if (!cmd?.children?.length) return false;
  enterSubmenu(view, cmd);
  return true;
}

/** ArrowLeft: close an open flyout, or leave the grid picker. */
export function slashMenuSubmenuBack(view: EditorView): boolean {
  const state = menus.get(view);
  if (!state?.open || !state.dom) return false;
  if (isFlyoutOpen(state)) {
    closeFlyout(state);
    return true;
  }
  if (state.grid) {
    backToRoot(view);
    return true;
  }
  return false;
}

/** Escape: close the menu without inserting anything (the `/` remains). */
export function slashMenuClose(view: EditorView): boolean {
  const state = menus.get(view);
  if (!state?.open) return false;
  closeMenu(view);
  return true;
}

/**
 * Read the filter typed after the `/`: the characters between `slashPos + 1`
 * and the caret. Returns null when the document no longer looks like an open
 * menu — slash deleted, caret moved before it, or a newline was typed — and
 * the caller closes the menu then.
 */
function readQuery(state: SlashMenuState, editorState: EditorState): string | null {
  const head = editorState.selection.main.head;
  if (head < state.slashPos + 1) return null;
  const text = editorState.doc.sliceString(state.slashPos, head);
  if (!text.startsWith('/')) return null;
  const query = text.slice(1);
  if (query.includes('\n')) return null;
  return query;
}

/** Apply a document-derived filter query; typing closes any open flyout. */
function applyQuery(view: EditorView, state: SlashMenuState, query: string): void {
  closeFlyout(state);
  state.query = query;
  state.rows = filterCommands(state.commands, query);
  state.selected = Math.min(state.selected, Math.max(0, state.rows.length - 1));
  renderMenu(view, state);
}

/**
 * Keeps the open menu in sync with the document:
 * - Query typing (characters after the `/`, before the caret) updates the
 *   filter instead of closing the menu — those characters ARE the query
 *   buffer, so they must not trip the old "any doc change closes" rule.
 * - Any other doc change (newline, slash deleted, edit elsewhere) closes.
 * - While an IME composition is active the menu is left untouched: composing
 *   must neither close the menu nor select a command.
 */
const menuSyncPlugin = ViewPlugin.define((view) => ({
  update(u: ViewUpdate): void {
    const state = menus.get(u.view);
    if (!state?.open || !u.docChanged || slashComposing) return;
    if (!state.grid) {
      const query = readQuery(state, u.state);
      if (query !== null) {
        applyQuery(u.view, state, query);
        return;
      }
    }
    closeMenu(u.view);
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

const COMMA_TRIGGER = '\u3001';

const chineseCommaTrigger = ViewPlugin.define((view) => {
  const onBeforeInput = (event: Event): void => {
    if ((event as InputEvent).data !== COMMA_TRIGGER) return;
    if (slashComposing || menus.get(view)?.open) return;
    if (insertSlashChar(view)) event.preventDefault();
  };
  view.contentDOM.addEventListener('beforeinput', onBeforeInput);
  return {
    destroy(): void {
      view.contentDOM.removeEventListener('beforeinput', onBeforeInput);
    },
  };
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
    menuSyncPlugin,
    slashCompositionGuard,
    chineseCommaTrigger,
  ];
}
