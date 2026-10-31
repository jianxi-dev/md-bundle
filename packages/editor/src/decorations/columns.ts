/**
 * Column layout widget — renders a Pandoc fenced div `::: {.col-N}` as a real
 * multi-column layout in the editor, matching the preview's `.layout-col-N`.
 *
 * Modeled on the reference product: columns are an explicit container, each
 * column holds its own content block, and column widths are percentages that
 * sum to 100. The whole fenced div (including the `:::` markers) is replaced by
 * one widget, so the raw markers never show while the layout is rendered.
 *
 * A draggable gutter sits between adjacent columns: hovering shows a
 * `col-resize` cursor and highlights the line; dragging rewrites the widths back
 * into the source as a `cols:` percentage attribute on the opening fence.
 */
import { Decoration, WidgetType, type EditorView } from '@codemirror/view';
import type { Range } from '@codemirror/state';

const OPEN_RE = /^ {0,3}:::\s*\{([^}]*)\}\s*$/;
const CLOSE_RE = /^ {0,3}:::\s*$/;
const COL_RE = /\.col-([1-5])/;
const COLS_ATTR_RE = /(?:^|\s)cols:([0-9]+(?:,[0-9]+)*)(?=[\s}]|$)/;

const MIN_COLUMN_PERCENT = 10;

interface ColumnBlock {
  /** Range of the whole fenced div, markers included. */
  from: number;
  to: number;
  /** Range of the opening fence line, used to rewrite `cols:`. */
  openFrom: number;
  openTo: number;
  count: number;
  /** Percent widths; null when the source declares none (equal split). */
  widths: number[] | null;
  /** Each top-level block inside the fences, in source order. */
  cells: { from: number; to: number; text: string }[];
}


/**
 * Rewrite a column block from its padded cell list.
 *
 * GFM/Pandoc fenced divs have no slot for an EMPTY column: `splitCells` only
 * returns blocks that contain non-whitespace, so a blank column simply does not
 * exist in the source. Editing one therefore has to rewrite the fenced div with
 * the padded list (blank cells become empty stretches between `:::` markers).
 *
 * The rewrite keeps the opening/closing fence lines byte-identical and only
 * touches the inner stretch.
 */
function rebuildColumns(docText: string, block: ColumnBlock, cells: string[]): string | null {
  const text = docText.slice(block.from, block.to);
  const lines = text.split('\n');
  if (lines.length < 2) return null;
  const openLine = lines[0];
  const closeLine = lines[lines.length - 1];
  // Nested fences: refuse rather than mangle structure we do not model.
  if (lines.slice(1, -1).some((line) => OPEN_RE.test(line) || CLOSE_RE.test(line))) return null;
  const padded = Array.from({ length: block.count }, (_, i) => (cells[i] ?? '').replace(/\n{3,}/g, '\n\n'));
  return [openLine, '', padded.join('\n\n'), '', closeLine].join('\n');
}


/**
 * In-place column editor (#450).
 *
 * The widget replaces the whole fenced div, so putting the CM6 caret "inside a
 * column" is not possible: any coordinate inside the widget maps back to the
 * block's first line. A real `<textarea>` inside the column body is the only way
 * to type where the user clicked; the edit is written back by rebuilding the
 * fenced div on settle.
 */
function openColumnEditor(
  view: EditorView,
  blockFrom: number,
  index: number,
  host: HTMLElement,
  initial: string,
): void {
  const existing = host.querySelector<HTMLTextAreaElement>('.cm-column-editor');
  if (existing) {
    existing.focus();
    return;
  }
  const area = document.createElement('textarea');
  area.className = 'cm-column-editor';
  area.setAttribute('data-testid', 'cm-column-editor');
  area.value = initial;
  area.rows = 1;
  host.appendChild(area);
  area.focus();
  area.setSelectionRange(area.value.length, area.value.length);

  let composing = false;
  const teardown = (): void => {
    area.remove();
    host.removeAttribute('data-editing');
  };
  const commit = (): void => {
    if (!area.isConnected) return;
    const value = area.value.trim();
    teardown();
    const docText = view.state.doc.toString();
    const block = parseColumns(docText).find((b) => b.from === blockFrom);
    if (!block) return;
    const cells = Array.from({ length: block.count }, (_, i) => (block.cells[i]?.text ?? '').trim());
    cells[index] = value;
    const next = rebuildColumns(docText, block, cells);
    if (next === null) return;
    view.dispatch({ changes: { from: block.from, to: block.to, insert: next } });
    view.focus();
  };

  area.addEventListener('compositionstart', () => {
    composing = true;
  });
  area.addEventListener('compositionend', () => {
    composing = false;
  });
  area.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      teardown();
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      commit();
    }
  });
  area.addEventListener('blur', () => {
    if (!composing) commit();
  });
  area.addEventListener('input', () => {
    area.style.height = 'auto';
    area.style.height = `${area.scrollHeight}px`;
  });
  area.addEventListener('mousedown', (event) => event.stopPropagation());
}

/** Equal-split percentages for `count` columns (remainder spread evenly). */
function equalWidths(count: number): number[] {
  const base = Math.floor(100 / count);
  const remainder = 100 - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

/** The widths to render: the declared `cols:` values when valid, else equal. */
function resolveWidths(block: ColumnBlock): number[] {
  if (block.widths && block.widths.length === block.count) return block.widths;
  return equalWidths(block.count);
}

/** Split inner content into top-level blocks (blank-line separated). */
function splitCells(text: string, contentFrom: number): { from: number; to: number; text: string }[] {
  const cells: { from: number; to: number; text: string }[] = [];
  const re = /\S[^\n]*(?:\n(?!\s*\n)[^\n]*)*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    cells.push({ from: contentFrom + m.index, to: contentFrom + m.index + m[0].length, text: m[0] });
  }
  return cells;
}

function parseColumns(docText: string): ColumnBlock[] {
  const lines = docText.split('\n');
  const offsets: number[] = [];
  let acc = 0;
  for (const line of lines) {
    offsets.push(acc);
    acc += line.length + 1;
  }

  const blocks: ColumnBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const open = OPEN_RE.exec(lines[i]);
    const colMatch = open ? COL_RE.exec(open[1]) : null;
    if (!open || !colMatch) {
      i += 1;
      continue;
    }
    let j = i + 1;
    let depth = 1;
    while (j < lines.length) {
      if (OPEN_RE.test(lines[j])) depth += 1;
      else if (CLOSE_RE.test(lines[j])) {
        depth -= 1;
        if (depth === 0) break;
      }
      j += 1;
    }
    if (j >= lines.length) {
      i += 1;
      continue;
    }

    const contentFrom = offsets[i] + lines[i].length + 1;
    const inner = lines.slice(i + 1, j).join('\n');
    const colsMatch = COLS_ATTR_RE.exec(open[1]);
    const widths = colsMatch ? colsMatch[1].split(',').map(Number) : null;

    blocks.push({
      from: offsets[i],
      to: offsets[j] + lines[j].length,
      openFrom: offsets[i],
      openTo: offsets[i] + lines[i].length,
      count: Number(colMatch[1]),
      widths,
      cells: splitCells(inner, contentFrom),
    });
    i = j + 1;
  }
  return blocks;
}

/** Rewrite the `cols:` attribute on a fenced-div opening line. */
function withColsAttr(openLine: string, widths: number[]): string {
  const attr = `cols:${widths.join(',')}`;
  if (COLS_ATTR_RE.test(openLine)) {
    // COLS_ATTR_RE's match includes the leading separator; dropping it would fuse
    // the attribute onto the previous token (`{.col-2cols:40,60}`).
    return openLine.replace(COLS_ATTR_RE, (match) => {
      const sep = /\s/.test(match[0]) ? match[0] : '';
      return `${sep}${attr}`;
    });
  }
  return openLine.replace(/\}\s*$/, ` ${attr}}`);
}

class ColumnsWidget extends WidgetType {
  constructor(
    /** Ordinal among column blocks — the stable key across doc shifts. */
    readonly index: number,
    readonly block: ColumnBlock,
  ) {
    super();
  }

  eq(other: ColumnsWidget): boolean {
    return (
      this.index === other.index &&
      this.block.count === other.block.count &&
      JSON.stringify(resolveWidths(this.block)) === JSON.stringify(resolveWidths(other.block)) &&
      JSON.stringify(this.block.cells.map((c) => c.text)) ===
        JSON.stringify(other.block.cells.map((c) => c.text))
    );
  }

  toDOM(view?: EditorView): HTMLElement {
    const widths = resolveWidths(this.block);
    const container = document.createElement('div');
    container.className = `cm-columns cm-columns-${this.block.count}`;
    container.setAttribute('data-testid', 'cm-columns');
    container.style.display = 'flex';
    container.style.alignItems = 'stretch';

    // Render `count` columns even when the block is empty: a freshly inserted
    // `::: {.col-N}` has no cells yet, and a zero-child container is invisible.
    // Missing cells become empty placeholders anchored at the opening fence so
    // clicking a column still selects a sensible source range.
    for (let index = 0; index < this.block.count; index++) {
      if (index > 0) {
        container.appendChild(this.buildGutter(view, index, widths));
      }
      const cell = this.block.cells[index] ?? {
        from: this.block.openTo,
        to: this.block.openTo,
        text: '',
      };
      container.appendChild(this.buildColumn(view, cell, index, widths[index] ?? 100 / this.block.count));
    }

    return container;
  }

  private buildColumn(
    view: EditorView | undefined,
    cell: { from: number; to: number; text: string },
    index: number,
    percent: number,
  ): HTMLElement {
    const col = document.createElement('div');
    col.className = 'cm-column';
    col.dataset.col = String(index);
    col.style.flex = `0 0 calc(${percent}% - 8px)`;
    col.style.minWidth = '0';

    const body = document.createElement('div');
    body.className = 'cm-column-body';
    body.textContent = cell.text;
    if (!cell.text) body.dataset.placeholder = '输入内容…';
    // A press opens the in-place editor for THIS column (#450). Selecting the
    // source range instead put the caret on the block's first line, so typing
    // landed outside the column.
    if (view) {
      const blockFrom = this.block.from;
      body.addEventListener('mousedown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        body.dataset.editing = 'true';
        openColumnEditor(view, blockFrom, index, body, cell.text);
      });
    }
    col.appendChild(body);

    const handle = document.createElement('div');
    handle.className = 'cm-column-handle';
    handle.setAttribute('data-testid', 'column-block-handle');
    handle.dataset.col = String(index);
    handle.title = '选中此栏';
    if (view) {
      handle.addEventListener('mousedown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        view.dispatch({ selection: { anchor: cell.from, head: cell.to } });
        view.focus();
      });
    }
    col.appendChild(handle);

    return col;
  }

  /** Between-column gutter: hover highlights the line, drag resizes (#327). */
  private buildGutter(view: EditorView | undefined, index: number, widths: number[]): HTMLElement {
    const gutter = document.createElement('div');
    gutter.className = 'cm-column-gutter';
    gutter.setAttribute('data-testid', 'column-gutter');
    gutter.dataset.index = String(index);

    const line = document.createElement('div');
    line.className = 'cm-column-gutter-line';
    gutter.appendChild(line);

    if (!view) return gutter;

    const startDrag = (event: MouseEvent): void => {
      event.preventDefault();
      event.stopPropagation();
      const rect = view.dom.getBoundingClientRect();
      const total = rect.width;
      const startX = event.clientX;
      const left = widths[index - 1];
      const right = widths[index];
      const sum = left + right;

      const onMove = (move: MouseEvent): void => {
        const delta = ((move.clientX - startX) / total) * 100;
        const nextLeft = Math.min(Math.max(left + delta, MIN_COLUMN_PERCENT), sum - MIN_COLUMN_PERCENT);
        widths[index - 1] = Math.round(nextLeft);
        widths[index] = Math.round(sum - nextLeft);
        // Live visual: resize the two neighbouring columns while dragging.
        const cols = gutter.parentElement?.querySelectorAll('.cm-column');
        if (cols) {
          (cols[index - 1] as HTMLElement).style.flex = `0 0 calc(${widths[index - 1]}% - 8px)`;
          (cols[index] as HTMLElement).style.flex = `0 0 calc(${widths[index]}% - 8px)`;
        }
      };
      const onUp = (): void => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        this.writeWidths(view, widths);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    };

    gutter.addEventListener('mousedown', startDrag);
    return gutter;
  }

  private writeWidths(view: EditorView, widths: number[]): void {
    const current = parseColumns(view.state.doc.toString())[this.index];
    // Guard against an ordinal shift (a column div added/removed mid-drag):
    // write to the wrong fence is worse than dropping the resize.
    if (!current || current.count !== this.block.count) return;
    const openLine = view.state.doc.sliceString(current.openFrom, current.openTo);
    const next = withColsAttr(openLine, widths);
    if (next === openLine) return;
    view.dispatch({ changes: { from: current.openFrom, to: current.openTo, insert: next } });
  }
}

/**
 * Decoration factory: replace each column fenced div with the layout widget.
 */
export function createColumnsDecorations(docText: string): Range<Decoration>[] {
  return parseColumns(docText).map((block, index) =>
    Decoration.replace({ widget: new ColumnsWidget(index, block), block: true }).range(block.from, block.to),
  );
}
