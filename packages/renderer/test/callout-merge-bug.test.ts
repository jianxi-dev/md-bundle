import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../src/index';

// #393: 相邻同类型 callout 不应合并，且拆分必须保留每个 callout 正文的 HTML 结构。
// (structure assertions live below; text-level assertions are the exact symptom.)

const count = (html: string, re: RegExp): number => html.match(re)?.length ?? 0;

describe('renderer callout merge bug reproduction', () => {
  it('should NOT merge two consecutive same-type callouts separated by blank line', () => {
    const md = `> [!DANGER]
> first

> [!DANGER]
> second
`;

    const html = renderMarkdown(md);

    // Should have 2 callout elements
    expect(count(html, /data-callout="danger"/g)).toBe(2);

    // Neither should contain literal [!DANGER] in body
    expect(html).not.toContain('[!DANGER]');
  });

  it('should NOT merge two directly adjacent same-type callouts (no blank line)', () => {
    const md = `> [!DANGER]
> first
> [!DANGER]
> second
`;

    const html = renderMarkdown(md);

    // Should have 2 callout elements
    expect(count(html, /data-callout="danger"/g)).toBe(2);

    // Neither should contain literal [!DANGER] in body
    expect(html).not.toContain('[!DANGER]');
  });

  it('preserves inline HTML structure in each adjacent callout body (regression #393)', () => {
    const md = `> [!DANGER]
> **bold** [l](https://x.com) \`c\`
> [!DANGER]
> *em* second
`;

    const html = renderMarkdown(md);

    // Two callouts, no literal opener leaks.
    expect(count(html, /data-callout="danger"/g)).toBe(2);
    expect(html).not.toContain('[!DANGER]');
    expect(html).not.toContain('**bold**');
    expect(html).not.toContain('[l](https://x.com)');

    // Structural survival: each rich node must render as real markup.
    expect(count(html, /<strong>bold<\/strong>/g)).toBe(1);
    expect(count(html, /<a href="https:\/\/x\.com"[^>]*>l<\/a>/g)).toBe(1);
    expect(count(html, /<code>c<\/code>/g)).toBe(1);
    expect(count(html, /<em>em<\/em>/g)).toBe(1);
  });

  it('preserves block list structure when the second adjacent callout holds a list (#393)', () => {
    const md = `> [!DANGER]
> **bold** [l](https://x.com) \`c\`
> [!DANGER]
> - item one
> - item two
`;

    const html = renderMarkdown(md);

    expect(count(html, /data-callout="danger"/g)).toBe(2);
    expect(html).not.toContain('[!DANGER]');
    expect(html).not.toContain('**bold**');

    // Inline structure of the first callout body survives.
    expect(count(html, /<strong>bold<\/strong>/g)).toBe(1);
    expect(count(html, /<a href="https:\/\/x\.com"[^>]*>l<\/a>/g)).toBe(1);
    expect(count(html, /<code>c<\/code>/g)).toBe(1);

    // Block list structure of the second callout body survives.
    expect(count(html, /<ul>/g)).toBe(1);
    expect(count(html, /<li>item one<\/li>/g)).toBe(1);
    expect(count(html, /<li>item two<\/li>/g)).toBe(1);
  });
});
