// HTML 导出测试 —— 纯字符串操作，node 环境即可（marked 在 node 下正常）。
// 核心断言（Task 3.6 聚合）：K 张图片 → K 个 data URI，零破损引用、零外链。
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  buildHtmlDocument,
  inlineImages,
} from '../src/lib/exportHtml';
import { bylineFooterHtml } from '../src/lib/byline';
import type { Asset } from '../src/lib/assets';

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
  it('inlines K=2 images as data URIs with zero broken/external refs', () => {
    const markdown =
      '![a](one.png) ![b](./two.png) ![c](missing.png) ![d](https://x.com/y.png)';
    const html = buildHtmlDocument({ markdown, assets: ASSETS });

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

  it('renders a doc with zero <img> tags when markdown has no images', () => {
    const html = buildHtmlDocument({ markdown: '# 标题\n\n正文', assets: [] });
    expect(html.match(/<img\b/g)).toBeNull();
    expect(html).toContain('<h1>标题</h1>');
  });

  it('escapes <script> so the exported HTML contains no executable script', () => {
    const html = buildHtmlDocument({
      markdown: '<script>alert(1)</script>\n\n[click](javascript:alert(1))',
      assets: [],
    });
    expect(html).not.toContain('<script');
    expect(html).not.toContain('javascript:');
  });

  it('includes the Made-with byline with the ?ref link', () => {
    const html = buildHtmlDocument({ markdown: '# t', assets: [] });
    expect(html).toContain('Made with MD-Bundle');
    expect(html).toContain('https://bundle.jianxi.me/?ref=md-html');
    expect(html).toContain(
      '<footer><a href="https://bundle.jianxi.me/?ref=md-html">Made with MD-Bundle</a></footer>',
    );
  });

  it('footer byline comes from the byline lib (byte-identical markup)', () => {
    const html = buildHtmlDocument({ markdown: '# t', assets: [] });
    expect(html).toContain(bylineFooterHtml());
    expect(html).toContain(bylineFooterHtml('md-html'));
  });

  it('inlines all styles with zero external references (byline is the only https)', () => {
    const html = buildHtmlDocument({ markdown: '# t', assets: [] });
    expect(html).toContain('.markdown-body');
    expect(html).toContain('--base-size-16'); // github-markdown-css 特征规则
    expect(html).not.toContain('<link rel="stylesheet"');
    // 唯一 https 引用 = byline（github-markdown-css 内嵌 SVG data URI 里的
    // http://www.w3.org/2000/svg 是惰性 XML 命名空间，不是外部请求）。
    const httpsRefs = html.match(/https:\/\//g) ?? [];
    expect(httpsRefs.length).toBe(1);
    expect(httpsRefs[0]).toBe('https://');
    // 唯一 http(s) href = byline 链接本身；无 src="http / url(http 外链。
    const httpHrefs = html.match(/href="http/g) ?? [];
    expect(httpHrefs.length).toBe(1);
    expect(html).not.toContain('src="http');
    expect(html).not.toContain('url(http');
  });

  it('emits doctype, charset, viewport, and title', () => {
    const html = buildHtmlDocument({ markdown: '# t', assets: [] });
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain('<meta name="viewport"');
    expect(html).toContain('<title>MD-Bundle 文档</title>');
  });

  it('honors custom title (escaped) and theme tokens', () => {
    const html = buildHtmlDocument({
      markdown: '# t',
      assets: [],
      title: 'A <B> & C',
      theme: 'light',
    });
    expect(html).toContain('<title>A &lt;B&gt; &amp; C</title>');
    expect(html).toContain('background: #ffffff;');
    expect(html).toContain('data-theme="light"');
  });
});