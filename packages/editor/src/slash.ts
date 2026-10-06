/* MD-Bundle Slash Commands — `/` command menu for CodeMirror 6.
 *
 * Architecture:
 * - Module-level `WeakMap<EditorView, SlashMenuState>` holds the open-menu state
 *   per view, so tests can drive the menu by calling the exported functions
 *   directly with a view (no DOM event simulation needed).
 * - Root rows render as a categorized vertical list; a row with children or a
 *   grid opens a flyout panel beside its row (the root list stays visible) on
 *   hover or click instead of replacing it. The table size picker keeps its own
 *   grid panel.
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
import { TABLE_SIZE_QUERY, filterSlashCommands } from './slash-filter';
import { sanitizeCellText } from './decorations/cell-text';
import { renderIcon } from './icons';
import { commandRegistry } from './commands';
import { formatKeyChord } from './keybindings';

export interface SlashCommand {
  id: string;
  label: string;
  hint?: string;
  /**
   * Icon registry name (see `ICON_REGISTRY` in `icons.ts`). Rendered as an SVG
   * via `renderIcon`, never as a text glyph: the raw name must not reach the
   * DOM as visible text.
   */
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
  /**
   * When true, activating the row asks the host to pick a media file via the
   * injected `pickMediaFile` callback instead of inserting static text. The
   * picked file's name becomes an editable `![name](name.ext)` reference.
   */
  pickMedia?: boolean;
}

function headingLevel(level: 1 | 2 | 3 | 4 | 5 | 6): SlashCommand {
  const prefix = `${'#'.repeat(level)} `;
  return {
    id: `heading-${level}`,
    label: `${level} 级标题`,
    icon: `H${level}Outlined`,
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
    icon: 'CalloutOutlined',
    code: CALLOUT_CODES[type],
    insert(state) {
      const head = state.selection.main.head;
      return { from: head - 1, to: head, text: `> [!${marker}]\n> ` };
    },
  };
}

const COLUMN_COUNTS = [1, 2, 3, 4, 5] as const

function columnCount(count: number): SlashCommand {
  return {
    id: `columns-${count}`,
    label: `${count} 栏`,
    icon: 'TextOutlined',
    code: `f${count}`,
    insert(state) {
      const head = state.selection.main.head
      return { from: head - 1, to: head, text: `::: {.col-${count}}\n\n:::` }
    },
  }
}

/**
 * Registry command id backing a slash row, so the row shows the product
 * keybinding (editor-shortcuts: slash items show the product chord, never the
 * markdown trigger). Rows with no bound command are absent → no chord shown.
 */
const SLASH_COMMAND_IDS: Record<string, string> = {
  'heading-1': 'heading-1',
  'heading-2': 'heading-2',
  'heading-3': 'heading-3',
  'heading-4': 'heading-4',
  'heading-5': 'heading-5',
  'heading-6': 'heading-6',
  quote: 'insert-quote',
  'code-block': 'insert-code-block',
  task: 'insert-task-list',
};

function slashKeybind(id: string): string {
  const commandId = SLASH_COMMAND_IDS[id];
  if (commandId === undefined) return '';
  const chord = commandRegistry.getKeyBinding(commandId);
  return chord === null ? '' : formatKeyChord(chord);
}

export const defaultCommands: SlashCommand[] = [
  {
    id: 'heading',
    label: '标题',
    icon: 'H1Outlined',
    group: '基础',
    children: ([1, 2, 3, 4, 5, 6] as const).map(headingLevel),
  },
  {
    id: 'quote',
    label: '引用',
    icon: 'FormatQuoteOutlined',
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
    icon: 'CodeblockOutlined',
    code: 'c',
    group: '基础',
    insert(state) {
      const head = state.selection.main.head;
      return { from: head - 1, to: head, text: '```\n\n```' };
    },
  },
  {
    id: 'divider',
    label: '分割线',
    icon: 'HorizontalRuleOutlined',
    code: 'd',
    group: '基础',
    insert(state) {
      const head = state.selection.main.head;
      return { from: head - 1, to: head, text: '---' };
    },
  },
  {
    id: 'task',
    label: '任务',
    icon: 'TodoOutlined',
    code: 'r',
    group: '常用',
    insert(state) {
      const head = state.selection.main.head;
      return { from: head - 1, to: head, text: '- [ ] ' };
    },
  },
  {
    id: 'image-ref',
    label: '图片引用',
    icon: 'ImageOutlined',
    code: 'p',
    aliases: ['img'],
    group: '常用',
    pickMedia: true,
  },
  {
    id: 'media-ref',
    label: '视频/文件',
    icon: 'ImageOutlined',
    code: 'v',
    aliases: ['media'],
    group: '常用',
    pickMedia: true,
  },
  {
    id: 'table',
    label: '表格',
    icon: 'TableChartOutlined',
    code: 't',
    group: '常用',
    grid: { rows: 10, cols: 10 },
  },
  {
    id: 'columns',
    label: '分栏',
    icon: 'TextOutlined',
    code: 'f',
    group: '常用',
    children: COLUMN_COUNTS.map(columnCount),
  },
  {
    id: 'callout',
    label: '标注',
    icon: 'CalloutOutlined',
    code: 'n',
    group: '常用',
    children: CALLOUT_TYPES.map(calloutType),
    insert(state) {
      const head = state.selection.main.head;
      return { from: head - 1, to: head, text: '> [!NOTE]\n> ' };
    },
  },
  {
    id: 'data-kanban',
    label: '数据看板',
    icon: 'TableChartOutlined',
    group: '数据',
  },
  {
    id: 'insert-html',
    label: '插入 HTML',
    icon: 'CodeOutlined',
    code: 'm',
    group: '绘图',
    insert(state) {
      const head = state.selection.main.head;
      return { from: head - 1, to: head, text: '<div align="center">\n\n</div>' };
    },
  },
  {
    id: 'insert-css',
    label: '插入 CSS',
    icon: 'CodeOutlined',
    aliases: ['css'],
    group: '绘图',
    insert(state) {
      const head = state.selection.main.head;
      return { from: head - 1, to: head, text: '<style>\n\n</style>' };
    },
  },
  {
    id: 'flowchart',
    label: '流程图',
    icon: 'CodeOffOutlined',
    group: '绘图',
  },
  {
    id: 'task-list',
    label: '任务清单',
    icon: 'TodoOutlined',
    group: '团队协作',
    insert(state) {
      const head = state.selection.main.head;
      return { from: head - 1, to: head, text: '- [ ] ' };
    },
  },
  {
    id: 'toc',
    label: '目录导航',
    icon: 'ListOutlined',
    group: '进阶',
  },
  {
    id: 'embed-web',
    label: '内嵌网页',
    icon: 'ImageOutlined',
    group: '更多小组件',
  },
];

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

/** Active grid picker: bounds plus the hovered cell that will be inserted. */
interface GridState {
  rows: number;
  cols: number;
  hoverR: number;
  hoverC: number;
}

/** `slash`: the user typed `/` and the menu owns `[slashPos, head]`, so a cancel
 * must delete that range. `anchor`: a cell handle asked for an insert menu at a
 * zero-width position — there is no trigger text and no filter, so a cancel must
 * not delete a character, and document churn elsewhere must not close it. The
 * caret leaving the owning cell does close it (see `anchorRange`). `below`: the
 * block handle's 在下方添加 row asked for the same menu at a zero-width position
 * after the block; like `anchor` it owns no text, but its inserts go on a new
 * line below the block instead of inline, so they are never cell-sanitized. */
type SlashMenuTrigger = 'slash' | 'anchor' | 'below';

interface SlashMenuState {
  open: boolean;
  slashPos: number;
  trigger: SlashMenuTrigger;
  /**
   * The cell range owning an anchored menu. Doc churn inside it (the widget
   * rewrites cell markup on blur) must not close the menu; the caret stepping
   * outside does. Null for slash menus, which key off the typed query instead.
   */
  anchorRange: { from: number; to: number } | null;
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

/**
 * Host-injected file pickers, keyed by view. The editor package never touches
 * the DOM file input directly; the host (apps/web) registers a callback that
 * opens a native picker and returns the chosen File (or null on cancel).
 */
const pickMediaFiles = new WeakMap<EditorView, () => Promise<File | null>>();

/**
 * Register a file picker for a view. Called by `createMarkdownEditor` when the
 * host supplies `pickMediaFile` in options.
 */
export function registerPickMediaFile(
  view: EditorView,
  pickMediaFile: () => Promise<File | null>,
): void {
  pickMediaFiles.set(view, pickMediaFile);
}

/** Closes the menu (root panel + flyout) for `view` without touching the document. */
/** Pointer travel from the cell handle to the menu crosses the editor, so closing
 * on `mouseleave` alone would tear the menu down before it can be clicked. */
const ANCHOR_CLOSE_DELAY_MS = 150;
const pendingAnchorCloses = new WeakMap<EditorView, ReturnType<typeof setTimeout>>();

function cancelAnchorClose(view: EditorView): void {
  const pending = pendingAnchorCloses.get(view);
  if (pending === undefined) return;
  clearTimeout(pending);
  pendingAnchorCloses.delete(view);
}

function scheduleAnchorClose(view: EditorView): void {
  cancelAnchorClose(view);
  pendingAnchorCloses.set(
    view,
    setTimeout(() => {
      pendingAnchorCloses.delete(view);
      const state = menus.get(view);
      if (state && state.open && state.trigger !== 'slash') closeMenu(view);
    }, ANCHOR_CLOSE_DELAY_MS),
  );
}

function closeMenu(view: EditorView): void {
  cancelAnchorClose(view);
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

/**
 * Cancel the menu the way a user expects when they abandon it — Escape, an
 * outside click, or the caret leaving the trigger. The panel goes away AND the
 * text the menu owns (`/` plus the typed query) is removed, so a cancel never
 * leaves a stray `/` behind.
 *
 * The close runs BEFORE the dispatch so the doc-change sync plugin sees no open
 * menu and never fights this transaction. The deleted range ends at the last
 * character the menu absorbed, never at the caret: the caret can sit on another
 * line or past text that predates the menu, and cutting up to head would eat
 * content the menu never owned.
 */
function dismissMenu(view: EditorView): void {
  const state = menus.get(view);
  if (!state?.open) return;
  if (state.trigger !== 'slash') {
    // Anchored and below menus own no text: their position is zero-width and
    // may sit at the head of a cell whose content starts with `/`, or at a
    // block boundary. Cancel must not delete a character.
    closeMenu(view);
    return;
  }
  const { slashPos } = state;
  // Read the trigger before closing: after closeMenu the state is gone, and an
  // out-of-range slashPos (doc replaced under us) makes sliceString return ''.
  const hasTrigger = view.state.doc.sliceString(slashPos, slashPos + 1) === '/';
  const to = Math.min(slashPos + 1 + state.query.length, view.state.doc.length);
  closeMenu(view);
  if (!hasTrigger) return;
  view.dispatch({
    changes: { from: slashPos, to },
    selection: { anchor: slashPos },
  });
}

/** Views with a dismissal already queued, so one caret move schedules one. */
const pendingDismissals = new WeakSet<EditorView>();

/**
 * Caret-driven dismissal must leave the in-flight update before dispatching:
 * CodeMirror rejects nested updates and swallows them as a plugin crash, which
 * would tear the panel down and orphan the owned `/`. A microtask still lands
 * before the next paint, so the delay is invisible. Escape and outside mousedown
 * stay synchronous — those handlers run outside any update. The state is
 * captured so a menu closed or reopened meanwhile is not dismissed by a stale call.
 */
function scheduleDismiss(view: EditorView): void {
  const state = menus.get(view);
  if (!state?.open || pendingDismissals.has(view)) return;
  pendingDismissals.add(view);
  queueMicrotask(() => {
    pendingDismissals.delete(view);
    if (menus.get(view) !== state) return;
    dismissMenu(view);
  });
}

/**
 * The root grid always renders: `state.grid` / `isFlyoutOpen` only pick which
 * panel the flyout layer shows. Returning to the grid must not tear the root
 * list down (#331).
 */
function renderMenu(view: EditorView, state: SlashMenuState): void {
  if (!state.dom) return;
  renderRootGrid(view, state)
  // #331: the root stays mounted under the second level, so this render rebuilt
  // its cells — re-anchor first, or the layer hangs off a detached 0x0 node.
  if (state.grid || isFlyoutOpen(state)) {
    state.parentCell = state.cells[state.selected] ?? null
  }
  if (state.grid) {
    renderGrid(view, state);
    positionFlyout(view, state)
    return;
  }
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
 * Render root rows as a single-column list: one full-width row per command
 * (icon + label), under full-width group headings. Single column because the
 * list doubles as the filter result surface; `data-selected` tracks selection.
 */
function renderRootGrid(view: EditorView, state: SlashMenuState): void {
  if (!state.dom) return;
  state.dom.textContent = '';
  state.cells = [];

  const grid = document.createElement('div');
  grid.className = 'mdb-slash-grid-menu';
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'minmax(0, 1fr)';
  grid.style.gap = '2px';
  grid.style.padding = '6px';
  state.dom.appendChild(grid);

  // Group headings describe the browse layout; while filtering they only add
  // noise between unrelated matches, so they are dropped.
  const showGroups = state.query.trim() === '';

  let lastGroup: string | undefined;
  state.rows.forEach((cmd, i) => {
    if (showGroups && cmd.group && cmd.group !== lastGroup) {
      const header = document.createElement('div');
      header.className = 'mdb-slash-group';
      header.textContent = cmd.group;
      header.style.gridColumn = '1 / -1';
      header.style.padding = '6px 6px 2px';
      header.style.fontSize = '11px';
      header.style.color = 'var(--mdb-text-secondary)';
      header.style.opacity = '0.8';
      // Sticky against the scrollable menu so the current group stays visible.
      header.style.position = 'sticky';
      header.style.top = '0';
      header.style.zIndex = '1';
      header.style.background = 'var(--mdb-bg-secondary)';
      grid.appendChild(header);
      lastGroup = cmd.group;
    }

    const cell = document.createElement('div');
    cell.className = 'mdb-slash-item';
    cell.dataset.cmd = cmd.id;
    cell.style.display = 'flex';
    cell.style.flexDirection = 'row';
    cell.style.alignItems = 'center';
    cell.style.gap = '8px';
    cell.style.padding = '6px 8px';
    cell.style.borderRadius = '6px';
    cell.style.cursor = 'pointer';
    cell.style.minWidth = '0';
    cell.style.textAlign = 'left';
    if (i === state.selected) {
      cell.setAttribute('data-selected', 'true');
      cell.style.background = 'rgb(22,93,255,0.18)';
      cell.style.fontWeight = '600';
    }

    const icon = document.createElement('span');
    icon.className = 'mdb-slash-item-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.style.width = '18px';
    icon.style.flexShrink = '0';
    icon.style.display = 'inline-flex';
    icon.style.alignItems = 'center';
    icon.style.justifyContent = 'center';
    icon.style.lineHeight = '1';
    icon.style.color = 'var(--mdb-primary)';
    if (cmd.icon) icon.appendChild(renderIcon(cmd.icon));
    cell.appendChild(icon);

    const label = document.createElement('span');
    label.textContent = cmd.label;
    label.style.minWidth = '0';
    label.style.flex = '1 1 auto';
    label.style.overflow = 'hidden';
    label.style.textOverflow = 'ellipsis';
    label.style.whiteSpace = 'nowrap';
    cell.appendChild(label);

    const keybind = slashKeybind(cmd.id);
    if (keybind !== '') {
      const kbd = document.createElement('kbd');
      kbd.className = 'mdb-slash-item-kbd';
      kbd.textContent = keybind;
      kbd.style.color = 'var(--mdb-text-secondary)';
      kbd.style.fontSize = '10px';
      kbd.style.flexShrink = '0';
      kbd.style.fontFamily = 'var(--mdb-font-mono, ui-monospace, monospace)';
      cell.appendChild(kbd);
    }

    const hasSecondLevel = Boolean(cmd.children?.length) || cmd.grid !== undefined;
    if (hasSecondLevel || cmd.hint) {
      const hint = document.createElement('span');
      hint.style.color = 'var(--mdb-text-secondary)';
      hint.style.fontSize = '10px';
      hint.style.opacity = '0.8';
      hint.style.flexShrink = '0';
      hint.textContent = hasSecondLevel ? '\u25B8' : (cmd.hint ?? '');
      cell.appendChild(hint);
    }

    // Hovering a row with a second level opens it immediately. Grid rows go
    // through `enterGrid` (no root rebuild) so replacing DOM under a parked
    // pointer cannot retrigger the handler into a render loop.
    cell.addEventListener('mouseenter', () => {
      state.selected = i;
      if (cmd.grid) {
        enterGrid(view, cmd, cell);
        return;
      }
      if (cmd.children?.length) enterSubmenu(view, cmd);
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

/**
 * Build a GFM pipe table with `cols` columns and `rows` body rows.
 * Cells start empty — placeholder text (A/B/C, 1/2/3/4) would be written
 * into the document and force the user to clear every cell by hand (#386).
 */
function buildTable(cols: number, rows: number): string {
  const line = `| ${Array.from({ length: cols }, () => '').join(' | ')} |`;
  const separator = `| ${Array.from({ length: cols }, () => '---').join(' | ')} |`;
  const body = Array.from({ length: rows }, () => line).join('\n');
  return `${line}\n${separator}\n${body}`;
}

/**
 * Open the grid picker. Unlike `backToRoot`, `rows` is deliberately left alone —
 * the root list stays browsable under the picker (#331).
 */
function openGrid(view: EditorView, cmd: SlashCommand): void {
  const state = menus.get(view);
  if (!state?.open || !state.dom || !cmd.grid) return;
  enterGrid(view, cmd, state.cells[state.selected] ?? null);
}

/**
 * Show a row's grid picker in the flyout layer without rebuilding the root
 * list. Hover and click both land here: a rebuild would replace the cell under
 * a parked pointer and could retrigger the hover handler in a loop. Callers
 * pass the owning cell so the picker anchors beside the right row whether the
 * row was clicked or hovered.
 */
function enterGrid(view: EditorView, cmd: SlashCommand, parentCell: HTMLElement | null): void {
  const state = menus.get(view);
  if (!state?.open || !state.dom || !cmd.grid) return;
  closeFlyout(state);
  state.grid = { rows: cmd.grid.rows, cols: cmd.grid.cols, hoverR: 1, hoverC: 1 };
  state.submenuParent = cmd;
  state.parentCell = parentCell ?? state.cells[state.selected] ?? null;
  ensureFlyoutDom(view, state);
  renderGrid(view, state);
  positionFlyout(view, state);
}

/** Render the rows×cols grid picker with an N × M readout and hover preview. */
function renderGrid(view: EditorView, state: SlashMenuState): void {
  if (!state.grid) return
  const grid = state.grid;
  const flyout = ensureFlyoutDom(view, state)
  flyout.textContent = ''
  flyout.style.minWidth = '224px'

  const title = document.createElement('div')
  title.className = 'mdb-slash-grid-title'
  title.textContent = '插入支持富文本的表格'
  title.style.padding = '6px 10px 2px'
  title.style.fontSize = '12px'
  title.style.color = 'var(--mdb-text)'
  flyout.appendChild(title)

  const label = document.createElement('div');
  label.className = 'mdb-slash-grid-label';
  label.textContent = `${grid.hoverR} \u00d7 ${grid.hoverC}`;
  label.style.padding = '4px 10px';
  label.style.fontSize = '11px';
  label.style.color = 'var(--mdb-text-secondary)';
  flyout.appendChild(label)

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
        applyTableSize(view, state, c, r)
      });
      wrap.appendChild(cell);
    }
  }
  flyout.appendChild(wrap)
}

function openMenu(
  view: EditorView,
  slashPos: number,
  commands: SlashCommand[],
  trigger: SlashMenuTrigger = 'slash',
  anchorRange: { from: number; to: number } | null = null,
): void {
  const menu = document.createElement('div');
  menu.className = 'mdb-slash-menu';
  menu.dataset.testid = 'slash-menu';
  menu.addEventListener('mouseenter', () => cancelAnchorClose(view));
  menu.addEventListener('mouseleave', () => {
    const current = menus.get(view);
    if (current && current.trigger !== 'slash') scheduleAnchorClose(view);
  });
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
    trigger,
    anchorRange,
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
  positionMenu(view, menu, slashPos, trigger);
}

/**
 * Anchored counterpart of `openMenu`, reached from `decorations/table.ts` and
 * the block handle's 在下方添加 row. Tears down any open menu first: the older
 * panel would stay wired to this view while detached. `trigger` defaults to
 * `anchor` (the table-cell path is unchanged); the block handle passes `below`.
 */
export function openInsertMenu(
  view: EditorView,
  at: number,
  commands: SlashCommand[],
  anchorRange: { from: number; to: number },
  trigger: SlashMenuTrigger = 'anchor',
): void {
  cancelAnchorClose(view);
  closeMenu(view);
  openMenu(view, at, commands, trigger, anchorRange);
}

/**
 * Drop an anchored/below menu without touching the document. Used when the
 * widget that opened it goes away (disposal, mode switch) or the pointer leaves
 * the trigger without entering the menu, where waiting out the hover grace
 * period would leave an orphaned panel over another view.
 *
 * `only` restricts the release to one trigger: the table cell's menu is
 * `anchor` and the block handle's is `below`, so a block-handle dismissal must
 * not tear down a table cell menu the pointer merely passed near (#385b).
 */
export function releaseInsertMenu(
  view: EditorView,
  only?: 'anchor' | 'below',
): void {
  const trigger = menus.get(view)?.trigger;
  if (trigger !== 'anchor' && trigger !== 'below') return;
  if (only !== undefined && trigger !== only) return;
  closeMenu(view);
}

/**
 * Place the menu at the cursor, clamping its right/bottom edges into the
 * viewport and capping its height so long or second-level menus scroll instead
 * of overflowing (#250). coordsAtPos is viewport-relative but the menu is a
 * child of view.dom, so the editor origin is subtracted (issue #203). jsdom has
 * no layout; the try/catch leaves the menu at 0,0 there.
 */
function positionMenu(
  view: EditorView,
  menu: HTMLDivElement,
  slashPos: number,
  trigger: SlashMenuTrigger,
): void {
  try {
    const coords = view.coordsAtPos(trigger === 'anchor' ? slashPos : slashPos + 1);
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
    // Prefer opening under the cursor and scrolling when the list is tall;
    // only flip above the cursor when there is no usable room below. A flip is
    // clamped to the editor origin (never the viewport top) so the rows cannot
    // park under the app header where they are unclickable.
    const MIN_SPACE_BELOW = 180;
    if (viewportH - 8 - topV < MIN_SPACE_BELOW) {
      topV = Math.max(rect.top, viewportH - 8 - menuRect.height);
    }

    menu.style.left = `${leftV - rect.left}px`;
    menu.style.top = `${topV - rect.top}px`;
    menu.style.maxHeight = `${Math.max(120, viewportH - 8 - topV)}px`;
  } catch {
    // ignore — jsdom / unmeasured content
  }
}

/**
 * Replace `[from, to]` with `text` and park the caret right after the insert.
 * `to === from` gives a zero-width insertion at an anchor/below position.
 */
function replaceTrigger(view: EditorView, from: number, to: number, text: string): void {
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + text.length },
    scrollIntoView: true,
  });
}

/**
 * Remove the `/query` trigger range after a media pick row is cancelled or no
 * picker is injected. Mirrors `dismissMenu`'s slash-trigger cleanup but runs
 * after `closeMenu` has already torn down the menu state.
 */
function removeSlashTrigger(view: EditorView, from: number, query: string): void {
  const to = Math.min(from + 1 + query.length, view.state.doc.length);
  const hasTrigger = view.state.doc.sliceString(from, from + 1) === '/';
  if (!hasTrigger) return;
  replaceTrigger(view, from, to, '');
}

function applyCommand(view: EditorView, cmd: SlashCommand): void {
  const state = menus.get(view);
  const trigger = state?.trigger ?? 'slash';
  // Media pick rows delegate to the host's file picker instead of inserting
  // static placeholder text (#389). The picked file name becomes an editable
  // `![name](name.ext)` reference the host also imports as an asset.
  if (cmd.pickMedia) {
    const pickMediaFile = pickMediaFiles.get(view);
    const anchored = trigger === 'anchor';
    const below = trigger === 'below';
    const head = view.state.selection.main.head;
    const from = state ? state.slashPos : head - 1;
    const query = state?.query ?? '';
    // Close FIRST so the doc-change sync plugin never fights the insert we are
    // about to dispatch once the picker resolves asynchronously.
    closeMenu(view);
    if (!pickMediaFile) {
      // No host picker wired: leave no `/query` residue and insert nothing.
      if (trigger === 'slash') removeSlashTrigger(view, from, query);
      return;
    }
    // An anchored or below insert is position-based (zero-width at the anchor),
    // so it must NOT be blocked by a caret that happens to sit before it: the
    // table-cell menu opens by hovering a handle, never by moving the caret.
    // Only the slash insert, which replaces `[slashPos, head]`, is caret-based.
    if (!anchored && !below && head < from) return;
    void pickMediaFile().then((file) => {
      if (!file) {
        if (trigger === 'slash') removeSlashTrigger(view, from, query);
        return;
      }
      const ref = `![${file.name}](${file.name})`;
      if (anchored) {
        // A cell insert must stay on one line or it splits the table row.
        replaceTrigger(view, from, from, sanitizeCellText(ref));
        return;
      }
      if (below) {
        replaceTrigger(view, from, from, `\n${ref}`);
        return;
      }
      // Slash: replace `[slashPos, head]` — the `/`, plus any typed filter.
      replaceTrigger(view, from, head, ref);
    });
    return;
  }
  // Fidelity-only rows have no insert; dismiss without leaking the `/query`.
  if (!cmd.insert) {
    if (trigger === 'slash') dismissMenu(view);
    else closeMenu(view);
    return;
  }
  const anchored = trigger === 'anchor';
  const below = trigger === 'below';
  const head = view.state.selection.main.head;
  // The `/` plus any typed filter is one replaceable range; command `insert`
  // implementations only supply the replacement text.
  const from = state ? state.slashPos : head - 1;
  // Close FIRST so the doc-change sync plugin never fights the transaction we
  // are about to dispatch.
  closeMenu(view);
  if (head < from && !below) return;
  if (anchored) {
    // The anchor sits inside a table cell, so the inserted text must stay on one
    // line: a multi-line command (code block, table, callout) would otherwise
    // split the table row and corrupt the table.
    const text = sanitizeCellText(cmd.insert(view.state).text);
    view.dispatch({
      changes: { from, to: from, insert: text },
      selection: { anchor: from + text.length },
      scrollIntoView: true,
    });
    return;
  }
  if (below) {
    // The insert menu was opened from 在下方添加: start a new line after the
    // block and keep the template intact (no cell sanitizing, which would strip
    // the newlines and pipes a table or callout needs).
    const text = `\n${cmd.insert(view.state).text}`;
    view.dispatch({
      changes: { from, to: from, insert: text },
      selection: { anchor: from + text.length },
      scrollIntoView: true,
    });
    return;
  }
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

  ensureFlyoutDom(view, state)
  renderFlyout(view, state)
  positionFlyout(view, state)
}

function ensureFlyoutDom(view: EditorView, state: SlashMenuState): HTMLDivElement {
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
    // The flyout is a sibling layer, not a child of the root grid, so the
    // pointer genuinely leaves the root menu on the way in. Same
    // mouseenter/mouseleave grace as the root menu keeps the panel alive for
    // the whole root -> flyout -> row path.
    flyout.addEventListener('mouseenter', () => cancelAnchorClose(view));
    flyout.addEventListener('mouseleave', () => {
      if (menus.get(view)?.trigger === 'anchor') scheduleAnchorClose(view);
    });
    state.flyoutDom = flyout;
  }
  if (state.flyoutDom.parentNode !== view.dom) {
    view.dom.appendChild(state.flyoutDom);
  }
  return state.flyoutDom
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
  // `ensureFlyoutDom` sizes the layer only at creation; restore the row-flyout
  // width after the grid picker widened it.
  state.flyoutDom.style.minWidth = '150px'
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
    icon.className = 'mdb-slash-flyout-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.style.width = '18px';
    icon.style.display = 'inline-flex';
    icon.style.alignItems = 'center';
    icon.style.justifyContent = 'center';
    icon.style.color = 'var(--mdb-primary)';
    if (cmd.icon) icon.appendChild(renderIcon(cmd.icon));
    row.appendChild(icon);

    const label = document.createElement('span');
    label.textContent = cmd.label;
    row.appendChild(label);

    const keybind = slashKeybind(cmd.id);
    if (keybind !== '') {
      const kbd = document.createElement('kbd');
      kbd.className = 'mdb-slash-flyout-kbd';
      kbd.textContent = keybind;
      kbd.style.marginLeft = 'auto';
      kbd.style.color = 'var(--mdb-text-secondary)';
      kbd.style.fontSize = '11px';
      kbd.style.fontFamily = 'var(--mdb-font-mono, ui-monospace, monospace)';
      row.appendChild(kbd);
    }

    const hint = document.createElement('span');
    hint.style.marginLeft = 'auto';
    hint.style.color = 'var(--mdb-text-secondary)';
    hint.style.fontSize = '11px';
    hint.style.opacity = '0.8';
    hint.textContent = cmd.hint ?? '';
    row.appendChild(hint);

    row.addEventListener('mouseenter', () => {
      if (state.flyoutSelected === i) return;
      state.flyoutSelected = i;
      highlightFlyout(state);
    });

    row.addEventListener('mousedown', (e) => {
      e.preventDefault();
      state.flyoutSelected = i;
      activateRow(view, cmd);
    });

    state.flyoutDom!.appendChild(row);
  });
}

/** Move the flyout highlight in place; rebuilding rows on hover would thrash. */
function highlightFlyout(state: SlashMenuState): void {
  if (!state.flyoutDom) return;
  const rows = state.flyoutDom.querySelectorAll<HTMLElement>('.mdb-slash-flyout-item');
  rows.forEach((row, index) => {
    const active = index === state.flyoutSelected;
    if (active) row.setAttribute('data-selected', 'true');
    else row.removeAttribute('data-selected');
    row.style.background = active ? 'rgb(22,93,255,0.18)' : '';
    row.style.fontWeight = active ? '600' : '';
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

/**
 * Leave the grid picker. The root list stayed mounted underneath (#331), so
 * this only tears the flyout layer down. Rebuilding the root here would replace
 * the row under a parked pointer and fire a synthetic re-hover that immediately
 * reopened the grid.
 */
function backToRoot(view: EditorView): void {
  const state = menus.get(view);
  if (!state?.open || !state.dom || !state.grid) return;
  closeFlyout(state);
  state.grid = null;
}

/**
 * Module-level IME composition guard. Set by the ViewPlugin's eventHandlers
 * in slashKeymap, read by insertSlashChar to skip during active composition.
 */
let slashComposing = false;

/** Full-width slash (U+FF0F) used by some IMEs. */
const FULLWIDTH_SLASH = '\uFF0F';

/**
 * Handles typing `/` or `／`. Opens the command menu at the cursor. If a menu is
 * already open (a second consecutive slash), closes it and returns false so the
 * keymap falls through to default behavior — no duplicate menu, no
 * double-insert.
 *
 * Only triggers when:
 * - The character is ASCII `/` (U+002F) or full-width `／` (U+FF0F).
 * - The cursor is at word start (nothing before it on the line, or the
 *   character immediately before it is whitespace).
 * - IME is not actively composing (for the direct keymap path; the
 *   compositionend path handles the committed slash separately).
 */
export function insertSlashChar(
  view: EditorView,
  commands: SlashCommand[] = defaultCommands,
  slashChar: '/' | typeof FULLWIDTH_SLASH = '/',
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
  // or end with whitespace. Typing a slash immediately after a non-whitespace
  // character (mid-word) must NOT open the menu.
  if (textBeforeCursor.length > 0 && !/\s$/.test(textBeforeCursor)) return false;

  view.dispatch({
    changes: { from: head, insert: slashChar },
    selection: { anchor: head + slashChar.length },
  });
  // Open AFTER the dispatch so the ViewPlugin docChanged closer (if any)
  // doesn't immediately close it.
  openMenu(view, head, commands);
  return true;
}

/**
 * Opens the slash menu at the current cursor position without inserting a slash.
 * Used when the slash has already been inserted by IME composition.
 */
export function openSlashMenuAtCursor(
  view: EditorView,
  commands: SlashCommand[] = defaultCommands,
): void {
  const head = view.state.selection.main.head;
  openMenu(view, head, commands);
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
 * Enter: insert the hovered size while the grid picker is open, otherwise
 * activate the selected row — a flyout open means the selected child, else the
 * selected root row (which may itself open a flyout or grid).
 */
function applyTableSize(
  view: EditorView,
  state: SlashMenuState,
  cols: number,
  rows: number,
): void {
  const head = view.state.selection.main.head;
  const from = state.slashPos;
  const anchored = state.trigger === 'anchor';
  const below = state.trigger === 'below';
  const table = buildTable(cols, rows);
  // Anchored inside a cell: keep the table on one line so it cannot split the
  // row. Below the block: keep it intact on its own new line.
  const text = anchored ? sanitizeCellText(table) : below ? `\n${table}` : table;
  closeMenu(view);
  if (head < from && !below) return;
  view.dispatch({
    changes: { from, to: anchored || below ? from : head, insert: text },
    selection: { anchor: from + text.length },
    scrollIntoView: true,
  });
}

export function slashMenuApply(view: EditorView): boolean {
  const state = menus.get(view);
  if (!state?.open || !state.dom) return false
  if (state.grid) {
    applyTableSize(view, state, state.grid.hoverC, state.grid.hoverR)
    return true
  }
  const tableSize = TABLE_SIZE_QUERY.exec(state.query);
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

/** Escape: dismiss the menu and take the trigger text with it (no residue). */
export function slashMenuClose(view: EditorView): boolean {
  if (!menus.get(view)?.open) return false;
  dismissMenu(view);
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
  state.rows = filterSlashCommands(state.commands, query);
  state.selected = Math.min(state.selected, Math.max(0, state.rows.length - 1));
  renderMenu(view, state);
}

/** True while the caret still sits at the very end of `/${state.query}`. */
function isCaretAtQueryEnd(state: SlashMenuState, editorState: EditorState): boolean {
  return editorState.selection.main.head === state.slashPos + 1 + state.query.length;
}

/**
 * Keeps the open menu in sync with the document:
 * - Query typing (characters after the `/`, before the caret) updates the
 *   filter instead of closing the menu — those characters ARE the query
 *   buffer, so they must not trip the old "any doc change closes" rule.
 * - Any other doc change (newline, slash deleted, edit elsewhere) closes.
 * - A caret that moves away from the trigger dismisses the menu with it, so
 *   abandoning the trigger never strands a stray `/`.
 * - While an IME composition is active the menu is left untouched: composing
 *   must neither close the menu nor select a command.
 */
const menuSyncPlugin = ViewPlugin.define((view) => ({
  update(u: ViewUpdate): void {
    const state = menus.get(u.view);
    if (!state?.open || slashComposing) return;
    // Anchored and below menus have no typed trigger and no filter. The table
    // widget rewrites its own cell markup on blur, and the block-handle menu
    // drives the below menu from outside the document, so doc changes are
    // ignored outright. A caret that leaves the owning range does close the
    // panel, so it cannot linger after focus moved elsewhere.
    if (state.trigger !== 'slash') {
      if (u.selectionSet && state.anchorRange) {
        const caret = u.state.selection.main.head;
        if (caret < state.anchorRange.from || caret > state.anchorRange.to) {
          closeMenu(u.view);
        }
      }
      return;
    }
    if (u.docChanged) {
      if (!state.grid) {
        const query = readQuery(state, u.state);
        if (query !== null) {
          applyQuery(u.view, state, query);
          return;
        }
      }
      // Doc-driven invalidation: those keystrokes are the user's own text, not
      // a cancel of ours, so the menu closes but the document is left alone.
      closeMenu(u.view);
      return;
    }
    if (u.selectionSet && !isCaretAtQueryEnd(state, u.state)) scheduleDismiss(u.view);
  },
  destroy(): void {
    closeMenu(view);
  },
}));

/**
 * Tracks IME composition state for the slash menu. Sets slashComposing so
 * insertSlashChar can skip during active composition (avoids full-width /
 * triggering the menu). On compositionend, if the committed text is a slash
 * (ASCII or full-width), trigger the menu.
 * Uses capture-phase listeners on document to catch events even when CDP
 * triggers them on document rather than the contentDOM.
 */
const slashCompositionGuard = ViewPlugin.define((view) => {
  const onCompositionStart = (): void => {
    slashComposing = true;
  };
  const onCompositionEnd = (event: CompositionEvent): void => {
    const data = event.data ?? '';
    slashComposing = false;
    // Only react to a composition committed inside THIS editor. Real IMEs
    // dispatch on the contentDOM (inside view.dom); the CDP-driven e2e harness
    // dispatches on document. An unrelated input (e.g. the share nickname
    // field) committing a slash must not pop this editor's slash menu.
    const target = event.target as Node | null;
    if (target !== null && target !== document && !view.dom.contains(target)) return;
    // If the committed text is a slash (ASCII or full-width), trigger the menu.
    // This handles the IME path where typing "/" under Chinese IME produces
    // a full-width slash via composition.
    // The slash has already been inserted by the browser/IME, so we just open
    // the menu at the current cursor position (after the slash).
    if (data === '/' || data === FULLWIDTH_SLASH) {
      openSlashMenuAtCursor(view, defaultCommands);
    }
  };
  document.addEventListener('compositionstart', onCompositionStart, true);
  document.addEventListener('compositionend', onCompositionEnd, true);
  return {
    destroy(): void {
      document.removeEventListener('compositionstart', onCompositionStart, true);
      document.removeEventListener('compositionend', onCompositionEnd, true);
    },
  };
});

/**
 * A mousedown outside the menu dismisses it, trigger text included. Capture
 * phase so the dismissal wins over CM6's own mousedown handling, and the
 * containment guard keeps presses that land on the panel itself working.
 */
const outsideClickDismiss = ViewPlugin.define((view) => {
  const onMouseDown = (event: MouseEvent): void => {
    const state = menus.get(view);
    if (!state?.open) return;
    const target = event.target;
    const inTriggerChrome =
      target instanceof Element &&
      target.closest('.cm-table-cell-handle, .mdb-block-handle-menu, .mdb-block-handle') !== null;
    if (
      target instanceof Node &&
      (state.dom?.contains(target) || state.flyoutDom?.contains(target) || inTriggerChrome)
    ) {
      return;
    }
    if (state.trigger !== 'slash') {
      closeMenu(view);
      return;
    }
    dismissMenu(view);
  };
  document.addEventListener('mousedown', onMouseDown, true);
  return {
    destroy(): void {
      document.removeEventListener('mousedown', onMouseDown, true);
    },
  };
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
    outsideClickDismiss,
    chineseCommaTrigger,
  ];
}
