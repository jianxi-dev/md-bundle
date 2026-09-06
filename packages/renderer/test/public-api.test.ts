/**
 * PUBLIC-API CURTAIN TEST — md-bundle-v2 Task 1.1.
 *
 * Imports ONLY from `../src/index` (the public entry) and pins the FULL
 * barrel contract declared in design.md Decision #1: exactly four runtime
 * exports (renderMarkdown / readerCssText / calloutTypeMap /
 * hydrateLazyFeatures) plus the RenderOptions compile-time type. If any name
 * is added, removed, or changes kind, this file is the tripwire.
 *
 * Evidence: facts collected at module scope are written to
 * test-results/public-api.json in afterAll (same pattern as
 * apps/web/test/badges.test.ts).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import * as api from '../src/index';
import {
  calloutTypeMap,
  hydrateLazyFeatures,
  readerCssText,
  renderMarkdown,
  type RenderOptions,
} from '../src/index';

const HERE = dirname(fileURLToPath(import.meta.url));
const EVIDENCE_PATH = join(HERE, '..', 'test-results', 'public-api.json');

/** Evidence facts (collected inside tests, flushed in afterAll). */
const facts = {
  task: '1.1',
  publicSurface: [] as string[],
  exportSetMatches: false,
  typeProbe: false,
  renderReturnsString: false,
  hydrateResolves: false,
  tests: 0,
};

// Compile-time type probe — fails typecheck if RenderOptions stops being
// exported or narrows its optionality (types erase at runtime, so this is
// the only way to pin the type surface). `void` reference satisfies
// noUnusedLocals.
const _probe: RenderOptions = { math: true, theme: 'dark' };
void _probe;

describe('public export contract', () => {
  it('exports exactly the four documented runtime members and nothing else', () => {
    const keys = Object.keys(api).sort();
    facts.publicSurface = keys;
    expect(keys).toEqual([
      'calloutTypeMap',
      'hydrateLazyFeatures',
      'readerCssText',
      'renderMarkdown',
    ]);
    facts.exportSetMatches = true;
  });

  it('each runtime export has its documented kind', () => {
    expect(typeof renderMarkdown).toBe('function');
    expect(typeof hydrateLazyFeatures).toBe('function');
    expect(typeof readerCssText).toBe('string');
    expect(typeof calloutTypeMap).toBe('object');
  });

  it('renderMarkdown returns a string and never throws', () => {
    expect(typeof renderMarkdown('# t')).toBe('string');
    facts.renderReturnsString = true;
  });

  it('hydrateLazyFeatures always resolves (never rejects)', async () => {
    const root = document.createElement('div');
    await expect(hydrateLazyFeatures(root, 'dark')).resolves.toBeUndefined();
    await expect(hydrateLazyFeatures(root)).resolves.toBeUndefined();
    facts.hydrateResolves = true;
  });

  it('RenderOptions accepts every documented flag (compile-time probe is referenced)', () => {
    const opts: RenderOptions = {
      math: true,
      mermaid: true,
      callouts: true,
      cjkSpacing: true,
      theme: 'light',
    };
    expect(opts).toBeDefined();
    facts.typeProbe = true;
  });
});

afterAll(() => {
  facts.tests = 5;
  mkdirSync(dirname(EVIDENCE_PATH), { recursive: true });
  writeFileSync(EVIDENCE_PATH, JSON.stringify(facts, null, 2));
});
