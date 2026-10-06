/**
 * TABLE DECORATIONS PURE-HELPER TEST.
 *
 * The DOM-free half of the table widget: document-range lookup, the fallback
 * column geometry used before layout is measurable, and cell-text sanitisation.
 */
import { describe, expect, it } from 'vitest';
import { evenColumnWidths, sanitizeCellText, tableCellRange, renderCellText } from '../src/decorations/table';

const DOC = ['| A | B |', '| --- | --- |', '| 1 | 2 |', '| 3 | 4 |'].join('\n');

describe('tableCellRange', () => {
  it('locates a header cell (row -1)', () => {
    expect(tableCellRange(DOC, 0, -1, 0)).toEqual({ from: 2, to: 3 });
    expect(tableCellRange(DOC, 0, -1, 1)).toEqual({ from: 6, to: 7 });
  });

  it('locates body cells and slices back the cell text', () => {
    const cell = tableCellRange(DOC, 0, 0, 1);
    expect(cell).toEqual({ from: 30, to: 31 });
    expect(DOC.slice(cell?.from, cell?.to)).toBe('2');

    const last = tableCellRange(DOC, 0, 1, 0);
    expect(DOC.slice(last?.from, last?.to)).toBe('3');
  });

  it('locates an empty cell as a collapsed range', () => {
    const doc = ['| A | B |', '| --- | --- |', '|  | 2 |'].join('\n');
    expect(tableCellRange(doc, 0, 0, 0)).toEqual({ from: 27, to: 27 });
  });

  it('addresses the second table independently', () => {
    const doc = ['| A |', '| --- |', '| 1 |', '', '| X |', '| --- |', '| 9 |'].join('\n');
    expect(tableCellRange(doc, 0, 0, 0)).toEqual({ from: 16, to: 17 });
    expect(tableCellRange(doc, 1, -1, 0)).toEqual({ from: 23, to: 24 });
    expect(tableCellRange(doc, 1, 0, 0)).toEqual({ from: 37, to: 38 });
  });

  it('returns null for missing tables and out-of-range ordinals', () => {
    expect(tableCellRange(DOC, 1, 0, 0)).toBeNull();
    expect(tableCellRange(DOC, 0, 9, 0)).toBeNull();
    expect(tableCellRange(DOC, 0, 0, 9)).toBeNull();
    expect(tableCellRange('no table here', 0, 0, 0)).toBeNull();
  });

  it('ignores a pipe row that has no separator line', () => {
    expect(tableCellRange(['| A | B |', '| 1 | 2 |'].join('\n'), 0, 0, 0)).toBeNull();
  });
});

describe('evenColumnWidths', () => {
  it('returns nothing for a non-positive count', () => {
    expect(evenColumnWidths(0, 600)).toEqual([]);
    expect(evenColumnWidths(-2, 600)).toEqual([]);
  });

  it('splits evenly when total divides cleanly', () => {
    expect(evenColumnWidths(3, 600)).toEqual([200, 200, 200]);
    expect(evenColumnWidths(1, 5)).toEqual([5]);
  });

  it('hands out the remainder one pixel at a time', () => {
    expect(evenColumnWidths(2, 601)).toEqual([301, 300]);
    expect(evenColumnWidths(4, 10)).toEqual([3, 3, 2, 2]);
  });

  it('always sums back to total and never exceeds 1px spread', () => {
    for (const [count, total] of [
      [2, 601],
      [3, 100],
      [7, 13],
      [4, 0],
    ] as const) {
      const widths = evenColumnWidths(count, total);
      expect(widths).toHaveLength(count);
      expect(widths.reduce((a, b) => a + b, 0)).toBe(total);
      expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1);
    }
  });
});

describe('sanitizeCellText', () => {
  it('passes plain text through untouched', () => {
    expect(sanitizeCellText('plain text')).toBe('plain text');
    expect(sanitizeCellText('')).toBe('');
    expect(sanitizeCellText('  keeps\ttabs  ')).toBe('  keeps\ttabs  ');
  });

  it('flattens newlines so a cell cannot start a new block', () => {
    expect(sanitizeCellText('a\nb')).toBe('a b');
    expect(sanitizeCellText('a\r\nb')).toBe('a b');
  });

  it('replaces pipes so a cell cannot add a column', () => {
    expect(sanitizeCellText('a|b')).toBe('a b');
    expect(sanitizeCellText('|a|')).toBe(' a ');
  });

  it('keeps the table structure intact after sanitising', () => {
    const doc = [
      '| A | B |',
      '| --- | --- |',
      `| 1 | ${sanitizeCellText('x | y')} |`,
    ].join('\n');
    expect(tableCellRange(doc, 0, 0, 1)).not.toBeNull();
    expect(tableCellRange(doc, 0, 0, 2)).toBeNull();
  });
});

describe('renderCellText', () => {
  it('passes plain text through untouched', () => {
    expect(renderCellText('plain text')).toBe('plain text');
    expect(renderCellText('')).toBe('');
  });

  it('renders **bold** as <strong>', () => {
    expect(renderCellText('**bold**')).toBe('<strong>bold</strong>');
    expect(renderCellText('**bold** and normal')).toBe('<strong>bold</strong> and normal');
    expect(renderCellText('normal and **bold**')).toBe('normal and <strong>bold</strong>');
    expect(renderCellText('**a** **b**')).toBe('<strong>a</strong> <strong>b</strong>');
  });

  it('renders *italic* as <em>', () => {
    expect(renderCellText('*italic*')).toBe('<em>italic</em>');
    expect(renderCellText('*italic* and normal')).toBe('<em>italic</em> and normal');
    expect(renderCellText('normal and *italic*')).toBe('normal and <em>italic</em>');
    expect(renderCellText('*a* *b*')).toBe('<em>a</em> <em>b</em>');
  });

  it('renders `code` as <code>', () => {
    expect(renderCellText('`code`')).toBe('<code>code</code>');
    expect(renderCellText('`code` and normal')).toBe('<code>code</code> and normal');
    expect(renderCellText('normal and `code`')).toBe('normal and <code>code</code>');
    expect(renderCellText('`a` `b`')).toBe('<code>a</code> <code>b</code>');
  });

  it('renders ~~strikethrough~~ as <del>', () => {
    expect(renderCellText('~~strike~~')).toBe('<del>strike</del>');
    expect(renderCellText('~~strike~~ and normal')).toBe('<del>strike</del> and normal');
  });

  it('renders [link](url) as <a> with security attributes', () => {
    const result = renderCellText('[link](https://example.com)');
    expect(result).toBe('<a href="https://example.com" target="_blank" rel="noopener noreferrer">link</a>');
    expect(renderCellText('[link](url) and normal')).toBe('<a href="url" target="_blank" rel="noopener noreferrer">link</a> and normal');
  });

  it('handles nested/combined inline markdown', () => {
    expect(renderCellText('**bold** and *italic* and `code`')).toBe('<strong>bold</strong> and <em>italic</em> and <code>code</code>');
    expect(renderCellText('**bold *italic* bold**')).toBe('<strong>bold <em>italic</em> bold</strong>');
  });

  it('escapes HTML in text content', () => {
    expect(renderCellText('<script>alert(1)</script>')).toBe('<script>alert(1)</script>');
    expect(renderCellText('**<b>bold</b>**')).toBe('<strong><b>bold</b></strong>');
  });

  it('extracts inner text from background span wrapper', () => {
    const withBg = '<span class="mdb-bg-blue">hello</span>';
    expect(renderCellText(withBg)).toBe('hello');
    const withBgAndMarkdown = '<span class="mdb-bg-blue">**bold**</span>';
    expect(renderCellText(withBgAndMarkdown)).toBe('<strong>bold</strong>');
  });
});