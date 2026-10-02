import type { Range } from '@codemirror/state';
import { Decoration, WidgetType, type EditorView } from '@codemirror/view';

const TABLE_ROW_RE = /^\s*\|.*\|\s*$/;
const TABLE_SEP_RE = /^\s*\|(\s*:?-+:?\s*\|)+\s*$/;

interface CellSpan {
  row: number;
  col: number;
  from: number;
  to: number;
}

interface TableBlock {
  from: number;
  to: number;
  header: string[];
  rows: string[][];
  cells: CellSpan[];
}

function splitCells(line: string): string[] {
  const parts = line.split('|');
  return parts.slice(1, parts.length - 1).map((cell) => cell.trim());
}

function cellSpans(line: string, lineStart: number, row: number): CellSpan[] {
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
    spans.push({ row, col: k, from: lineStart + start, to: lineStart + end });
  }
  return spans;
}

function findTables(text: string): TableBlock[] {
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

    const cells: CellSpan[] = cellSpans(lines[i], offsets[i], -1);
    for (let r = i + 2; r <= endLine; r += 1) {
      cells.push(...cellSpans(lines[r], offsets[r], r - i - 2));
    }

    tables.push({
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

function buildTableMarkdown(header: string[], rows: string[][]): string {
  const headerLine = `| ${header.join(' | ')} |`;
  const sepLine = `| ${header.map(() => '---').join(' | ')} |`;
  const bodyLines = rows.map((row) => `| ${row.join(' | ')} |`);
  return [headerLine, sepLine, ...bodyLines].join('\n');
}

class TableWidget extends WidgetType {
  constructor(
    readonly header: string[],
    readonly rows: string[][],
    readonly cells: CellSpan[],
    readonly from: number,
    readonly to: number,
  ) {
    super();
  }

  private rewrite(view: EditorView, header: string[], rows: string[][]): void {
    view.dispatch({
      changes: { from: this.from, to: this.to, insert: buildTableMarkdown(header, rows) },
    });
    view.focus();
  }

  private addColumn(view: EditorView, at: number): void {
    const header = [...this.header];
    header.splice(at, 0, '');
    const rows = this.rows.map((row) => {
      const next = [...row];
      next.splice(at, 0, '');
      return next;
    });
    this.rewrite(view, header, rows);
  }

  private addRow(view: EditorView, at: number): void {
    const rows = this.rows.map((row) => [...row]);
    rows.splice(at, 0, new Array(this.header.length).fill(''));
    this.rewrite(view, [...this.header], rows);
  }

  toDOM(view?: EditorView): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'cm-table-wrap';

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

    const table = document.createElement('table');
    table.className = 'cm-table';
    table.setAttribute('data-testid', 'cm-table');

    const wireCell = (el: HTMLElement, row: number, col: number): void => {
      el.addEventListener('mousedown', (event) => {
        if (!view) return;
        const span = this.cells.find((c) => c.row === row && c.col === col);
        if (!span) return;
        event.preventDefault();
        view.dispatch({ selection: { anchor: span.from, head: span.to } });
        view.focus();
      });
    };

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    this.header.forEach((text, col) => {
      const th = document.createElement('th');
      th.textContent = text;
      th.dataset.row = '-1';
      th.dataset.col = String(col);
      wireCell(th, -1, col);
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    this.rows.forEach((row, r) => {
      const tr = document.createElement('tr');
      row.forEach((text, col) => {
        const td = document.createElement('td');
        td.textContent = text;
        td.dataset.row = String(r);
        td.dataset.col = String(col);
        wireCell(td, r, col);
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
    wrap.appendChild(table);

    return wrap;
  }

  eq(other: TableWidget): boolean {
    return (
      JSON.stringify(this.header) === JSON.stringify(other.header) &&
      JSON.stringify(this.rows) === JSON.stringify(other.rows)
    );
  }
}

export function createTableDecorations(
  docText: string,
  activeFrom: number = -1,
  activeTo: number = -1,
): Range<Decoration>[] {
  const decorations: Range<Decoration>[] = [];

  for (const table of findTables(docText)) {
    const isActive =
      activeFrom >= 0 && table.from >= activeFrom && table.to <= activeTo;
    if (isActive) continue;

    decorations.push(
      Decoration.replace({
        widget: new TableWidget(
          table.header,
          table.rows,
          table.cells,
          table.from,
          table.to,
        ),
      }).range(table.from, table.to),
    );
  }

  return decorations;
}
