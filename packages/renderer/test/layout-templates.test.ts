/**
 * LAYOUT TEMPLATES + HTML BLOCK EMBEDDING TEST — issue #144.
 *
 * Pins: Pandoc fenced div → layout wrapper conversion, inner markdown
 * rendering, HTML block safe embedding (allowed tags preserved,
 * dangerous tags stripped), CSS class output, and responsive behavior.
 *
 * Evidence: facts flushed to test-results/layout-templates.json in afterAll.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { renderMarkdown } from '../src/index';

const HERE = dirname(fileURLToPath(import.meta.url));
const EVIDENCE_PATH = join(HERE, '..', 'test-results', 'layout-templates.json');

const facts = {
  task: '1.4-layout-templates',
  hero: false,
  col2: false,
  col3: false,
  cardGrid: false,
  timeline: false,
  cta: false,
  htmlBlockAllowed: false,
  htmlBlockStripped: false,
  dangerousBlocked: false,
  tests: 0,
};

describe('layout templates via fenced divs', () => {
  it('converts {.hero} into a section with layout-hero class and renders inner markdown', () => {
    const html = renderMarkdown(
      [
        '::: {.hero}',
        '',
        '# Welcome to My Site',
        '',
        'A beautiful hero banner with **bold** text.',
        '',
        ':::',
      ].join('\n'),
    );
    expect(html).toContain('class="layout-hero');
    expect(html).toContain('<section');
    expect(html).toContain('<h1>');
    expect(html).toContain('Welcome to My Site');
    expect(html).toContain('<strong>bold</strong>');
    facts.hero = true;
  });

  it('converts {.col-2} into a div with 50/50 grid class', () => {
    const html = renderMarkdown(
      [
        '::: {.col-2}',
        '',
        '## Left Column',
        'Content on the left.',
        '',
        '## Right Column',
        'Content on the right.',
        '',
        ':::',
      ].join('\n'),
    );
    expect(html).toContain('class="layout-col-2');
    expect(html).toContain('<div');
    expect(html).toContain('Left Column');
    expect(html).toContain('Right Column');
    facts.col2 = true;
  });

  it('converts {.col-3} into a div with 33/33/33 grid class', () => {
    const html = renderMarkdown(
      [
        '::: {.col-3}',
        '',
        '### One',
        'First.',
        '',
        '### Two',
        'Second.',
        '',
        '### Three',
        'Third.',
        '',
        ':::',
      ].join('\n'),
    );
    expect(html).toContain('class="layout-col-3');
    expect(html).toContain('One');
    expect(html).toContain('Two');
    expect(html).toContain('Three');
    facts.col3 = true;
  });

  it('converts {.card-grid cards:3} with data-columns attribute', () => {
    const html = renderMarkdown(
      [
        '::: {.card-grid cards:3}',
        '',
        '## Card A',
        'Card A body.',
        '',
        '## Card B',
        'Card B body.',
        '',
        '## Card C',
        'Card C body.',
        '',
        ':::',
      ].join('\n'),
    );
    expect(html).toContain('class="layout-card-grid');
    expect(html).toContain('data-columns="3"');
    expect(html).toContain('Card A');
    expect(html).toContain('Card B');
    expect(html).toContain('Card C');
    facts.cardGrid = true;
  });

  it('defaults card-grid to 3 columns when cards attr is omitted', () => {
    const html = renderMarkdown(
      [
        '::: {.card-grid}',
        '',
        '## Only Card',
        'Body.',
        '',
        ':::',
      ].join('\n'),
    );
    expect(html).toContain('class="layout-card-grid');
    expect(html).toContain('data-columns="3"');
  });

  it('converts {.timeline} into a div with layout-timeline class', () => {
    const html = renderMarkdown(
      [
        '::: {.timeline}',
        '',
        '### 2024',
        'Launched the project.',
        '',
        '### 2025',
        'Reached 1000 users.',
        '',
        ':::',
      ].join('\n'),
    );
    expect(html).toContain('class="layout-timeline');
    expect(html).toContain('2024');
    expect(html).toContain('2025');
    facts.timeline = true;
  });

  it('converts {.cta} into a section with layout-cta class', () => {
    const html = renderMarkdown(
      [
        '::: {.cta}',
        '',
        '## Get Started',
        '',
        'Join us today.',
        '',
        ':::',
      ].join('\n'),
    );
    expect(html).toContain('class="layout-cta');
    expect(html).toContain('<section');
    expect(html).toContain('Get Started');
    facts.cta = true;
  });

  it('leaves unclosed fenced divs untouched (renders as literal text)', () => {
    const html = renderMarkdown('::: {.hero}\n# No closing fence\n');
    // Should not crash; the content should still appear
    expect(html).toContain('No closing fence');
  });

  it('renders unknown fenced div class as layout-{name}', () => {
    const html = renderMarkdown(
      ['::: {.custom-layout}', '', '## Custom', 'Content.', '', ':::'].join('\n'),
    );
    expect(html).toContain('class="layout-custom-layout');
  });
});

describe('HTML block safe embedding', () => {
  it('preserves safe structural tags: div, section, article, aside', () => {
    const html = renderMarkdown(
      '<div>div content</div>\n\n<section>section content</section>\n\n<article>article content</article>\n\n<aside>aside content</aside>',
    );
    expect(html).toContain('<div>div content</div>');
    expect(html).toContain('<section>section content</section>');
    expect(html).toContain('<article>article content</article>');
    expect(html).toContain('<aside>aside content</aside>');
    facts.htmlBlockAllowed = true;
  });

  it('preserves safe text tags: mark, ins, del, kbd, samp, var', () => {
    const html = renderMarkdown(
      '<mark>marked</mark> <ins>inserted</ins> <kbd>key</kbd> <samp>sample</samp> <var>x</var>',
    );
    expect(html).toContain('<mark>marked</mark>');
    expect(html).toContain('<ins>inserted</ins>');
    expect(html).toContain('<kbd>key</kbd>');
    expect(html).toContain('<samp>sample</samp>');
    expect(html).toContain('<var>x</var>');
  });

  it('preserves interactive tags: details, summary', () => {
    const html = renderMarkdown(
      '<details><summary>Click to expand</summary>\n\nHidden content here.\n\n</details>',
    );
    expect(html).toContain('<details>');
    expect(html).toContain('<summary>Click to expand</summary>');
    expect(html).toContain('Hidden content');
  });

  it('preserves media tags: figure, figcaption', () => {
    const html = renderMarkdown(
      '<figure><img src="/test.png" alt="test" />\n\n<figcaption>A caption</figcaption>\n\n</figure>',
    );
    expect(html).toContain('<figure>');
    expect(html).toContain('<figcaption>A caption</figcaption>');
  });

  it('preserves list tags: ul, ol, li', () => {
    const html = renderMarkdown(
      '<ul><li>item 1</li><li>item 2</li></ul>\n\n<ol><li>first</li><li>second</li></ol>',
    );
    expect(html).toContain('<ul>');
    expect(html).toContain('<ol>');
    expect(html).toContain('<li>item 1</li>');
  });

  it('preserves table tags: table, thead, tbody, tr, th, td', () => {
    const html = renderMarkdown(
      [
        '<table>',
        '<thead><tr><th>Header</th></tr></thead>',
        '<tbody><tr><td>Cell</td></tr></tbody>',
        '</table>',
      ].join('\n'),
    );
    expect(html).toContain('<table>');
    expect(html).toContain('<thead>');
    expect(html).toContain('<tbody>');
    expect(html).toContain('<th>Header</th>');
    expect(html).toContain('<td>Cell</td>');
  });

  it('strips dangerous tags: script, form, input, button, iframe, object, embed', () => {
    const html = renderMarkdown(
      [
        '<script>alert(1)</script>',
        '<form action="/evil"><input type="text" /><button>Submit</button></form>',
        '<iframe src="https://evil.test"></iframe>',
        '<object data="evil.swf"></object>',
        '<embed src="evil.swf">',
        '<link rel="stylesheet" href="evil.css">',
      ].join('\n'),
    );
    expect(html).not.toContain('<script');
    expect(html).not.toContain('alert(1)');
    expect(html).not.toContain('<form');
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('<object');
    expect(html).not.toContain('<embed');
    expect(html).not.toContain('<link');
    facts.dangerousBlocked = true;
  });

  it('strips style tags and style attributes', () => {
    const html = renderMarkdown(
      '<style>body { background: red; }</style>\n\n<div style="color: red">styled</div>',
    );
    expect(html).not.toContain('<style');
    expect(html).not.toContain('background: red');
    // style attribute should be stripped
    expect(html).not.toContain('style="color: red"');
    // but the content should remain
    expect(html).toContain('styled');
  });

  it('strips event handler attributes from all tags', () => {
    const html = renderMarkdown(
      '<div onclick="alert(1)" onmouseover="alert(2)">content</div>',
    );
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('onmouseover');
    expect(html).toContain('content');
  });
});

afterAll(() => {
  facts.tests = 16;
  mkdirSync(dirname(EVIDENCE_PATH), { recursive: true });
  writeFileSync(EVIDENCE_PATH, JSON.stringify(facts, null, 2));
});
