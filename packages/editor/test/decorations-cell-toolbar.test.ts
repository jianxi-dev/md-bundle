/**
 * TABLE CELL SELECTION + TOOLBAR TEST (ticket #328 / change editor-fidelity 7.1).
 *
 * Covers the view-level cell selection model (drag / shift-click), the merge
 * write-back, the cell-background span convention, and the cell toolbar's
 * merge-disabled rule. jsdom lacks requestAnimationFrame/ResizeObserver; CM6
 * needs both, so they are polyfilled here.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMarkdownEditor } from '../src/editor';
import { editorDecorations } from '../src/decorations';
import { mergeTableCellSelection, setCellBackground } from '../src/decorations/table';
import {
  cellRect,
  cellSelectionCount,
  getCellSelection,
  setCellSelection,
} from '../src/decorations/cell-selection';

const DOC = ['Intro paragraph.', '', '| A | B |', '| --- | --- |', '| 1 | 2 |', '| 3 | 4 |'].join(
  '\n',
);

function installPolyfills(): void {
  if (typeof globalThis.requestAnimationFrame !== 'function') {
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 16)) as unknown as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = ((id: number) =>
      clearTimeout(id)) as unknown as typeof cancelAnimationFrame;
  }
  if (typeof globalThis.ResizeObserver !== 'function') {
    globalThis.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver;
  }
  // jsdom's Range has no getClientRects; CM6's coords scan calls it on a real
  // mousedown. Empty rects are enough — the handlers only need it not to throw.
  if (typeof Range !== 'undefined' && !('getClientRects' in Range.prototype)) {
    (Range.prototype as unknown as { getClientRects: () => DOMRectList }).getClientRects =
      () => [] as unknown as DOMRectList;
  }
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 40));
}

describe('table cell selection + toolbar (ticket #328)', () => {
  let parent: HTMLElement;
  let view: ReturnType<typeof createMarkdownEditor>['view'];

  beforeEach(() => {
    installPolyfills();
    parent = document.createElement('div');
    document.body.appendChild(parent);
    view = createMarkdownEditor(parent, {
      value: DOC,
      extensions: [editorDecorations()],
    }).view;
  });

  afterEach(() => {
    view.destroy();
    parent.remove();
  });

  function cell(row: number, col: number): HTMLElement {
    const el = view.dom.querySelector<HTMLElement>(
      `.cm-table [data-row="${row}"][data-col="${col}"]`,
    );
    if (!el) throw new Error(`cell ${row}:${col} not found`);
    return el;
  }

  function mousedown(el: HTMLElement, shiftKey = false): void {
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, shiftKey }));
  }

  function mouseenter(el: HTMLElement): void {
    el.dispatchEvent(new MouseEvent('mouseenter'));
  }

  function docMouseup(): void {
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  }

  function mergeBtn(): HTMLButtonElement {
    const btn = view.dom.querySelector<HTMLButtonElement>('[data-testid="cell-merge"]');
    if (!btn) throw new Error('cell-merge button not found');
    return btn;
  }

  it('renders the table widget so cells are addressable', () => {
    expect(view.dom.querySelector('.cm-table')).not.toBeNull();
    expect(cell(0, 0).textContent).toContain('1');
  });

  it('drag from one cell to another selects a rectangle without opening an editor', () => {
    mousedown(cell(0, 0));
    mouseenter(cell(0, 1));
    docMouseup();

    const selection = getCellSelection(view);
    expect(selection).not.toBeNull();
    expect(cellSelectionCount(selection!)).toBe(2);
    expect(cell(0, 0).classList.contains('cm-table-cell-selected')).toBe(true);
    expect(cell(0, 1).classList.contains('cm-table-cell-selected')).toBe(true);
    expect(view.dom.querySelector('.cm-table-cell-input')).toBeNull();
    expect(mergeBtn().disabled).toBe(false);
  });

  it('a single-cell click disables merge and opens the cell editor', async () => {
    mousedown(cell(0, 0));
    expect(mergeBtn().disabled).toBe(true);

    docMouseup();
    await nextFrame();

    expect(cell(0, 0).querySelector('.cm-table-cell-input')).not.toBeNull();
  });

  it('shift-click extends the existing anchor to a second cell', () => {
    mousedown(cell(0, 0));
    docMouseup();
    mousedown(cell(1, 1), true);

    const selection = getCellSelection(view);
    expect(cellSelectionCount(selection!)).toBe(4);
    expect(cell(1, 1).classList.contains('cm-table-cell-selected')).toBe(true);
    expect(mergeBtn().disabled).toBe(false);
  });

  it('maps a selection onto its inclusive rectangle', () => {
    const selection = {
      tableIndex: 0,
      anchorRow: 1,
      anchorCol: 1,
      headRow: 0,
      headCol: 0,
    };
    expect(cellRect(selection)).toEqual({ minRow: 0, maxRow: 1, minCol: 0, maxCol: 1 });
    expect(cellSelectionCount(selection)).toBe(4);
  });

  it('merge concatenates non-empty cell text into the top-left cell', () => {
    // `row -1` is the header row; merge its two cells.
    setCellSelection(view, {
      tableIndex: 0,
      anchorRow: -1,
      anchorCol: 0,
      headRow: -1,
      headCol: 1,
    });
    const selection = getCellSelection(view)!;
    expect(mergeTableCellSelection(view, 0, cellRect(selection))).toBe(true);

    expect(view.state.doc.toString()).toBe(
      ['Intro paragraph.', '', '| A B |  |', '| --- | --- |', '| 1 | 2 |', '| 3 | 4 |'].join('\n'),
    );
    // The selection collapses to the single top-left cell.
    expect(cellSelectionCount(getCellSelection(view)!)).toBe(1);
    expect(mergeBtn().disabled).toBe(true);
  });

  it('applying a background wraps the cell text in an mdb-bg span and paints the cell', async () => {
    setCellSelection(view, {
      tableIndex: 0,
      anchorRow: 0,
      anchorCol: 0,
      headRow: 0,
      headCol: 0,
    });
    const selection = getCellSelection(view)!;
    expect(setCellBackground(view, 0, cellRect(selection), 'mdb-bg-blue')).toBe(true);

    const raw = view.state.doc.toString();
    expect(raw).toContain('<span class="mdb-bg-blue">1</span>');

    await nextFrame();
    const painted = cell(0, 0);
    expect(painted.classList.contains('cm-table-cell-bg-blue')).toBe(true);
    // The span markup is not shown as text — only the inner value.
    expect(painted.textContent).toContain('1');
    expect(painted.textContent).not.toContain('span');
    // The live selection survives the widget rebuild.
    expect(painted.classList.contains('cm-table-cell-selected')).toBe(true);
  });

  it('恢复默认 removes the background span and the class', async () => {
    setCellSelection(view, {
      tableIndex: 0,
      anchorRow: 0,
      anchorCol: 0,
      headRow: 0,
      headCol: 0,
    });
    const selection = getCellSelection(view)!;
    setCellBackground(view, 0, cellRect(selection), 'mdb-bg-green');
    expect(view.state.doc.toString()).toContain('mdb-bg-green');

    const nextSelection = getCellSelection(view)!;
    expect(setCellBackground(view, 0, cellRect(nextSelection), null)).toBe(true);
    expect(view.state.doc.toString()).not.toContain('mdb-bg-');

    await nextFrame();
    const painted = cell(0, 0);
    expect(painted.className).not.toContain('cm-table-cell-bg-');
    expect(painted.textContent).toContain('1');
  });

  it('outside mousedown clears the selection and hides the toolbar', () => {
    mousedown(cell(0, 0));
    mouseenter(cell(0, 1));
    docMouseup();
    expect(view.dom.querySelector<HTMLElement>('.mdb-cell-toolbar')?.style.display).toBe(
      'inline-flex',
    );

    // A paragraph line is outside the table wrap.
    const paragraph = view.dom.querySelector('.cm-line');
    expect(paragraph).not.toBeNull();
    paragraph!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));

    expect(getCellSelection(view)).toBeNull();
    expect(cell(0, 0).classList.contains('cm-table-cell-selected')).toBe(false);
    expect(view.dom.querySelector<HTMLElement>('.mdb-cell-toolbar')?.style.display).toBe('none');
  });
});
