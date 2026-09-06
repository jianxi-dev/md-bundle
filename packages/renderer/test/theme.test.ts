/**
 * THEME TEST — md-bundle-v2 Task 1.4.
 *
 * Validates that readerCssText is a real dual-theme stylesheet:
 *   1. Contains both [data-theme='dark'] and [data-theme='light'] blocks.
 *   2. Body text contrast ≥ 4.5:1 (WCAG AA) in both themes.
 *   3. Dark theme includes mineral-family code token colors (.tok-*).
 *
 * Evidence: packages/renderer/test-results/theme.json
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { readerCssText } from '../src/index';

const HERE = dirname(fileURLToPath(import.meta.url));
const EVIDENCE_PATH = join(HERE, '..', 'test-results', 'theme.json');

// ── WCAG contrast helpers (independent of implementation) ──────────

/** sRGB channel → linear intensity (IEC 61966-2-1 §7). */
function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** WCAG 2.x relative luminance: L = 0.2126R + 0.7152G + 0.0722B. */
function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

/**
 * WCAG contrast ratio between two hex colors.
 * Ratio ∈ [1, 21]; ≥ 4.5 is AA for normal text.
 */
function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ── CSS extraction helpers ────────────────────────────────────────

/**
 * Split CSS into light and dark halves. The dark section starts at the
 * FIRST `[data-theme='dark']` occurrence in the full string. All later
 * occurrences (including inside `@media` blocks) are part of the dark
 * section. The light section ends just before the dark section begins.
 */
function splitThemes(css: string): { light: string; dark: string } {
  const darkRe = /\[data-theme=['"]dark['"]/g;
  const firstMatch = darkRe.exec(css);
  if (!firstMatch) return { light: css, dark: '' };

  let sectionStart = firstMatch.index;
  // Walk back to the start of the line (preceding newline or start)
  while (sectionStart > 0 && css[sectionStart - 1] !== '\n') {
    sectionStart--;
  }

  return {
    light: css.slice(0, sectionStart),
    dark: css.slice(sectionStart),
  };
}

/**
 * Extract a CSS custom property value from a CSS string.
 * Resolves var() references recursively (up to 3 levels).
 */
function extractVar(css: string, varName: string): string {
  const re = new RegExp(`${varName}\\s*:\\s*([^;]+);`);
  const m = re.exec(css);
  if (!m) return '';
  let value = m[1].trim();

  // Resolve var() references (up to 3 levels to avoid infinite loops)
  for (let i = 0; i < 3; i++) {
    const varRef = /var\(\s*(--[a-zA-Z0-9_-]+)/.exec(value);
    if (!varRef) break;
    const refName = varRef[1];
    const refRe = new RegExp(`${refName}\\s*:\\s*([^;]+);`);
    const refM = refRe.exec(css);
    if (!refM) break;
    value = refM[1].trim();
  }

  return value;
}

/**
 * Extract first #rrggbb hex color from a string.
 */
function extractHex(value: string): string {
  const m = /#([0-9a-f]{6})\b/i.exec(value);
  return m ? `#${m[1].toLowerCase()}` : '';
}

// ── Evidence ──────────────────────────────────────────────────────

const facts = {
  task: '1.4',
  darkBlock: false,
  lightBlock: false,
  contrastOkDark: false,
  contrastOkLight: false,
  tests: 0,
};

// ── Split CSS once for all tests ──────────────────────────────────

const { light: LIGHT_CSS, dark: DARK_CSS } = splitThemes(readerCssText);

// ── Tests ─────────────────────────────────────────────────────────

describe('readerCssText dual-theme', () => {
  it('is a non-empty string', () => {
    expect(typeof readerCssText).toBe('string');
    expect(readerCssText.length).toBeGreaterThan(0);
  });

  it('contains [data-theme="dark"] block', () => {
    facts.darkBlock = /\[data-theme\s*=\s*['"]?dark['"]?\]/.test(readerCssText);
    expect(facts.darkBlock).toBe(true);
  });

  it('contains [data-theme="light"] block', () => {
    facts.lightBlock = /\[data-theme\s*=\s*['"]?light['"]?\]/.test(readerCssText);
    expect(facts.lightBlock).toBe(true);
  });
});

describe('reader contrast WCAG AA (≥4.5:1)', () => {
  it('dark theme: paper vs ink contrast ≥ 4.5', () => {
    const paper = extractHex(extractVar(DARK_CSS, '--reader-paper'));
    const ink = extractHex(extractVar(DARK_CSS, '--reader-ink'));
    expect(paper).toMatch(/^#[0-9a-f]{6}$/);
    expect(ink).toMatch(/^#[0-9a-f]{6}$/);

    const ratio = contrastRatio(ink, paper);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    facts.contrastOkDark = true;
  });

  it('light theme: paper vs ink contrast ≥ 4.5', () => {
    const paper = extractHex(extractVar(LIGHT_CSS, '--reader-paper'));
    const ink = extractHex(extractVar(LIGHT_CSS, '--reader-ink'));
    expect(paper).toMatch(/^#[0-9a-f]{6}$/);
    expect(ink).toMatch(/^#[0-9a-f]{6}$/);

    const ratio = contrastRatio(ink, paper);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    facts.contrastOkLight = true;
  });
});

describe('dark theme code token colors', () => {
  it('dark section contains .tok-keyword color', () => {
    // Match: [data-theme='dark'] .tok-keyword { ... color: #... }
    const hasTokKeyword = /\[data-theme=['"]dark['"]\]\s+\.tok-keyword\b/.test(DARK_CSS);
    expect(hasTokKeyword).toBe(true);
    // Must have a color declaration
    const hasColor = /tok-keyword[^}]*color\s*:\s*#[0-9a-f]{3,8}/i.test(DARK_CSS);
    expect(hasColor).toBe(true);
  });

  it('dark section contains .tok-string color', () => {
    const hasTokString = /\[data-theme=['"]dark['"]\]\s+\.tok-string\b/.test(DARK_CSS);
    expect(hasTokString).toBe(true);
  });

  it('dark section contains .tok-comment color', () => {
    const hasTokComment = /\[data-theme=['"]dark['"]\]\s+\.tok-comment\b/.test(DARK_CSS);
    expect(hasTokComment).toBe(true);
  });

  it('dark section contains .tok-function color', () => {
    const hasTokFunction = /\[data-theme=['"]dark['"]\]\s+\.tok-function\b/.test(DARK_CSS);
    expect(hasTokFunction).toBe(true);
  });
});

afterAll(() => {
  facts.tests = 9;
  mkdirSync(dirname(EVIDENCE_PATH), { recursive: true });
  writeFileSync(EVIDENCE_PATH, JSON.stringify(facts, null, 2));
});
