/**
 * CORE PIPELINE TEST — md-bundle-v2 Task 1.2.
 *
 * Pins the real marked+DOMPurify pipeline ported from clairis
 * src/renderers/markdown.ts: rich-fixture rendering, injection stripping
 * (script / on* handlers / javascript: URLs / iframe), callout conversion
 * and folding, frontmatter stripping, figure+zoom markup, CJK spacing, and
 * 22-key calloutTypeMap snapshot. Imports ONLY the public entry
 * (`../src/index`) — the curtain contract stays the single surface.
 *
 * Evidence: facts collected at module scope are flushed to
 * test-results/markdown.json in afterAll.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { calloutTypeMap, renderMarkdown } from '../src/index';

const HERE = dirname(fileURLToPath(import.meta.url));
const EVIDENCE_PATH = join(HERE, '..', 'test-results', 'markdown.json');

const facts = {
  task: '1.2',
  richRender: false,
  injectionStripped: false,
  calloutFolds: false,
  frontmatterStripped: false,
  figureZoom: false,
  calloutKeys: 0,
  tests: 0,
};

const RICH_FIXTURE = [
  '# 标题 Title',
  '',
  '| 列 A | 列 B |',
  '| --- | --- |',
  '| 1 | 2 |',
  '',
  '> 普通引用 stays a quote',
  '',
  '> [!WARNING]- 折叠警告',
  '> 警告正文 body',
  '',
  '```js',
  'const answer = 42;',
  '```',
  '',
  '![示例图](/assets/pic.png "示例图注")',
  '',
  '中文abc混排 CJK 与Latin 之间需要间距',
].join('\n');

describe('rich fixture rendering', () => {
  it('renders headings, wrapped tables, quotes, callouts, code, figures, and CJK pads', () => {
    const html = renderMarkdown(RICH_FIXTURE);
    expect(html).toContain('<h1>');
    expect(html).toContain('标题');
    expect(html).toContain('class="table-wrap wide"');
    expect(html).toContain('<table>');
    // A plain blockquote (no [!TYPE] head) is left untouched.
    expect(html).toContain('<blockquote>');
    expect(html).toContain('普通引用');
    expect(html).toContain('data-callout="warning"');
    expect(html).toContain('class="code-block wide"');
    expect(html).toContain('code-lang');
    expect(html).toContain('code-copy');
    expect(html).toContain('<figure class="wide">');
    expect(html).toContain('cjk-pad');
    facts.richRender = true;
  });

  it('code fence content is escaped, never turned into live markup', () => {
    const html = renderMarkdown('```js\n<script>alert(1)</script>\n```');
    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;');
    expect(html).toContain('&gt;');
  });
});

describe('injection is stripped', () => {
  it('removes script tags and on* event attributes', () => {
    const html = renderMarkdown(
      '<div onclick="alert(1)">x</div><script>alert(2)</script>',
    );
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('alert(2)');
  });

  it('neutralizes javascript: URLs in links', () => {
    const html = renderMarkdown('[click](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
  });

  it('removes iframe and form tags', () => {
    const html = renderMarkdown(
      '<iframe src="https://evil.test"></iframe><form><input></form>',
    );
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('<form');
  });

  it('strips onerror from raw html while keeping text content', () => {
    const html = renderMarkdown('<img src="x" onerror="alert(1)"> after');
    expect(html).not.toContain('onerror');
    expect(html).toContain('after');
  });

  it('keeps task-list checkboxes but strips attributes from other inputs', () => {
    const html = renderMarkdown('- [x] done\n- [ ] todo\n\n<input type="text" value="x">');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('checked');
    expect(html).not.toContain('type="text"');
  });

  it('never throws and returns a string for any input', () => {
    expect(renderMarkdown('')).toBe('');
    expect(typeof renderMarkdown('\uFEFF---\nno closing fence')).toBe('string');
    expect(typeof renderMarkdown('> [!X]')).toBe('string');
  });

  it('records the injection evidence fact', () => {
    const html = renderMarkdown(
      '<script>alert(1)</script><img src=x onerror=alert(2)>[l](javascript:alert(3))<iframe src=x></iframe>',
    );
    expect(html).not.toMatch(/<script|onerror|javascript:|<iframe/);
    facts.injectionStripped = true;
  });

  it('strips javascript:/vbscript: from text nodes across multiple paragraphs (cross-node lastIndex)', () => {
    const md = [
      '段落一安全内容',
      '',
      '点击 javascript:alert(1) 获得惊喜',
      '',
      '段落三',
      '',
      '访问 vbscript:MsgBox(1) 查看',
      '',
      '段落五安全',
    ].join('\n');
    const html = renderMarkdown(md);
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('vbscript:');
    expect(html).toContain('段落一安全内容');
    expect(html).toContain('段落五安全');
  });
});

describe('callout conversion', () => {
  it('converts [!TYPE] blockquotes into callout elements with data-callout', () => {
    const html = renderMarkdown('> [!NOTE] 小提示\n> 正文内容');
    expect(html).toContain('data-callout="note"');
    expect(html).toContain('小提示');
    expect(html).toContain('正文内容');
    expect(html).not.toContain('<blockquote');
  });

  it('renders [!TYPE]- as a folded <details> and [!TYPE]+ as open', () => {
    const folded = renderMarkdown('> [!WARNING]- 折叠标题\n> 内容');
    expect(folded).toContain('<details');
    expect(folded).toContain('<summary');
    expect(folded).toContain('折叠标题');
    expect(folded).not.toContain('<details class="callout" data-callout="warning" open');

    const open = renderMarkdown('> [!TIP]+ 展开标题\n> 内容');
    expect(open).toContain('<details');
    expect(open).toContain('open');
    facts.calloutFolds = true;
  });

  it('falls back to the type label when no title is given', () => {
    const html = renderMarkdown('> [!TIP]\n> 正文内容');
    expect(html).toContain('data-callout="tip"');
    expect(html).toContain(calloutTypeMap.tip.label);
  });

  it('accepts custom type names with symbols and surrounding spaces', () => {
    expect(renderMarkdown('> [!TL;DR] 太长不看\n> 内容')).toContain(
      'data-callout="tl;dr"',
    );
    expect(renderMarkdown('> [! TL] 要点\n> 内容')).toContain('data-callout="tl"');
    expect(renderMarkdown('> [!NOTE ] 尾部空格\n> 内容')).toContain(
      'data-callout="note"',
    );
  });

  it('renders title and body exactly once each', () => {
    const html = renderMarkdown('> [!NOTE] 小标题\n> 正文内容');
    expect(html.match(/小标题/g)?.length).toBe(1);
    expect(html.match(/正文内容/g)?.length).toBe(1);
  });
});

describe('frontmatter stripping', () => {
  it('strips a leading YAML block so it never renders as hr/heading', () => {
    const html = renderMarkdown('---\ntags: [a, b]\ntitle: x\n---\n# 正文标题');
    expect(html).toContain('<h1>');
    expect(html).toContain('正文标题');
    expect(html).not.toContain('tags:');
    expect(html).not.toContain('<hr');
    facts.frontmatterStripped = true;
  });

  it('tolerates a BOM before the frontmatter fence', () => {
    const html = renderMarkdown('\uFEFF---\nkey: v\n---\nbody text');
    expect(html).toContain('body text');
    expect(html).not.toContain('key:');
  });

  it('keeps a --- that is not at the document start', () => {
    const html = renderMarkdown('前文\n\n---\n\n后文');
    expect(html).toContain('<hr');
    expect(html).toContain('后文');
  });
});

describe('image figure markup', () => {
  it('wraps images in figure.wide with data-zoomable and title captions', () => {
    const html = renderMarkdown('![替代文本](/a.png "图注")');
    expect(html).toContain('<figure class="wide">');
    expect(html).toContain('data-zoomable');
    expect(html).toContain('<figcaption>图注</figcaption>');
    facts.figureZoom = true;
  });

  it('omits figcaption when the image has no title', () => {
    const html = renderMarkdown('![替代文本](/a.png)');
    expect(html).toContain('<figure class="wide">');
    expect(html).toContain('data-zoomable');
    expect(html).not.toContain('<figcaption>');
  });
});

describe('CJK spacing', () => {
  it('inserts cjk-pad between CJK and latin runs, but never inside code', () => {
    expect(renderMarkdown('中文abc混合')).toContain('cjk-pad');
    const inline = renderMarkdown('`中文abc`');
    const code = inline.slice(inline.indexOf('<code>'), inline.indexOf('</code>'));
    expect(code).not.toContain('cjk-pad');
  });

  it('can be disabled per call without breaking the rest of the pipeline', () => {
    const html = renderMarkdown('中文abc混合', { cjkSpacing: false });
    expect(html).toContain('中文abc混合');
    expect(html).not.toContain('cjk-pad');
  });
});

describe('calloutTypeMap snapshot', () => {
  it('exposes exactly 22 keys with label, tone and icon on every entry', () => {
    const keys = Object.keys(calloutTypeMap).sort();
    facts.calloutKeys = keys.length;
    expect(keys).toEqual([
      'abstract',
      'attention',
      'bug',
      'caution',
      'check',
      'cite',
      'danger',
      'error',
      'example',
      'failure',
      'faq',
      'help',
      'hint',
      'important',
      'info',
      'note',
      'question',
      'quote',
      'success',
      'summary',
      'tip',
      'warning',
    ]);
    for (const key of keys) {
      expect(calloutTypeMap[key].label.length).toBeGreaterThan(0);
      expect(calloutTypeMap[key].tone.length).toBeGreaterThan(0);
      expect(calloutTypeMap[key].icon.length).toBeGreaterThan(0);
    }
  });

  it('pins the tone groups from the clairis reader.css snapshot', () => {
    expect(calloutTypeMap.note.tone).toBe('blue');
    expect(calloutTypeMap.tip.tone).toBe('green');
    expect(calloutTypeMap.important.tone).toBe('purple');
    expect(calloutTypeMap.warning.tone).toBe('orange');
    expect(calloutTypeMap.danger.tone).toBe('red');
    expect(calloutTypeMap.question.tone).toBe('teal');
    expect(calloutTypeMap.example.tone).toBe('gray');
    expect(calloutTypeMap.quote.tone).toBe('muted');
    expect(calloutTypeMap.abstract.tone).toBe('purple');
    expect(calloutTypeMap.summary.tone).toBe('purple');
    expect(calloutTypeMap.important.tone).toBe('purple');
  });
});

afterAll(() => {
  facts.tests = 24;
  mkdirSync(dirname(EVIDENCE_PATH), { recursive: true });
  writeFileSync(EVIDENCE_PATH, JSON.stringify(facts, null, 2));
});
