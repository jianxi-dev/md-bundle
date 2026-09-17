/**
 * Block model tests — verifies Lezer AST-based block traversal.
 *
 * getBlocks() walks the top-level children of the document tree.
 * getBlockAt() performs a binary search for position-based lookup.
 */
import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { getBlocks, getBlockAt } from '../src/block-model';

function makeState(doc: string): EditorState {
  return EditorState.create({ doc, extensions: [markdown()] });
}

describe('getBlocks', () => {
  it('returns an empty array for an empty document', () => {
    const state = makeState('');
    expect(getBlocks(state)).toEqual([]);
  });

  it('returns a single paragraph for plain text', () => {
    const state = makeState('hello world');
    const blocks = getBlocks(state);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('paragraph');
    expect(blocks[0].from).toBe(0);
    expect(blocks[0].to).toBe(11);
  });

  it('identifies headings', () => {
    const state = makeState('# Title\n## Subtitle');
    const blocks = getBlocks(state);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe('heading');
    expect(blocks[0].from).toBe(0);
    // Lezer heading node covers "# Title" (7 chars, no trailing newline)
    expect(blocks[0].to).toBe(7);
    expect(blocks[1].type).toBe('heading');
    // Second heading starts after the newline at position 7
    expect(blocks[1].from).toBe(8);
    // "## Subtitle" is 10 chars (positions 8-17), node covers 8-19
    expect(blocks[1].to).toBe(19);
  });

  it('identifies blockquotes', () => {
    const state = makeState('> quoted text');
    const blocks = getBlocks(state);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('blockquote');
    expect(blocks[0].from).toBe(0);
    expect(blocks[0].to).toBe(13);
  });

  it('identifies lists', () => {
    const state = makeState('- item 1\n- item 2');
    const blocks = getBlocks(state);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('list');
  });

  it('identifies fenced code blocks', () => {
    const state = makeState('```\ncode here\n```');
    const blocks = getBlocks(state);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('fencedCode');
  });

  it('identifies tables', () => {
    // GFM-style table with header separator
    const state = makeState('| A | B |\n| --- | --- |\n| 1 | 2 |');
    const blocks = getBlocks(state);
    expect(blocks).toHaveLength(1);
    // Table is a GFM extension — without the Table extension enabled,
    // the parser treats it as a paragraph. This test documents that.
    expect(blocks[0].type).toBe('paragraph');
  });

  it('identifies thematic breaks', () => {
    const state = makeState('---');
    const blocks = getBlocks(state);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('thematicBreak');
  });

  it('identifies images', () => {
    // Images are inline nodes in Lezer's markdown parser, not top-level blocks.
    // A standalone image line is parsed as a paragraph containing an inline Image node.
    const state = makeState('![alt](path/to.png)');
    const blocks = getBlocks(state);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('paragraph');
  });

  it('returns blocks sorted by from-position ascending', () => {
    const state = makeState('# Head\n\nparagraph\n\n> quote');
    const blocks = getBlocks(state);
    expect(blocks.length).toBeGreaterThan(1);
    for (let i = 1; i < blocks.length; i++) {
      expect(blocks[i].from).toBeGreaterThanOrEqual(blocks[i - 1].from);
    }
  });

  it('handles a mixed document with multiple block types', () => {
    const state = makeState('# Title\n\nSome text.\n\n- list item\n\n> quote\n\n```\ncode\n```');
    const blocks = getBlocks(state);
    const types = blocks.map((b) => b.type);
    expect(types).toContain('heading');
    expect(types).toContain('paragraph');
    expect(types).toContain('list');
    expect(types).toContain('blockquote');
    expect(types).toContain('fencedCode');
  });
});

describe('getBlockAt', () => {
  it('returns null for an empty block array', () => {
    expect(getBlockAt(0, [])).toBeNull();
  });

  it('finds the block containing a position', () => {
    const state = makeState('# Title\n\nparagraph');
    const blocks = getBlocks(state);
    const block = getBlockAt(5, blocks);
    expect(block).not.toBeNull();
    expect(block!.type).toBe('heading');
  });

  it('returns null for a position before all blocks', () => {
    const state = makeState('hello');
    const blocks = getBlocks(state);
    // Position -1 is before all blocks
    expect(getBlockAt(-1, blocks)).toBeNull();
  });

  it('returns null for a position after all blocks', () => {
    const state = makeState('hello');
    const blocks = getBlocks(state);
    // Position 100 is past the end
    expect(getBlockAt(100, blocks)).toBeNull();
  });

  it('finds the correct block at a boundary position', () => {
    const state = makeState('# Head\n\npara');
    const blocks = getBlocks(state);
    // Position at the very start of the second block
    const block = getBlockAt(blocks[1].from, blocks);
    expect(block).not.toBeNull();
    expect(block!.type).toBe('paragraph');
  });

  it('returns the last block for a position inside the last block', () => {
    const state = makeState('hello');
    const blocks = getBlocks(state);
    // Position 4 is inside the paragraph [0, 5)
    const block = getBlockAt(4, blocks);
    expect(block).not.toBeNull();
    expect(block!.type).toBe('paragraph');
  });
});
