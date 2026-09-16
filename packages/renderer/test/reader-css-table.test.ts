/**
 * TABLE WIDTH ADAPTATION — CSS rule assertion tests.
 *
 * Verifies that readerCssText contains the correct table width adaptation
 * rules: width: 100% (not max-content) for tables, overflow-wrap: anywhere
 * for th/td cells, and both light and dark theme variants.
 *
 * Evidence: facts collected at module scope are written to
 * test-results/reader-css-table.json in afterAll.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { readerCssText } from '../src/index';

const HERE = dirname(fileURLToPath(import.meta.url));
const EVIDENCE_PATH = join(HERE, '..', 'test-results', 'reader-css-table.json');

const facts = {
  task: 'reader-css-table',
  tests: 0,
};

describe('table width adaptation rules in readerCssText', () => {
  it('light theme table has width: 100%', () => {
    expect(readerCssText).toContain(
      "[data-theme='light'] .preview-content table",
    );
    const lightTableBlock = extractBlock(
      "[data-theme='light'] .preview-content table",
    );
    expect(lightTableBlock).toContain('width: 100%');
  });

  it('dark theme table has width: 100%', () => {
    expect(readerCssText).toContain(
      "[data-theme='dark'] .preview-content table",
    );
    const darkTableBlock = extractBlock(
      "[data-theme='dark'] .preview-content table",
    );
    expect(darkTableBlock).toContain('width: 100%');
  });

  it('light theme th/td has overflow-wrap: anywhere', () => {
    const block = extractBlock(
      "[data-theme='light'] .preview-content th,",
    );
    expect(block).toContain('overflow-wrap: anywhere');
  });

  it('dark theme th/td has overflow-wrap: anywhere', () => {
    const block = extractBlock(
      "[data-theme='dark'] .preview-content th,",
    );
    expect(block).toContain('overflow-wrap: anywhere');
  });

  it('does NOT contain width: max-content for table rules', () => {
    // Check that no table rule block uses max-content as width
    const tableBlocks = [
      extractBlock("[data-theme='light'] .preview-content table"),
      extractBlock("[data-theme='dark'] .preview-content table"),
    ];
    for (const block of tableBlocks) {
      expect(block).not.toContain('width: max-content');
    }
  });
});

/**
 * Extract the CSS rule block following a selector line.
 * Finds the selector, then captures text until the next closing brace.
 */
function extractBlock(selector: string): string {
  const idx = readerCssText.indexOf(selector);
  if (idx === -1) return '';
  const start = readerCssText.indexOf('{', idx);
  if (start === -1) return '';
  let depth = 0;
  for (let i = start; i < readerCssText.length; i++) {
    if (readerCssText[i] === '{') depth++;
    if (readerCssText[i] === '}') {
      depth--;
      if (depth === 0) return readerCssText.slice(start, i + 1);
    }
  }
  return readerCssText.slice(start);
}

afterAll(() => {
  facts.tests = 5;
  mkdirSync(dirname(EVIDENCE_PATH), { recursive: true });
  writeFileSync(EVIDENCE_PATH, JSON.stringify(facts, null, 2));
});
