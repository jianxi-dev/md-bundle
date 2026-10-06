/**
 * Table widget — renders a GFM pipe table as a real `<table>` while the
 * markdown source stays the single source of truth.
 *
 * How editing works
 * -----------------
 * The widget root is `contenteditable="false"`, taking the table out of CM6's
 * editable region. A cell click opens a real `<input>` inside that cell: a form
 * control is never part of CM6's editable content, emits no DOM mutations its
 * observer could act on, and has native focus, caret, IME and undo.
 *
 * CM6 rebuilds the widget DOM during the mousedown capture phase, so the click's
 * event target is detached by the time a handler runs. The editor is therefore
 * opened on the next frame, looking the live cell up by its own row/col.
 *
 * Typed text is staged in a per-view map (so it survives a widget rebuild) and
 * written back with ONE transaction when the edit settles: blur, Enter/Tab, a
 * mousedown outside the table, or editor teardown (mode switch). The flush never
 * dispatches inside a CM6 update — it defers to the next tick when it would.
 */
import type { Extension, Range } from '@codemirror/state';
import { Decoration, ViewPlugin, WidgetType, type EditorView } from '@codemirror/view';
import { defaultCommands, openInsertMenu, releaseInsertMenu } from '../slash';
import {
  parseCellBackground,
  renderCellText,
  sanitizeCellText,
  stripCellBackground,
} from './cell-text';
import {
  clearCellSelection,
  getCellSelection,
  isCellInSelection,
  setCellSelection,
  subscribeCellSelection,
  type CellRect,
  type CellSelection,
} from './cell-selection';

const TABLE_ROW_RE = /^\s*\|.*\|\s*$/;
const TABLE_SEP_RE = /^\s*\|(\s*:?-+:?\s*\|)+\s*$/;

/** Fallback geometry used before layout is measurable (hidden line / jsdom). */
const FALLBACK_TABLE_WIDTH = 600;
const FALLBACK_ROW_HEIGHT = 32;
const BOUNDARY_THICKNESS = 6;

/**
 * How close (px) the pointer must be to a row/column boundary line before its
 * insertion hotspot is revealed. Matches the reader spec's "within 8px of a
 * boundary line" contract and the 16px dot diameter. Issue #385a: the reveal is
 * per-boundary, so entering a cell no longer lights every hotspot at once.
 */
const BOUNDARY_REVEAL_DISTANCE = 8;

interface CellSpan {
  /** `-1` marks the header row. */
  row: number;
  col: number;
  from: number;
  to: number;
  /** True when the document selection currently sits in this cell. */
  active: boolean;
}

interface TableBlock {
  index: number;
  from: number;
  to: number;
  header: string[];
  rows: string[][];
  cells: CellSpan[];
}

// --- Pure parsing helpers ----------------------------------------------------

function splitCells(line: string): string[] {
  const parts = line.split('|');
  return parts.slice(1, parts.length - 1).map((cell) => cell.trim());
}

function cellSpans(line: string, lineStart: number, row: number, active: CellActivity): CellSpan[] {
  const spans: CellSpan[] = [];
  const pipes: number[] = [];
  for (let i = 0; i < line.length; i += 1) {
    if (line[i] === '|') pipes.push(i);
  }
  for (let k = 0; k + 1 < pipes.length; k += 1) {
    let start = pipes[k] + 1;
    let end = pipes[k + 1];
    while (start < end && /\s/.test(line[start])) start += 1;
    while (end > start && /\s/.test(line[end - 1])) end -= 1;
    const from = lineStart + start;
    spans.push({ row, col: k, from, to: lineStart + end, active: isActive(active, from, lineStart + end) });
  }
  return spans;
}

/** Document range the cursor occupies, used to flag the active cell. */
interface CellActivity {
  from: number;
  to: number;
  active: boolean;
}

function isActive(activity: CellActivity, from: number, to: number): boolean {
  if (!activity.active) return false;
  if (activity.from < 0) return false;
  // A collapsed cursor counts as inside an empty cell (from === to).
  return activity.from >= from && activity.from <= to && activity.to >= from;
}

function findTables(text: string, activity: CellActivity = { from: -1, to: -1, active: false }): TableBlock[] {
  const lines = text.split('\n');
  const offsets: number[] = [];
  let acc = 0;
  for (const line of lines) {
    offsets.push(acc);
    acc += line.length + 1;
  }

  const tables: TableBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const isTable =
      TABLE_ROW_RE.test(lines[i]) &&
      i + 1 < lines.length &&
      TABLE_SEP_RE.test(lines[i + 1]);
    if (!isTable) {
      i += 1;
      continue;
    }

    let endLine = i + 1;
    while (endLine + 1 < lines.length && TABLE_ROW_RE.test(lines[endLine + 1])) {
      endLine += 1;
    }

    const rows: string[][] = [];
    for (let r = i + 2; r <= endLine; r += 1) rows.push(splitCells(lines[r]));

    const cells: CellSpan[] = cellSpans(lines[i], offsets[i], -1, activity);
    for (let r = i + 2; r <= endLine; r += 1) {
      cells.push(...cellSpans(lines[r], offsets[r], r - i - 2, activity));
    }

    tables.push({
      index: tables.length,
      from: offsets[i],
      to: offsets[endLine] + lines[endLine].length,
      header: splitCells(lines[i]),
      rows,
      cells,
    });
    i = endLine + 1;
  }
  return tables;
}

/**
 * Re-parse the document and locate one cell of one table by ordinal.
 *
 * Flush MUST NOT reuse the offsets a widget was built with: any earlier
 * write-back in the same batch has already shifted every position after it.
 * Lookups therefore go through the CURRENT document text.
 */
export function tableCellRange(
  docText: string,
  tableIndex: number,
  row: number,
  col: number,
): { from: number; to: number } | null {
  const table = findTables(docText)[tableIndex];
  if (!table) return null;
  const cell = table.cells.find((c) => c.row === row && c.col === col);
  return cell ? { from: cell.from, to: cell.to } : null;
}

/**
 * Split `total` px into `count` columns that differ by at most 1px, handing the
 * remainder out one pixel at a time. Pure — no DOM — so it is unit-testable and
 * can stand in for layout when the widget has not been measured yet.
 */
export function evenColumnWidths(count: number, total: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

function buildTableMarkdown(header: string[], rows: string[][]): string {
  const headerLine = `| ${header.join(' | ')} |`;
  const sepLine = `| ${header.map(() => '---').join(' | ')} |`;
  const bodyLines = rows.map((row) => `| ${row.join(' | ')} |`);
  return [headerLine, sepLine, ...bodyLines].join('\n');
}

export { renderCellText, sanitizeCellText } from './cell-text';

/** Map a `mdb-bg-*` span class onto the `<td>` background class. */
function cellBackgroundClass(colorClass: string): string {
  return colorClass.replace('mdb-bg-', 'cm-table-cell-bg-');
}

/**
 * In-flight pointer drag for a table cell selection.
 *
 * `moved` flips true as soon as the pointer reaches a different cell, which is
 * what separates a drag (keep the range, no editor) from a plain click (open
 * the cell editor on release).
 */
interface CellDragState {
  readonly tableIndex: number;
  readonly anchorRow: number;
  readonly anchorCol: number;
  moved: boolean;
}

const activeCellDrags = new Map<EditorView, CellDragState>();

/**
 * Staged cell text, keyed by view then `tableIndex:row:col`.
 *
 * Kept on the view rather than the widget because CM6 rebuilds widget DOM — and
 * widget instances — on updates; staging that survives a rebuild must not.
 */
interface PendingCell {
  tableIndex: number;
  row: number;
  col: number;
  text: string;
}

const dirtyCells = new WeakMap<EditorView, Map<string, PendingCell>>();

const externalFlushWired = new WeakSet<EditorView>();

/** Views with a flush already queued — stops settle points stacking timers. */
const flushScheduled = new WeakSet<EditorView>();

/** Views mid-dispatch — makes a re-entrant flush during the update a no-op. */
const flushingViews = new WeakSet<EditorView>();

/**
 * Queue a flush for the next macrotask.
 *
 * Dispatching is illegal while CM6 is mid-update — it throws "Calls to
 * EditorView.update are not allowed while an update is in progress" — and the
 * widget/plugin teardown hooks run exactly there. Deferring lets the staged
 * text go out on the next tick instead of being swallowed by a catch.
 */
export function scheduleTableFlush(view: EditorView): void {
  if (flushScheduled.has(view)) return;
  flushScheduled.add(view);
  setTimeout(() => {
    flushScheduled.delete(view);
    flushDirtyTables(view);
  }, 0);
}

/**
 * Write every staged cell back to the document in a single transaction.
 *
 * Returns true when a transaction was dispatched. Safe to call from any settle
 * point (and safe when nothing is dirty — it no-ops), which is what lets
 * several listeners race without double-writing.
 */
export function flushDirtyTables(view: EditorView): boolean {
  const pending = dirtyCells.get(view);
  if (!pending || pending.size === 0 || flushingViews.has(view)) return false;

  const docText = view.state.doc.toString();
  const changes: { from: number; to: number; insert: string }[] = [];
  for (const cell of pending.values()) {
    const range = tableCellRange(docText, cell.tableIndex, cell.row, cell.col);
    if (!range) continue;
    const insert = sanitizeCellText(cell.text);
    if (insert === docText.slice(range.from, range.to)) continue;
    changes.push({ from: range.from, to: range.to, insert });
  }

  if (changes.length === 0) {
    pending.clear();
    return false;
  }

  // CM6 requires ascending, non-overlapping changes. Cells never overlap, so
  // sorting by start position is sufficient.
  changes.sort((a, b) => a.from - b.from);
  flushingViews.add(view);
  try {
    view.dispatch({ changes });
  } catch {
    // Only reachable from inside an update cycle: keep the staged text and let
    // the deferred flush retry once CM6 is idle again.
    scheduleTableFlush(view);
    return false;
  } finally {
    flushingViews.delete(view);
  }
  pending.clear();
  return true;
}

function markDirty(
  view: EditorView,
  tableIndex: number,
  row: number,
  col: number,
  text: string,
): void {
  let pending = dirtyCells.get(view);
  if (!pending) {
    pending = new Map<string, PendingCell>();
    dirtyCells.set(view, pending);
  }
  pending.set(`${tableIndex}:${row}:${col}`, { tableIndex, row, col, text });
}

function clearDirty(view: EditorView, tableIndex: number, row: number, col: number): void {
  dirtyCells.get(view)?.delete(`${tableIndex}:${row}:${col}`);
}

// --- Cell-level write-backs (merge / background) -----------------------------

/** Read a cell's raw source text from a parsed block (`row === -1` = header). */
function readCell(block: TableBlock, row: number, col: number): string {
  if (row === -1) return block.header[col] ?? '';
  return block.rows[row]?.[col] ?? '';
}

/**
 * Merge the selected rectangle into its top-left cell.
 *
 * GFM pipe tables have no colspan, so "merge" is DEFINED as: concatenate the
 * non-empty texts of the selected cells with a single space, write the joined
 * text into the top-left cell, and empty every other cell in the region. The
 * whole table block is replaced in ONE transaction. The selection then
 * collapses to the top-left cell, so the merge action becomes disabled.
 *
 * Returns true when a transaction was dispatched.
 */
export function mergeTableCellSelection(
  view: EditorView,
  tableIndex: number,
  rect: CellRect,
): boolean {
  flushDirtyTables(view);
  const block = findTables(view.state.doc.toString())[tableIndex];
  if (!block) return false;

  const parts: string[] = [];
  for (let row = rect.minRow; row <= rect.maxRow; row += 1) {
    for (let col = rect.minCol; col <= rect.maxCol; col += 1) {
      const text = readCell(block, row, col).trim();
      if (text) parts.push(text);
    }
  }
  const joined = parts.join(' ');

  const header = [...block.header];
  const rows = block.rows.map((row) => [...row]);
  const writeCell = (row: number, col: number, value: string): void => {
    if (row === -1) header[col] = value;
    else rows[row][col] = value;
  };
  for (let row = rect.minRow; row <= rect.maxRow; row += 1) {
    for (let col = rect.minCol; col <= rect.maxCol; col += 1) {
      writeCell(row, col, '');
    }
  }
  writeCell(rect.minRow, rect.minCol, joined);

  view.dispatch({
    changes: { from: block.from, to: block.to, insert: buildTableMarkdown(header, rows) },
  });
  setCellSelection(view, {
    tableIndex,
    anchorRow: rect.minRow,
    anchorCol: rect.minCol,
    headRow: rect.minRow,
    headCol: rect.minCol,
  });
  return true;
}

/**
 * Apply (or clear) a background on every cell of the selected rectangle.
 *
 * `colorClass` is an `mdb-bg-*` span class, or null to clear. Each cell's
 * existing background wrapper is stripped first, so switching colors replaces
 * rather than nests, and clearing leaves no residual class. ONE transaction.
 *
 * Returns true when a transaction was dispatched.
 */
export function setCellBackground(
  view: EditorView,
  tableIndex: number,
  rect: CellRect,
  colorClass: string | null,
): boolean {
  flushDirtyTables(view);
  const block = findTables(view.state.doc.toString())[tableIndex];
  if (!block) return false;

  const header = [...block.header];
  const rows = block.rows.map((row) => [...row]);
  let changed = false;
  for (let row = rect.minRow; row <= rect.maxRow; row += 1) {
    for (let col = rect.minCol; col <= rect.maxCol; col += 1) {
      const current = readCell(block, row, col);
      const inner = stripCellBackground(current);
      const next = colorClass ? `<span class="${colorClass}">${inner}</span>` : inner;
      if (next === current) continue;
      changed = true;
      if (row === -1) header[col] = next;
      else rows[row][col] = next;
    }
  }
  if (!changed) return false;

  view.dispatch({
    changes: { from: block.from, to: block.to, insert: buildTableMarkdown(header, rows) },
  });
  return true;
}

/**
 * Toggle `.cm-table-cell-selected` on every live cell from the stored
 * selection. Called after a raw drag event (no CM6 transaction) so the range
 * highlights immediately; `buildCell`/`updateDOM` re-apply it after a rebuild.
 */
export function paintCellSelection(view: EditorView): void {
  const selection = getCellSelection(view);
  const tables = view.dom.querySelectorAll<HTMLTableElement>('table.cm-table');
  tables.forEach((table, tableIndex) => {
    const cells = table.querySelectorAll<HTMLElement>('th[data-row], td[data-row]');
    cells.forEach((cell) => {
      const row = Number(cell.dataset.row);
      const col = Number(cell.dataset.col);
      const selected =
        selection !== null &&
        selection.tableIndex === tableIndex &&
        isCellInSelection(selection, row, col);
      cell.classList.toggle('cm-table-cell-selected', selected);
    });
  });
}

/**
 * ViewPlugin that repaints selection classes whenever the view-level selection
 * changes. Kept separate from the toolbar so the highlight works even if the
 * toolbar is not mounted.
 */
export function tableCellSelectionPainter(): Extension {
  return ViewPlugin.fromClass(
    class {
      private readonly unsubscribe: () => void;

      constructor(private readonly view: EditorView) {
        this.unsubscribe = subscribeCellSelection(view, () => paintCellSelection(view));
      }

      destroy(): void {
        this.unsubscribe();
        activeCellDrags.delete(this.view);
      }
    },
  );
}

/**
 * Open the inline `<input>` editor for one cell.
 *
 * Module scope (not a widget closure) because the click resolves on the
 * DOCUMENT mouseup: the widget may have been rebuilt during mousedown capture,
 * so the live cell is looked up by row/col rather than through a captured DOM
 * node.
 *
 * The editor is a real `<input>`, not a nested `contenteditable`: a form
 * control is never part of CM6's editable region, emits no DOM mutations its
 * observer could act on, and has native focus, caret, IME and undo.
 */
function openCellEditor(
  view: EditorView,
  tableIndex: number,
  row: number,
  col: number,
): void {
  flushDirtyTables(view);
  const table = view.dom.querySelectorAll('.cm-table')[tableIndex];
  const host = table?.querySelector(`[data-row="${row}"][data-col="${col}"]`);
  if (!(host instanceof HTMLElement)) return;
  const existing = host.querySelector('.cm-table-cell-input') as HTMLInputElement | null;
  if (existing) {
    existing.focus();
    return;
  }
  // Preserve a cell background across an edit: the input shows the inner text,
  // and staged text re-wraps it in the same span so the color is not lost.
  const backgroundClass = host.dataset.cellBg ?? null;
  const span = host.querySelector<HTMLElement>('.cm-table-cell-text');
  const initial = span?.dataset.rawText ?? span?.textContent ?? '';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'cm-table-cell-input';
  input.setAttribute('data-testid', 'cm-table-cell-input');
  input.value = initial;
  host.classList.add('cm-table-cell-editing');
  host.insertBefore(input, host.querySelector('.cm-table-cell-handle'));
  input.focus();
  input.setSelectionRange(initial.length, initial.length);

  let composing = false;
  const stage = (): void => {
    const text = backgroundClass
      ? `<span class="${backgroundClass}">${input.value}</span>`
      : input.value;
    markDirty(view, tableIndex, row, col, text);
  };
  const teardown = (): void => {
    input.remove();
    host.classList.remove('cm-table-cell-editing');
  };
  const commit = (): void => {
    if (!input.isConnected) return;
    teardown();
    flushDirtyTables(view);
    clearDirty(view, tableIndex, row, col);
  };

  input.addEventListener('compositionstart', () => {
    composing = true;
  });
  input.addEventListener('compositionend', () => {
    composing = false;
    stage();
  });
  input.addEventListener('input', stage);
  input.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      clearDirty(view, tableIndex, row, col);
      teardown();
    }
  });
  input.addEventListener('blur', () => {
    if (!composing) commit();
  });
  input.addEventListener('mousedown', (event) => event.stopPropagation());
}

/**
 * Settle every in-flight cell drag on pointer release.
 *
 * A drag that never reached another cell is a plain click: the editor opens on
 * the next frame, after the widget has settled. A drag that did move keeps the
 * range selected and opens nothing.
 */
if (typeof document !== 'undefined') {
  document.addEventListener('mouseup', () => {
    for (const [view, drag] of [...activeCellDrags]) {
      activeCellDrags.delete(view);
      if (drag.moved) continue;
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() =>
          openCellEditor(view, drag.tableIndex, drag.anchorRow, drag.anchorCol),
        );
      } else {
        openCellEditor(view, drag.tableIndex, drag.anchorRow, drag.anchorCol);
      }
    }
  });
}

// --- Widget ------------------------------------------------------------------

class TableWidget extends WidgetType {
  header: string[];
  rows: string[][];
  cells: CellSpan[];
  from: number;
  to: number;
  readonly tableIndex: number;
  private view: EditorView | null = null;

  constructor(block: TableBlock) {
    super();
    this.header = block.header;
    this.rows = block.rows;
    this.cells = block.cells;
    this.from = block.from;
    this.to = block.to;
    this.tableIndex = block.index;
  }

  /** Re-read the table from the CURRENT document — offsets move after a flush. */
  private currentBlock(view: EditorView): TableBlock | null {
    return findTables(view.state.doc.toString())[this.tableIndex] ?? null;
  }

  private cellText(row: number, col: number): string {
    if (row === -1) return this.header[col] ?? '';
    return this.rows[row]?.[col] ?? '';
  }

  private rewrite(view: EditorView, block: TableBlock, header: string[], rows: string[][]): void {
    view.dispatch({
      changes: { from: block.from, to: block.to, insert: buildTableMarkdown(header, rows) },
    });
  }

  private addColumn(view: EditorView, at: number): void {
    flushDirtyTables(view);
    const block = this.currentBlock(view);
    if (!block) return;
    const header = [...block.header];
    header.splice(at, 0, '');
    const rows = block.rows.map((row) => {
      const next = [...row];
      next.splice(at, 0, '');
      return next;
    });
    this.rewrite(view, block, header, rows);
    view.focus();
  }

  private addRow(view: EditorView, at: number): void {
    flushDirtyTables(view);
    const block = this.currentBlock(view);
    if (!block) return;
    const rows = block.rows.map((row) => [...row]);
    rows.splice(at, 0, new Array(block.header.length).fill(''));
    this.rewrite(view, block, [...block.header], rows);
    view.focus();
  }

  /** Open the anchored INSERT menu over a cell, anchored to that cell's range. */
  private openCellMenu(view: EditorView, row: number, col: number): void {
    flushDirtyTables(view);
    const block = this.currentBlock(view);
    const cell = block?.cells.find((c) => c.row === row && c.col === col);
    if (!cell) return;
    // Zero-width anchor: the menu inserts at the cell start and the anchor
    // range is the cell body, so closing the menu can never eat cell text.
    openInsertMenu(view, cell.from, defaultCommands, { from: cell.from, to: cell.to });
  }

  toDOM(view?: EditorView): HTMLElement {
    this.view = view ?? null;
    const wrap = document.createElement('div');
    wrap.className = 'cm-table-wrap';
    // Take the table out of CM6's editable region: without this the browser
    // places a native caret into the enclosing contenteditable when a cell gap
    // is clicked, and the keystrokes land in CM6's discarded DOM.
    wrap.setAttribute('contenteditable', 'false');

    const table = document.createElement('table');
    table.className = 'cm-table';
    table.setAttribute('data-testid', 'cm-table');

    // ── Header row ────────────────────────────────────────────────────────
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    this.header.forEach((text, col) => {
      headRow.appendChild(this.buildCell(view ?? null, 'th', -1, col, text));
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    // ── Body rows ─────────────────────────────────────────────────────────
    const tbody = document.createElement('tbody');
    this.rows.forEach((row, r) => {
      const tr = document.createElement('tr');
      row.forEach((text, col) => {
        tr.appendChild(this.buildCell(view ?? null, 'td', r, col, text));
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    wrap.appendChild(table);

    const boundaries = document.createElement('div');
    boundaries.className = 'cm-table-boundaries';
    wrap.appendChild(boundaries);

    if (view) {
      this.wireExternalFlush(view);
      // Reveal is per-boundary: the hotspot nearest the pointer appears, the
      // rest stay hidden, and leaving the widget clears them (#385a).
      this.wireBoundaryReveal(wrap, boundaries);
      // Layout is not available synchronously inside toDOM, so measure on the
      // next frame. rAF may be absent (node-env unit tests).
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => this.renderBoundaries(boundaries, wrap, table, view));
      } else {
        this.renderBoundaries(boundaries, wrap, table, view);
      }
    }

    return wrap;
  }

  /** Build one `th`/`td` with its text span and insert handle. */
  private buildCell(
    view: EditorView | null,
    tag: 'th' | 'td',
    row: number,
    col: number,
    text: string,
  ): HTMLElement {
    const el = document.createElement(tag);
    el.dataset.row = String(row);
    el.dataset.col = String(col);
    if (this.cells.some((c) => c.active && c.row === row && c.col === col)) {
      el.classList.add('cm-table-cell-active');
    }

    // A cell whose whole text is an `mdb-bg-*` span paints the cell itself
    // and shows only the inner text — the span markup never reaches the DOM.
    const background = parseCellBackground(text);
    if (background) {
      el.dataset.cellBg = background.colorClass;
      el.classList.add(cellBackgroundClass(background.colorClass));
    }

    const body = document.createElement('span');
    body.className = 'cm-table-cell-text';
    body.setAttribute('data-testid', 'cm-table-cell-text');
    body.dataset.row = String(row);
    body.dataset.col = String(col);
    const displayText = background ? background.inner : text;
    body.dataset.rawText = displayText;
    body.innerHTML = renderCellText(displayText);
    el.appendChild(body);

    const selection = view ? getCellSelection(view) : null;
    if (
      selection &&
      selection.tableIndex === this.tableIndex &&
      isCellInSelection(selection, row, col)
    ) {
      el.classList.add('cm-table-cell-selected');
    }

    const handle = document.createElement('div');
    // Two class aliases: `.cm-table-cell-handle` is the wiring/outside-click
    // guard (`slash.ts`), `.mdb-table-cell-handle` is the public conformance
    // anchor (R-TABLE-04). Both name the same node.
    handle.className = 'cm-table-cell-handle mdb-table-cell-handle';
    handle.setAttribute('data-testid', 'cm-table-cell-handle');
    handle.dataset.row = String(row);
    handle.dataset.col = String(col);
    handle.title = '插入内容';
    el.appendChild(handle);

    if (view) this.wireCell(view, el, handle, row, col);
    return el;
  }

  /**
   * Match the live `<table>` shape to the current header/rows without
   * recreating the cells that already exist (#385c). The insertion path used to
   * return a false `eq` whenever a dimension changed, so CM6 threw the whole
   * widget away and built it again — every cell, every handle listener, plus a
   * fresh boundary pass — for what is a one-row/one-column delta. New cells are
   * built and wired; surplus cells are dropped; surviving cells keep their
   * listeners and are refreshed by `updateDOM`.
   */
  private reconcileStructure(table: HTMLTableElement, view: EditorView): void {
    const headRow = table.tHead?.rows[0];
    if (headRow) {
      while (headRow.cells.length > this.header.length) headRow.deleteCell(-1);
      for (let col = 0; col < this.header.length; col += 1) {
        if (!headRow.cells[col]) {
          headRow.appendChild(this.buildCell(view, 'th', -1, col, this.header[col] ?? ''));
        }
      }
    }

    const tbody = table.tBodies[0];
    if (tbody) {
      while (tbody.rows.length > this.rows.length) tbody.deleteRow(-1);
      for (let r = 0; r < this.rows.length; r += 1) {
        let tr = tbody.rows[r];
        if (!tr) tr = tbody.insertRow(-1);
        while (tr.cells.length > this.header.length) tr.deleteCell(-1);
        for (let col = 0; col < this.header.length; col += 1) {
          if (!tr.cells[col]) {
            tr.appendChild(this.buildCell(view, 'td', r, col, this.rows[r]?.[col] ?? ''));
          }
        }
      }
    }
  }

  /**
   * Wire one cell: pointer selection (click = edit, drag/shift = range) plus the
   * insert handle.
   *
   * The editor itself is built by `openCellEditor` on document mouseup; this
   * wiring only tracks the selection rectangle, because a drag must not open an
   * editor. Selection lives in view-level state (`cell-selection.ts`) so it
   * survives the widget rebuild that happens during mousedown capture.
   */
  private wireCell(
    view: EditorView,
    cellEl: HTMLElement,
    handle: HTMLElement,
    row: number,
    col: number,
  ): void {
    const tableIndex = this.tableIndex;

    cellEl.addEventListener('mousedown', (event) => {
      if ((event.target as HTMLElement | null)?.closest('.cm-table-cell-handle')) return;
      event.preventDefault();
      event.stopPropagation();

      // Commit any editor still open on another cell NOW. The editor for this
      // press opens on mouseup (so a drag can select instead), and until then
      // the old input would otherwise keep focus and swallow the first keystroke.
      view.dom.querySelector<HTMLInputElement>('.cm-table-cell-input')?.blur();

      const existing = getCellSelection(view);
      if (event.shiftKey && existing && existing.tableIndex === tableIndex) {
        // Shift-click extends the current anchor to this cell; no editor opens.
        setCellSelection(view, { ...existing, headRow: row, headCol: col });
        return;
      }

      // Record the anchor. `moved` flips on the first pointer move to another
      // cell, which is what separates a drag (keep the range) from a click
      // (open the editor) when the pointer is released.
      activeCellDrags.set(view, { tableIndex, anchorRow: row, anchorCol: col, moved: false });
      const selection: CellSelection = {
        tableIndex,
        anchorRow: row,
        anchorCol: col,
        headRow: row,
        headCol: col,
      };
      setCellSelection(view, selection);
    });

    cellEl.addEventListener('mouseenter', () => {
      const drag = activeCellDrags.get(view);
      if (!drag || drag.tableIndex !== tableIndex) return;
      if (row === drag.anchorRow && col === drag.anchorCol) return;
      drag.moved = true;
      setCellSelection(view, {
        tableIndex,
        anchorRow: drag.anchorRow,
        anchorCol: drag.anchorCol,
        headRow: row,
        headCol: col,
      });
    });

    // Handle: press opens, hover only marks the affordance. Opening on mere
    // enter fired the insert menu when the pointer merely brushed the handle
    // (#385b) — worst at the last column, whose handle sits on the wrap edge.
    handle.addEventListener('mouseenter', () => {
      handle.classList.add('cm-table-cell-handle-active');
    });
    handle.addEventListener('mouseleave', () => {
      handle.classList.remove('cm-table-cell-handle-active');
    });
    handle.addEventListener('mousedown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      handle.classList.add('cm-table-cell-handle-active');
      this.openCellMenu(view, row, col);
    });
  }

  /**
   * Settle staged cells when a pointer press lands outside every cell. Capture
   * phase so it still fires when a cell's own listener stops propagation.
   */
  private wireExternalFlush(view: EditorView): void {
    if (externalFlushWired.has(view)) return;
    externalFlushWired.add(view);
    view.dom.addEventListener(
      'mousedown',
      (event) => {
        const target = event.target as HTMLElement | null;
        if (target?.closest?.('.cm-table-wrap')) return;
        if (target?.closest?.('.mdb-slash-menu')) return;
        // The cell toolbar lives outside the wrap; a press on it must keep the
        // cell selection alive for the action it is about to run.
        if (target?.closest?.('.mdb-cell-toolbar')) return;
        flushDirtyTables(view);
        clearCellSelection(view);
      },
      true,
    );
  }

  /**
   * Reveal only the insertion hotspot for the boundary the pointer is near
   * (#385a). The previous gate lit every hotspot as soon as a cell was
   * entered; the desired behaviour is the hovered row/column line alone.
   *
   * A column boundary's x and a row boundary's y are already on the element as
   * inline offsets, so a mousemove needs one container rect read, not one
   * layout read per boundary. The work is coalesced into a frame.
   */
  private wireBoundaryReveal(wrap: HTMLElement, boundaries: HTMLElement): void {
    let frame = 0;
    let pointerX = 0;
    let pointerY = 0;

    const clear = (): void => {
      for (const hotspot of boundaries.querySelectorAll('.cm-table-hotspot-revealed')) {
        hotspot.classList.remove('cm-table-hotspot-revealed');
      }
    };

    const update = (): void => {
      frame = 0;
      const rect = boundaries.getBoundingClientRect();
      const x = pointerX - rect.left;
      const y = pointerY - rect.top;
      const half = BOUNDARY_THICKNESS / 2;
      let nearCol: HTMLElement | null = null;
      let nearRow: HTMLElement | null = null;
      let colDist = BOUNDARY_REVEAL_DISTANCE;
      let rowDist = BOUNDARY_REVEAL_DISTANCE;

      for (const boundary of boundaries.querySelectorAll<HTMLElement>('.cm-table-boundary')) {
        const hotspot = boundary.querySelector<HTMLElement>('.cm-table-hotspot');
        if (!hotspot) continue;
        if (boundary.dataset.type === 'col') {
          const dist = Math.abs(x - (parseFloat(boundary.style.left) + half));
          if (dist <= colDist) {
            colDist = dist;
            nearCol = hotspot;
          }
        } else {
          const dist = Math.abs(y - (parseFloat(boundary.style.top) + half));
          if (dist <= rowDist) {
            rowDist = dist;
            nearRow = hotspot;
          }
        }
      }

      for (const hotspot of boundaries.querySelectorAll<HTMLElement>('.cm-table-hotspot')) {
        hotspot.classList.toggle('cm-table-hotspot-revealed', hotspot === nearCol || hotspot === nearRow);
      }
    };

    wrap.addEventListener('mousemove', (event) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (frame) return;
      if (typeof requestAnimationFrame === 'function') frame = requestAnimationFrame(update);
      else update();
    });
    wrap.addEventListener('mouseleave', () => {
      if (frame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
      frame = 0;
      clear();
    });
  }

  /**
   * Build the insertion-boundary layer over the measured table.
   *
   * One `.cm-table-boundary` strip sits exactly ON each boundary: a vertical
   * strip on every interior column boundary and a horizontal strip on every
   * body row's top edge (F-03 geometry). The strip itself is `pointer-events: none`
   * so the 6px layer can never swallow a click meant for a cell interior; only
   * the small hotspot dot inside it takes the pointer, and only once the
   * pointer is near that boundary (F-04 / R-TABLE-03, per-boundary since
   * #385a). Each hotspot inserts before its own ordinal: `data-col` →
   * addColumn(index), `data-row` → addRow(index).
   *
   * Falls back to `evenColumnWidths` when the table has not been laid out, so
   * the layer still carries the correct ordinal geometry in jsdom.
   */
  private renderBoundaries(
    container: HTMLElement,
    wrap: HTMLElement,
    table: HTMLTableElement,
    view: EditorView,
  ): void {
    if (!container.isConnected && wrap.isConnected) return;
    container.textContent = '';

    const wrapRect = wrap.getBoundingClientRect();
    const tableRect = table.getBoundingClientRect();
    const measured = tableRect.width > 0 && tableRect.height > 0;
    const originX = measured ? tableRect.left - wrapRect.left : 0;
    const originY = measured ? tableRect.top - wrapRect.top : 0;
    const totalWidth = measured ? tableRect.width : FALLBACK_TABLE_WIDTH;
    const totalHeight = measured ? tableRect.height : FALLBACK_ROW_HEIGHT * (this.rows.length + 1);

    const addBoundary = (
      kind: 'col' | 'row',
      index: number,
      left: number,
      top: number,
      width: number,
      height: number,
    ): void => {
      const boundary = document.createElement('div');
      boundary.className = `cm-table-boundary cm-table-boundary-${kind}`;
      boundary.setAttribute('data-testid', 'cm-table-boundary');
      boundary.dataset.type = kind;
      if (kind === 'col') boundary.dataset.col = String(index);
      else boundary.dataset.row = String(index);
      boundary.style.position = 'absolute';
      boundary.style.left = `${left}px`;
      boundary.style.top = `${top}px`;
      boundary.style.width = `${width}px`;
      boundary.style.height = `${height}px`;
      boundary.style.pointerEvents = 'none';
      boundary.style.zIndex = '5';

      // A 2px rule along the boundary, revealed on hover (this is the
      // "boundary highlight line" — never a full row/column background fill).
      const line = document.createElement('div');
      line.className = 'cm-table-boundary-line';
      boundary.appendChild(line);

      const hotspot = document.createElement('div');
      hotspot.className = `cm-table-hotspot cm-table-hotspot-${kind}`;
      hotspot.setAttribute('data-testid', 'cm-table-hotspot');
      hotspot.dataset.type = kind;
      if (kind === 'col') hotspot.dataset.col = String(index);
      else hotspot.dataset.row = String(index);
      hotspot.title = kind === 'col' ? '插入列' : '插入行';

      const dot = document.createElement('span');
      dot.className = 'cm-table-hotspot-dot';
      dot.textContent = '＋';
      hotspot.appendChild(dot);

      const bubble = document.createElement('span');
      bubble.className = 'cm-table-hotspot-bubble';
      bubble.textContent = kind === 'col' ? '插入列' : '插入行';
      hotspot.appendChild(bubble);

      hotspot.addEventListener('mouseenter', () => {
        boundary.classList.add('cm-table-boundary-active');
        hotspot.classList.add('cm-table-hotspot-active');
        // Engage the strip only while the pointer is on the dot (within ~8px
        // of the boundary), so cell interiors keep the pointer everywhere else.
        boundary.style.pointerEvents = 'auto';
      });
      hotspot.addEventListener('mouseleave', () => {
        boundary.classList.remove('cm-table-boundary-active');
        hotspot.classList.remove('cm-table-hotspot-active');
        boundary.style.pointerEvents = 'none';
      });
      hotspot.addEventListener('mousedown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (kind === 'col') this.addColumn(view, index);
        else this.addRow(view, index);
      });
      boundary.appendChild(hotspot);
      container.appendChild(boundary);
    };

    const half = BOUNDARY_THICKNESS / 2;
    const fallbackWidths = evenColumnWidths(this.header.length, totalWidth);
    const head = table.rows[0];

    // Batch every layout read before creating any node: interleaving the two
    // forced a reflow per boundary, which made an insert stutter (#385c).
    const colX: (number | null)[] = [];
    if (measured && head) {
      for (let col = 1; col < this.header.length; col += 1) {
        const cell = head.cells[col];
        colX.push(cell ? cell.getBoundingClientRect().left - tableRect.left : null);
      }
    }
    const rowY: (number | null)[] = [];
    if (measured) {
      for (let r = 0; r < this.rows.length; r += 1) {
        const tr = table.rows[r + 1];
        rowY.push(tr ? tr.getBoundingClientRect().top - tableRect.top : null);
      }
    }

    // ── Column boundaries: interior only (between two columns) ────────────
    // Starting at col 1 keeps the hotspot inside the table, so its dot and
    // bubble are never clipped by the wrap's edge (§7.4 "两列之间").
    for (let col = 1; col < this.header.length; col += 1) {
      const fallbackLeft = fallbackWidths.slice(0, col).reduce((a, b) => a + b, 0);
      // A merged or unrendered cell has no rect; keep the boundary on the
      // even-division position instead of collapsing it onto the leading edge.
      const x = colX[col - 1] ?? fallbackLeft;
      addBoundary('col', col, originX + x - half, originY, BOUNDARY_THICKNESS, totalHeight);
    }

    // ── Row boundaries: the top edge of every body row ────────────────────
    for (let r = 0; r < this.rows.length; r += 1) {
      const y = rowY[r] ?? ((r + 1) / (this.rows.length + 1)) * totalHeight;
      addBoundary('row', r, originX, originY + y - half, totalWidth, BOUNDARY_THICKNESS);
    }
  }

  /**
   * Adopt the new state while KEEPING the existing DOM.
   *
   * Mutating `this` inside `eq` is the only place CM6 hands us the new state
   * while keeping our DOM. Returning false for a content or dimension change
   * routes CM6 through `updateDOM`, which reconciles the structure in place
   * (#385c) instead of discarding and rebuilding every cell; only a different
   * table ordinal forces a fresh draw, because the DOM is table-specific.
   */
  eq(other: WidgetType): boolean {
    if (!(other instanceof TableWidget)) return false;
    if (this.tableIndex !== other.tableIndex) return false;
    if (this.header.length !== other.header.length) return false;
    if (this.rows.length !== other.rows.length) return false;
    if (JSON.stringify(this.header) !== JSON.stringify(other.header)) return false;
    if (JSON.stringify(this.rows) !== JSON.stringify(other.rows)) return false;
    this.header = other.header;
    this.rows = other.rows;
    this.cells = other.cells;
    this.from = other.from;
    this.to = other.to;
    return true;
  }

  updateDOM(dom: HTMLElement, view: EditorView): boolean {
    this.view = view;
    const wrap = dom as HTMLElement;
    const table = wrap.querySelector<HTMLTableElement>('table.cm-table');
    const boundaries = wrap.querySelector<HTMLElement>('.cm-table-boundaries');
    if (!table || !boundaries) return false;

    // Grow/shrink the DOM to the new dimensions before refreshing text: cells
    // are addressed by data-row/data-col, so reused cells need no rebuild.
    this.reconcileStructure(table, view);

    const selection = getCellSelection(view);
    // Skip the cell that is being edited: its text lives in the input until the
    // edit settles, so refreshing it from the document here would clobber it.
    for (const cell of this.cells) {
      const body = wrap.querySelector<HTMLElement>(
        `.cm-table-cell-text[data-row="${cell.row}"][data-col="${cell.col}"]`,
      );
      if (!body) continue;
      const cellEl = body.parentElement;
      if (cellEl && !cellEl.querySelector('.cm-table-cell-input')) {
        const raw = this.cellText(cell.row, cell.col);
        const background = parseCellBackground(raw);
        const displayText = background ? background.inner : raw;
        const previousRaw = body.dataset.rawText ?? '';
        if (previousRaw !== displayText) {
          body.dataset.rawText = displayText;
          body.innerHTML = renderCellText(displayText);
        }
        if (background) {
          cellEl.dataset.cellBg = background.colorClass;
          cellEl.classList.add(cellBackgroundClass(background.colorClass));
        } else {
          delete cellEl.dataset.cellBg;
          for (const cls of [...cellEl.classList]) {
            if (cls.startsWith('cm-table-cell-bg-')) cellEl.classList.remove(cls);
          }
        }
      }
      if (cellEl) {
        cellEl.classList.toggle('cm-table-cell-active', cell.active);
        const selected =
          selection !== null &&
          selection.tableIndex === this.tableIndex &&
          isCellInSelection(selection, cell.row, cell.col);
        cellEl.classList.toggle('cm-table-cell-selected', selected);
      }
    }

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => this.renderBoundaries(boundaries, wrap, table, view));
    } else {
      this.renderBoundaries(boundaries, wrap, table, view);
    }
    return true;
  }

  /**
   * The widget went away (table deleted, or the editor is being torn down for a
   * mode switch). Drop any anchored menu it owns instead of leaving an orphaned
   * panel floating over another view.
   */
  destroy(): void {
    if (!this.view) return;
    releaseInsertMenu(this.view, 'anchor');
    // Teardown runs inside a CM6 update, so a synchronous flush would throw and
    // lose staged text. Defer it instead (a no-op when nothing is staged).
    scheduleTableFlush(this.view);
  }

  /**
   * Keep CM6's own handlers out of the widget DOM. This matches the default and
   * is stated explicitly so the isolation the cells rely on is not silent.
   */
  ignoreEvent(): boolean {
    return true;
  }
}

// --- Decoration factory ------------------------------------------------------

export function createTableDecorations(
  docText: string,
  activeFrom: number = -1,
  activeTo: number = -1,
): Range<Decoration>[] {
  const decorations: Range<Decoration>[] = [];
  const activity: CellActivity = {
    from: activeFrom,
    to: activeTo,
    active: activeFrom >= 0,
  };

  for (const table of findTables(docText, activity)) {
    decorations.push(
      Decoration.replace({ widget: new TableWidget(table) }).range(table.from, table.to),
    );
  }

  return decorations;
}