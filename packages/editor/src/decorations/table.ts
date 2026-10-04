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
import type { Range } from '@codemirror/state';
import { Decoration, WidgetType, type EditorView } from '@codemirror/view';
import { defaultCommands, openInsertMenu, releaseInsertMenu } from '../slash';
import { sanitizeCellText } from './cell-text';

const TABLE_ROW_RE = /^\s*\|.*\|\s*$/;
const TABLE_SEP_RE = /^\s*\|(\s*:?-+:?\s*\|)+\s*$/;

/** Fallback geometry used before layout is measurable (hidden line / jsdom). */
const FALLBACK_TABLE_WIDTH = 600;
const FALLBACK_ROW_HEIGHT = 32;
const BOUNDARY_THICKNESS = 6;

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

export { sanitizeCellText };

function cellKey(row: number, col: number): string {
  return `${row}:${col}`;
}

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

  private rewrite(view: EditorView, header: string[], rows: string[][]): void {
    const block = this.currentBlock(view);
    if (!block) return;
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
    this.rewrite(view, header, rows);
    view.focus();
  }

  private addRow(view: EditorView, at: number): void {
    flushDirtyTables(view);
    const block = this.currentBlock(view);
    if (!block) return;
    const rows = block.rows.map((row) => [...row]);
    rows.splice(at, 0, new Array(block.header.length).fill(''));
    this.rewrite(view, [...block.header], rows);
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

    const activeKey = (() => {
      const active = this.cells.find((c) => c.active);
      return active ? cellKey(active.row, active.col) : null;
    })();

    /** Build one `th`/`td` with its text span and insert handle. */
    const buildCell = (
      tag: 'th' | 'td',
      row: number,
      col: number,
      text: string,
    ): HTMLElement => {
      const key = cellKey(row, col);
      const el = document.createElement(tag);
      el.dataset.row = String(row);
      el.dataset.col = String(col);
      if (key === activeKey) el.classList.add('cm-table-cell-active');

      const body = document.createElement('span');
      body.className = 'cm-table-cell-text';
      body.setAttribute('data-testid', 'cm-table-cell-text');
      body.dataset.row = String(row);
      body.dataset.col = String(col);
      body.textContent = text;
      el.appendChild(body);

      const handle = document.createElement('div');
      handle.className = 'cm-table-cell-handle';
      handle.setAttribute('data-testid', 'cm-table-cell-handle');
      handle.dataset.row = String(row);
      handle.dataset.col = String(col);
      handle.title = '插入内容';
      el.appendChild(handle);

      if (view) this.wireCell(view, el, handle, row, col);
      return el;
    };

    // ── Header row ────────────────────────────────────────────────────────
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    this.header.forEach((text, col) => {
      headRow.appendChild(buildCell('th', -1, col, text));
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    // ── Body rows ─────────────────────────────────────────────────────────
    const tbody = document.createElement('tbody');
    this.rows.forEach((row, r) => {
      const tr = document.createElement('tr');
      row.forEach((text, col) => {
        const td = buildCell('td', r, col, text);
        if (col === 0) {
          const add = document.createElement('button');
          add.type = 'button';
          add.className = 'cm-table-add-row';
          add.setAttribute('data-testid', 'cm-table-add-row');
          add.setAttribute('data-row', String(r));
          add.title = '在此行上方插入一行';
          add.textContent = '＋';
          add.addEventListener('mousedown', (event) => {
            if (!view) return;
            // A control click must not blur the cell and lose staged text.
            event.preventDefault();
            event.stopPropagation();
            this.addRow(view, r);
          });
          td.appendChild(add);
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    // ── Column add hotzones ───────────────────────────────────────────────
    const colBar = document.createElement('div');
    colBar.className = 'cm-table-col-hotzones';
    this.header.forEach((_, col) => {
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'cm-table-add-col';
      add.setAttribute('data-testid', 'cm-table-add-col');
      add.setAttribute('data-col', String(col));
      add.title = '在此列左侧插入一列';
      add.textContent = '＋';
      add.addEventListener('mousedown', (event) => {
        if (!view) return;
        event.preventDefault();
        event.stopPropagation();
        this.addColumn(view, col);
      });
      colBar.appendChild(add);
    });

    wrap.appendChild(colBar);
    wrap.appendChild(table);

    const boundaries = document.createElement('div');
    boundaries.className = 'cm-table-boundaries';
    wrap.appendChild(boundaries);

    if (view) {
      this.wireExternalFlush(view);
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

  /**
   * Wire one cell: click to edit, dirty staging, settle-on-blur.
   *
   * The editor is a real `<input>`, not a nested `contenteditable`: a form
   * control is never part of CM6's editable region, emits no DOM mutations its
   * observer could act on, and has native focus, caret, IME and undo. Building
   * and focusing it in the same task avoids the DOM-generation race that made a
   * `focus()` against a cached node silently no-op.
   */
  private wireCell(
    view: EditorView,
    cellEl: HTMLElement,
    handle: HTMLElement,
    row: number,
    col: number,
  ): void {
    const tableIndex = this.tableIndex;

    const openEditor = (): void => {
      // Commit any open cell first: focusing the new input fires the old input's
      // blur, whose flush would rebuild the table widget and detach the input we
      // are about to place. Flushing up front keeps this open on live DOM.
      flushDirtyTables(view);
      const table = view.dom.querySelectorAll('.cm-table')[tableIndex];
      const host = table?.querySelector(`[data-row="${row}"][data-col="${col}"]`);
      if (!(host instanceof HTMLElement)) return;
      const existing = host.querySelector('.cm-table-cell-input') as HTMLInputElement | null;
      if (existing) {
        existing.focus();
        return;
      }
      const span = host.querySelector('.cm-table-cell-text');
      const initial = span?.textContent ?? '';
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
      const teardown = (): void => {
        input.remove();
        host.classList.remove('cm-table-cell-editing');
      };
      const commit = (): void => {
        // A structural flush may have rebuilt the widget, taking this input with
        // it — then the document already holds the text and there is nothing to do.
        if (!input.isConnected) return;
        flushDirtyTables(view);
        clearDirty(view, tableIndex, row, col);
        if (span) span.textContent = input.value;
        teardown();
      };

      input.addEventListener('compositionstart', () => {
        composing = true;
      });
      input.addEventListener('compositionend', () => {
        composing = false;
        markDirty(view, tableIndex, row, col, input.value);
      });
      input.addEventListener('input', () => {
        markDirty(view, tableIndex, row, col, input.value);
      });
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
    };

    // Open on mousedown, but resolve the cell after a frame: CM6 may rebuild the
    // widget DOM during this same mousedown, detaching the event's target. This
    // cell's row/col are known from its own wiring, so the live replacement is
    // looked up by identity instead of through the stale node.
    cellEl.addEventListener('mousedown', (event) => {
      if ((event.target as HTMLElement | null)?.closest('.cm-table-cell-handle')) return;
      event.preventDefault();
      event.stopPropagation();
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(openEditor);
      } else {
        openEditor();
      }
    });

    // Handle: hover opens, press repositions. Leaving the handle must NOT close
    // — the pointer is usually on its way to the menu, which has its own grace.
    handle.addEventListener('mouseenter', () => {
      handle.classList.add('cm-table-cell-handle-active');
      this.openCellMenu(view, row, col);
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
        flushDirtyTables(view);
      },
      true,
    );
  }

  /**
   * Position the insertion boundaries over the measured table.
   *
   * Column boundaries come first in DOM order so the leading boundary is the
   * column one. Falls back to `evenColumnWidths` when the table has not been
   * laid out, so the overlays always carry a non-zero hit area.
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
      boundary.style.pointerEvents = 'auto';
      boundary.style.zIndex = '5';
      boundary.addEventListener('mouseenter', () =>
        boundary.classList.add('cm-table-boundary-active'),
      );
      boundary.addEventListener('mouseleave', () =>
        boundary.classList.remove('cm-table-boundary-active'),
      );
      boundary.addEventListener('mousedown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (kind === 'col') this.addColumn(view, index + 1);
        else this.addRow(view, index);
      });
      container.appendChild(boundary);
    };

    const half = BOUNDARY_THICKNESS / 2;
    const colEdges: number[] = [];
    if (measured) {
      const head = table.rows[0];
      const fallbackWidths = evenColumnWidths(this.header.length, totalWidth);
      for (let col = 0; col < this.header.length - 1; col += 1) {
        const cell = head?.cells[col];
        // A merged or unrendered cell has no rect; keep the boundary on the
        // even-division position instead of collapsing it onto the leading edge.
        colEdges.push(
          cell
            ? cell.getBoundingClientRect().right - tableRect.left
            : fallbackWidths[col] ?? 0,
        );
      }
    } else {
      let edge = 0;
      for (const width of evenColumnWidths(this.header.length, totalWidth).slice(0, -1)) {
        edge += width;
        colEdges.push(edge);
      }
    }
    for (let col = 0; col < colEdges.length; col += 1) {
      addBoundary(
        'col',
        col,
        originX + colEdges[col] - half,
        originY,
        BOUNDARY_THICKNESS,
        totalHeight,
      );
    }

    const rowEdges: number[] = [];
    for (let r = 0; r < this.rows.length; r += 1) {
      const tr = table.rows[r + 1];
      rowEdges.push(
        measured && tr
          ? tr.getBoundingClientRect().bottom - tableRect.top
          : ((r + 1) / (this.rows.length + 1)) * totalHeight,
      );
    }
    for (let r = 0; r < rowEdges.length; r += 1) {
      addBoundary(
        'row',
        r,
        originX,
        originY + rowEdges[r] - half,
        totalWidth,
        BOUNDARY_THICKNESS,
      );
    }
  }

  /**
   * Adopt the freshly computed offsets while KEEPING the existing DOM.
   *
   * The widget is retained because the rendered text is identical, but its
   * positions are stale — every other edit in the document may have shifted
   * them. Mutating `this` inside `eq` is the only place CM6 hands us the new
   * state while keeping our DOM, so the retained instance adopts it here.
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

    // Skip the cell that is being edited: its text lives in the input until the
    // edit settles, so refreshing it from the document here would clobber it.
    for (const cell of this.cells) {
      const body = wrap.querySelector<HTMLElement>(
        `.cm-table-cell-text[data-row="${cell.row}"][data-col="${cell.col}"]`,
      );
      if (!body) continue;
      const cellEl = body.parentElement;
      if (!cellEl?.querySelector('.cm-table-cell-input')) {
        const expected = this.cellText(cell.row, cell.col);
        if ((body.textContent ?? '') !== expected) body.textContent = expected;
      }
      if (cellEl) cellEl.classList.toggle('cm-table-cell-active', cell.active);
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
    releaseInsertMenu(this.view);
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