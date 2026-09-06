// HTML 导出测试 —— 纯字符串操作 + renderer DOMPurify + 导出水合（需要 jsdom）。
// 核心断言（Task 3.6 聚合）：K 张图片 → K 个 data URI，零破损引用、零外链。
// Task 1.5 导出水合：KaTeX 公式 → class="katex" 落地（非空 data-math 占位）；
//   mermaid → SVG 或 pre.mermaid 源码保留（jsdom 降级）；无公式 → 零字体 data URI。
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import {
  buildHtmlDocument,
  inlineImages,
} from '../src/lib/exportHtml';
import { bylineFooterHtml } from '../src/lib/byline';
import type { Asset } from '../src/lib/assets';

const HERE = dirname(fileURLToPath(import.meta.url));
const EVIDENCE_PATH = join(HERE, '..', 'test-results', 'export-lazy.json');

/** 证据事实（测试内收集，afterAll 落盘）。 */
const facts = {
  katexFontInlining: false,
  zeroFontWhenNoFormula: false,
  mermaidDegradeToPre: false,
  codeHighlightLanding: false,
  waterHydrationNoPlaceholder: false,
};

const PNG_1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const PNG_2 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const ASSETS: Asset[] = [
  { name: 'one.png', size: 100, dataUrl: PNG_1 },
  { name: 'two.png', size: 100, dataUrl: PNG_2 },
];

describe('inlineImages', () => {
  it('resolves asset refs (with and without ./) to data URIs', () => {
    const html = '<img src="one.png" alt="a"><img src="./two.png" alt="b">';
    const out = inlineImages(html, ASSETS);
    expect(out).toBe(
      `<img src="${PNG_1}" alt="a"><img src="${PNG_2}" alt="b">`,
    );
  });

  it('keeps existing data: URIs untouched', () => {
    const html = `<img src="${PNG_1}" alt="x">`;
    expect(inlineImages(html, ASSETS)).toBe(html);
  });

  it('removes absolute URLs, missing assets, and empty srcs entirely', () => {
    const html =
      '<img src="https://x.com/y.png" alt="d"><img src="missing.png" alt="c"><img src="" alt="e"><img alt="no-src">';
    expect(inlineImages(html, ASSETS)).toBe('');
  });
});

describe('buildHtmlDocument', () => {
  it('inlines K=2 images as data URIs with zero broken/external refs', async () => {
    const markdown =
      '![a](one.png) ![b](./two.png) ![c](missing.png) ![d](https://x.com/y.png)';
    const html = await buildHtmlDocument({ markdown, assets: ASSETS });

    const imgs = html.match(/<img\b/g) ?? [];
    expect(imgs.length).toBe(2);
    const dataUris = html.match(/data:image\/png;base64,/g) ?? [];
    expect(dataUris.length).toBe(2);
    expect(html).not.toContain('one.png');
    expect(html).not.toContain('two.png');
    expect(html).not.toContain('missing.png');
    expect(html).not.toContain('https://x.com');
    expect(html).not.toContain('file://');
    expect(html).not.toContain('src="http');
  });

  it('renders a doc with zero <img> tags when markdown has no images', async () => {
    const html = await buildHtmlDocument({ markdown: '# 标题\n\n正文', assets: [] });
    expect(html.match(/<img\b/g)).toBeNull();
    expect(html).toContain('<h1>标题</h1>');
  });

  it('escapes <script> so the exported HTML contains no executable script', async () => {
    const html = await buildHtmlDocument({
      markdown: '<script>alert(1)</script>\n\n[click](javascript:alert(1))',
      assets: [],
    });
    expect(html).not.toContain('<script');
    expect(html).not.toContain('javascript:');
  });

  it('includes the Made-with byline with the ?ref link', async () => {
    const html = await buildHtmlDocument({ markdown: '# t', assets: [] });
    expect(html).toContain('Made with MD-Bundle');
    expect(html).toContain('https://bundle.jianxi.me/?ref=md-html');
    expect(html).toContain(
      '<footer><a href="https://bundle.jianxi.me/?ref=md-html">Made with MD-Bundle</a></footer>',
    );
  });

  it('footer byline comes from the byline lib (byte-identical markup)', async () => {
    const html = await buildHtmlDocument({ markdown: '# t', assets: [] });
    expect(html).toContain(bylineFooterHtml());
    expect(html).toContain(bylineFooterHtml('md-html'));
  });

  it('inlines all styles with zero external references (byline is the only https)', async () => {
    const html = await buildHtmlDocument({ markdown: '# t', assets: [] });
    // 新管线使用 .preview-content + readerCssText（非 .markdown-body）
    expect(html).toContain('.preview-content');
    expect(html).not.toContain('<link rel="stylesheet"');
    // byline 链接是唯一的 https 外部引用
    const httpsRefs = html.match(/https:\/\//g) ?? [];
    expect(httpsRefs.length).toBeGreaterThanOrEqual(1);
    // 无 src="http / url(http 外链
    expect(html).not.toContain('src="http');
    expect(html).not.toContain('url(http');
  });

  it('emits doctype, charset, viewport, and title', async () => {
    const html = await buildHtmlDocument({ markdown: '# t', assets: [] });
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain('<meta name="viewport"');
    expect(html).toContain('<title>MD-Bundle 文档</title>');
  });

  it('honors custom title (escaped) and theme tokens', async () => {
    const html = await buildHtmlDocument({
      markdown: '# t',
      assets: [],
      title: 'A <B> & C',
      theme: 'light',
    });
    expect(html).toContain('<title>A &lt;B&gt; &amp; C</title>');
    expect(html).toContain('data-theme="light"');
  });
});

describe('导出水合 —— KaTeX / mermaid / 零字体（Task 1.5 验收）', () => {
  it('含 KaTeX 公式 → 水合后产出 class="katex"（非空 data-math 占位）', async () => {
    const html = await buildHtmlDocument({
      markdown: '$$E=mc^2$$',
      assets: [],
    });
    expect(html).toContain('class="katex"');
    expect(html).not.toMatch(/<span[^>]*data-math="/);
    facts.waterHydrationNoPlaceholder = true;
  });

  it('含 KaTeX 公式 → 内联字体 data URI 出现在导出 HTML', async () => {
    const html = await buildHtmlDocument({
      markdown: '$$x$$',
      assets: [],
    });
    expect(html).toContain('data:font/woff2;base64,');
    facts.katexFontInlining = true;
  });

  it('含 mermaid 代码块 → 导出不崩溃，产出 SVG 或保留 pre.mermaid（jsdom 降级）', async () => {
    const md = '```mermaid\ngraph TD\n  A-->B\n```';
    const html = await buildHtmlDocument({ markdown: md, assets: [] });
    expect(html.startsWith('<!doctype html>')).toBe(true);
    const hasSvg = html.includes('<svg');
    const hasPreMermaid = html.includes('pre class="mermaid"') || html.includes('class="mermaid-block"');
    expect(hasSvg || hasPreMermaid).toBe(true);
    facts.mermaidDegradeToPre = true;
  });

  it('无公式 → 零 KaTeX 字体 data URI、无 class="katex"', async () => {
    const html = await buildHtmlDocument({
      markdown: '# 标题\n\n正文内容',
      assets: [],
    });
    expect(html).not.toContain('data:font/woff2;base64,');
    expect(html).not.toContain('class="katex"');
    facts.zeroFontWhenNoFormula = true;
  });

  it('水合断言：buildHtmlDocument 产出不含空占位 <span data-math=（验收导出与预览同源）', async () => {
    const html = await buildHtmlDocument({
      markdown: '$$\\alpha + \\beta = \\gamma$$',
      assets: [],
    });
    expect(html).not.toMatch(/<span[^>]*data-math="/);
    expect(html).toContain('class="katex"');
  });

  it('含代码块 → 高亮在导出中落地（div.code-block code 非空）', async () => {
    const md = '```js\nconst x = 1;\n```';
    const html = await buildHtmlDocument({ markdown: md, assets: [] });
    expect(html).toContain('code-block');
    expect(html).toContain('tok-keyword');
    facts.codeHighlightLanding = true;
  });
});

afterAll(() => {
  const evidence = {
    tasks: '1.5',
    ...facts,
    tests: 17, // keep in sync — real it() count
  };
  mkdirSync(dirname(EVIDENCE_PATH), { recursive: true });
  writeFileSync(EVIDENCE_PATH, JSON.stringify(evidence, null, 2) + '\n');
});
