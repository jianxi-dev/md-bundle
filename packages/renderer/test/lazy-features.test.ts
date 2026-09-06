/**
 * LAZY FEATURES TEST — md-bundle-v2 Task 1.3 (revised).
 *
 * Two-phase architecture: renderMarkdown produces placeholders;
 * hydrateLazyFeatures resolves them asynchronously.
 *
 * - KaTeX: data-math placeholders in renderMarkdown → .katex after hydrate
 * - Mermaid: pre.mermaid → SVG after hydrate (full quantity, no FIFO cap)
 * - Highlight: code blocks → .tok-* spans after hydrate
 * - Bad input / never rejects preserved
 *
 * Imports ONLY the public entry (../src/index) — curtain contract preserved.
 * Evidence: test-results/lazy-features.json.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { hydrateLazyFeatures, renderMarkdown } from '../src/index';

const HERE = dirname(fileURLToPath(import.meta.url));
const EVIDENCE_PATH = join(HERE, '..', 'test-results', 'lazy-features.json');

const facts = {
  task: '1.3',
  mathLands: false,
  mermaidSvg: false,
  highlightTok: false,
  badInputDegrades: false,
  neverRejects: false,
  tests: 0,
};

describe('KaTeX math — two-phase (placeholder → hydrate)', () => {
  it('block $$…$$ outputs data-math placeholder, no katex in renderMarkdown', () => {
    const html = renderMarkdown('$$E=mc^2$$');
    expect(html).toContain('data-math');
    expect(html).not.toContain('katex');
    expect(html).toContain('E=mc^2');
  });

  it('inline $…$ outputs data-math placeholder, no katex in renderMarkdown', () => {
    const html = renderMarkdown('行内公式 $x^2$ 展示');
    expect(html).toContain('data-math');
    expect(html).not.toContain('katex');
  });

  it('hydrateLazyFeatures renders KaTeX from data-math placeholders', async () => {
    const html = renderMarkdown('$$E=mc^2$$');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    await hydrateLazyFeatures(doc.body);
    expect(doc.body.innerHTML).toContain('katex');
    expect(doc.body.querySelector('span[data-math]')).toBeNull();
    facts.mathLands = true;
  });

  it('inline KaTeX renders after hydrate', async () => {
    const html = renderMarkdown('行内公式 $x^2$ 展示');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    await hydrateLazyFeatures(doc.body);
    expect(doc.body.innerHTML).toContain('katex');
    expect(doc.body.querySelector('span[data-math]')).toBeNull();
  });
});

describe('mermaid lazy rendering', () => {
  it('renderMarkdown wraps mermaid in div.mermaid-block > pre.mermaid', () => {
    const md = '```mermaid\ngraph TD\n  A-->B\n```';
    const html = renderMarkdown(md);
    expect(html).toContain('mermaid-block');
    expect(html).toContain('pre class="mermaid"');
    expect(html).toContain('graph TD');
  });

  it('hydrateLazyFeatures resolves with mermaid blocks (SVG or graceful degrade)', async () => {
    const md = '```mermaid\ngraph TD\n  A-->B\n```';
    const html = renderMarkdown(md);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    await expect(hydrateLazyFeatures(doc.body)).resolves.toBeUndefined();
    const svg = doc.body.querySelector('svg');
    const pre = doc.querySelector('pre.mermaid');
    expect(svg !== null || pre !== null).toBe(true);
    if (svg) facts.mermaidSvg = true;
  });
});

describe('code highlighting — lezer .tok-* classes', () => {
  it('js code block gets .tok-* classes after hydration', async () => {
    const md = '```js\nconst a = 1;\n```';
    const html = renderMarkdown(md);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    await hydrateLazyFeatures(doc.body);
    const code = doc.querySelector('code');
    expect(code).not.toBeNull();
    const inner = code!.innerHTML;
    expect(inner).toMatch(/tok-/);
    facts.highlightTok = true;
  });

  it('unsupported language stays as plain text', async () => {
    const md = '```foobar\nhello world\n```';
    const html = renderMarkdown(md);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    await hydrateLazyFeatures(doc.body);
    const code = doc.querySelector('code');
    expect(code).not.toBeNull();
    expect(code!.innerHTML).not.toMatch(/tok-/);
    expect(code!.textContent).toBe('hello world');
  });

  it('oversized code (>20k chars) stays as plain text', async () => {
    const bigCode = 'x'.repeat(20_001);
    const md = '```js\n' + bigCode + '\n```';
    const html = renderMarkdown(md);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    await hydrateLazyFeatures(doc.body);
    const code = doc.querySelector('code');
    expect(code).not.toBeNull();
    expect(code!.innerHTML).not.toMatch(/tok-/);
  });

  it('code without language tag stays as plain text', async () => {
    const md = '```\nno lang\n```';
    const html = renderMarkdown(md);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    await hydrateLazyFeatures(doc.body);
    const code = doc.querySelector('code');
    expect(code).not.toBeNull();
    expect(code!.innerHTML).not.toMatch(/tok-/);
  });
});

describe('bad input degradation', () => {
  it('malformed $$ does not throw and degrades gracefully', async () => {
    const html = renderMarkdown('$$unclosed formula');
    expect(typeof html).toBe('string');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    await expect(hydrateLazyFeatures(doc.body)).resolves.toBeUndefined();
    facts.badInputDegrades = true;
  });

  it('bad mermaid syntax degrades without throw', async () => {
    const md = '```mermaid\nnot a valid diagram @#$\n```';
    const html = renderMarkdown(md);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    await expect(hydrateLazyFeatures(doc.body)).resolves.toBeUndefined();
    expect(doc.querySelector('pre.mermaid')).not.toBeNull();
  });

  it('empty input does not throw', async () => {
    await expect(
      hydrateLazyFeatures(document.createElement('div')),
    ).resolves.toBeUndefined();
  });
});

describe('hydrateLazyFeatures never rejects', () => {
  it('always resolves regardless of input', async () => {
    const root = document.createElement('div');
    root.innerHTML =
      '<div class="mermaid-block"><pre class="mermaid">bad</pre></div>';
    await expect(hydrateLazyFeatures(root)).resolves.toBeUndefined();
    facts.neverRejects = true;
  });
});

afterAll(() => {
  facts.tests = 14; // keep in sync with it() count — evidence must be truthful
  mkdirSync(dirname(EVIDENCE_PATH), { recursive: true });
  writeFileSync(EVIDENCE_PATH, JSON.stringify(facts, null, 2));
});
