/**
 * Chapter tree tests — verifies heading tree model operations.
 *
 * Tests buildTree, computeSections, moveSection, extractSubtree,
 * and flattenTree over synthetic heading data.
 */
import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import {
  getHeadings,
  buildTree,
  computeSections,
  moveSection,
  extractSubtree,
  flattenTree,
  type HeadingEntry,
} from '../src/chapter-tree';

function makeState(doc: string): EditorState {
  return EditorState.create({ doc, extensions: [markdown()] });
}

// Helper: build HeadingEntry arrays without the editor (for pure unit tests).
function h(level: number, from: number, to: number, text: string): HeadingEntry {
  return { level, from, to, text };
}

describe('getHeadings', () => {
  it('returns empty array for document without headings', () => {
    const state = makeState('Just some text.\n\nNo headings here.');
    expect(getHeadings(state)).toEqual([]);
  });

  it('extracts a single H1', () => {
    const state = makeState('# Title');
    const headings = getHeadings(state);
    expect(headings).toHaveLength(1);
    expect(headings[0].level).toBe(1);
    expect(headings[0].text).toBe('Title');
  });

  it('extracts multiple heading levels', () => {
    const state = makeState('# H1\n## H2\n### H3');
    const headings = getHeadings(state);
    expect(headings).toHaveLength(3);
    expect(headings[0].level).toBe(1);
    expect(headings[1].level).toBe(2);
    expect(headings[2].level).toBe(3);
  });

  it('strips trailing # markers', () => {
    const state = makeState('## Title ##');
    const headings = getHeadings(state);
    expect(headings[0].text).toBe('Title');
  });

  it('returns headings sorted by document position', () => {
    const state = makeState('# First\n\n## Second\n\n### Third');
    const headings = getHeadings(state);
    expect(headings.map((h) => h.text)).toEqual(['First', 'Second', 'Third']);
    for (let i = 1; i < headings.length; i++) {
      expect(headings[i].from).toBeGreaterThan(headings[i - 1].from);
    }
  });
});

describe('buildTree', () => {
  it('returns empty array for no headings', () => {
    expect(buildTree([])).toEqual([]);
  });

  it('creates a single root for a single heading', () => {
    const tree = buildTree([h(1, 0, 7, 'Title')]);
    expect(tree).toHaveLength(1);
    expect(tree[0].heading.text).toBe('Title');
    expect(tree[0].children).toEqual([]);
  });

  it('nests H2 under H1', () => {
    const headings = [
      h(1, 0, 7, 'Chapter'),
      h(2, 8, 16, 'Section'),
    ];
    const tree = buildTree(headings);
    expect(tree).toHaveLength(1);
    expect(tree[0].heading.text).toBe('Chapter');
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].heading.text).toBe('Section');
  });

  it('nests H3 under H2', () => {
    const headings = [
      h(1, 0, 7, 'Chapter'),
      h(2, 8, 16, 'Section'),
      h(3, 17, 25, 'Subsection'),
    ];
    const tree = buildTree(headings);
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].children).toHaveLength(1);
    expect(tree[0].children[0].children[0].heading.text).toBe('Subsection');
  });

  it('handles multiple H1 roots', () => {
    const headings = [
      h(1, 0, 7, 'First'),
      h(1, 8, 16, 'Second'),
    ];
    const tree = buildTree(headings);
    expect(tree).toHaveLength(2);
    expect(tree[0].heading.text).toBe('First');
    expect(tree[1].heading.text).toBe('Second');
  });

  it('handles heading level skip (H1 → H3 attaches to H1)', () => {
    const headings = [
      h(1, 0, 7, 'Chapter'),
      h(3, 8, 16, 'Skipped'),
    ];
    const tree = buildTree(headings);
    expect(tree).toHaveLength(1);
    expect(tree[0].heading.text).toBe('Chapter');
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].heading.text).toBe('Skipped');
  });

  it('handles sibling H2s under one H1', () => {
    const headings = [
      h(1, 0, 7, 'Chapter'),
      h(2, 8, 14, 'Sec A'),
      h(2, 15, 21, 'Sec B'),
    ];
    const tree = buildTree(headings);
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children[0].heading.text).toBe('Sec A');
    expect(tree[0].children[1].heading.text).toBe('Sec B');
  });
});

describe('computeSections', () => {
  it('returns empty array for no headings', () => {
    expect(computeSections([], 100)).toEqual([]);
  });

  it('computes single section to end of document', () => {
    const headings = [h(1, 0, 7, 'Title')];
    const sections = computeSections(headings, 50);
    expect(sections).toHaveLength(1);
    expect(sections[0].from).toBe(0);
    expect(sections[0].to).toBe(50);
  });

  it('computes section boundaries at next same-level heading', () => {
    const headings = [
      h(1, 0, 7, 'First'),
      h(1, 20, 28, 'Second'),
    ];
    const sections = computeSections(headings, 50);
    expect(sections).toHaveLength(2);
    expect(sections[0].from).toBe(0);
    expect(sections[0].to).toBe(20);
    expect(sections[1].from).toBe(20);
    expect(sections[1].to).toBe(50);
  });

  it('H2 section ends at next H1 or H2', () => {
    const headings = [
      h(1, 0, 7, 'Chapter'),
      h(2, 8, 16, 'Section'),
      h(1, 30, 38, 'Next Chapter'),
    ];
    const sections = computeSections(headings, 60);
    expect(sections).toHaveLength(3);
    // H2 section ends at next H1 (position 30).
    expect(sections[1].from).toBe(8);
    expect(sections[1].to).toBe(30);
  });
});

describe('moveSection', () => {
  const doc = '# A\n\ncontent A\n\n# B\n\ncontent B\n\n# C\n\ncontent C';
  // Headings: A at 0-3, B at 16-19, C at 32-35
  const headings = [
    h(1, 0, 3, 'A'),
    h(1, 16, 19, 'B'),
    h(1, 32, 35, 'C'),
  ];
  const sections = computeSections(headings, doc.length);

  it('returns original doc for out-of-bounds source index', () => {
    const result = moveSection(doc, sections, 99, 0);
    expect(result.newText).toBe(doc);
  });

  it('moves first section to end', () => {
    const result = moveSection(doc, sections, 0, 3);
    // After moving A to end: B, C, A
    expect(result.newText).toBe('# B\n\ncontent B\n\n# C\n\ncontent C\n\n# A\n\ncontent A');
  });

  it('moves last section to beginning', () => {
    const result = moveSection(doc, sections, 2, 0);
    // After moving C to beginning: C, A, B
    expect(result.newText).toBe('# C\n\ncontent C\n\n# A\n\ncontent A\n\n# B\n\ncontent B');
  });

  it('moves middle section to end', () => {
    const result = moveSection(doc, sections, 1, 3);
    // After moving B to end: A, C, B
    expect(result.newText).toBe('# A\n\ncontent A\n\n# C\n\ncontent C\n\n# B\n\ncontent B');
  });

  it('is a no-op when moving to same position', () => {
    // Moving section 0 to position 0 (before heading 0) should keep it in place.
    const result = moveSection(doc, sections, 0, 0);
    expect(result.newText).toBe(doc);
  });
});

describe('extractSubtree', () => {
  it('extracts a section without demotion', () => {
    // H1 section includes all content until next H1 or end of document.
    const doc = '# Chapter\n\nIntro text.\n\n## Section\n\nSection content.';
    const state = makeState(doc);
    const headings = getHeadings(state);
    const sections = computeSections(headings, doc.length);
    // Section 1 = the H2 "Section" (from its heading to end of doc).
    const extracted = extractSubtree(doc, sections[1]);
    expect(extracted).toContain('## Section');
    expect(extracted).toContain('Section content.');
    expect(extracted).not.toContain('# Chapter');
  });

  it('extracts H1 section with all sub-content', () => {
    const doc = '# Chapter\n\nIntro text.\n\n## Section\n\nSection content.\n\n# Next';
    const state = makeState(doc);
    const headings = getHeadings(state);
    const sections = computeSections(headings, doc.length);
    // Section 0 = H1 "Chapter" — includes H2 content until next H1.
    const extracted = extractSubtree(doc, sections[0]);
    expect(extracted).toContain('# Chapter');
    expect(extracted).toContain('Intro text.');
    expect(extracted).toContain('## Section');
    expect(extracted).not.toContain('# Next');
  });

  it('demotes headings by specified levels', () => {
    const subDoc = '## Section\n\nSection content.\n\n### Subsection\n\nSub content.';
    const subState = makeState(subDoc);
    const subHeadings = getHeadings(subState);
    const subSections = computeSections(subHeadings, subDoc.length);
    const extracted = extractSubtree(subDoc, subSections[0], 1);
    // H2 → H1, H3 → H2
    expect(extracted).toContain('# Section');
    expect(extracted).toContain('## Subsection');
  });
});

describe('flattenTree', () => {
  it('returns empty array for empty tree', () => {
    expect(flattenTree([])).toEqual([]);
  });

  it('flattens a simple tree with depth', () => {
    const headings = [
      h(1, 0, 7, 'Chapter'),
      h(2, 8, 16, 'Section'),
      h(3, 17, 25, 'Subsection'),
    ];
    const tree = buildTree(headings);
    const flat = flattenTree(tree);
    expect(flat).toHaveLength(3);
    expect(flat[0].depth).toBe(0);
    expect(flat[0].node.heading.text).toBe('Chapter');
    expect(flat[1].depth).toBe(1);
    expect(flat[1].node.heading.text).toBe('Section');
    expect(flat[2].depth).toBe(2);
    expect(flat[2].node.heading.text).toBe('Subsection');
  });

  it('flattens siblings at same depth', () => {
    const headings = [
      h(1, 0, 7, 'Chapter'),
      h(2, 8, 14, 'Sec A'),
      h(2, 15, 21, 'Sec B'),
    ];
    const tree = buildTree(headings);
    const flat = flattenTree(tree);
    expect(flat).toHaveLength(3);
    expect(flat[1].depth).toBe(1);
    expect(flat[2].depth).toBe(1);
  });
});
