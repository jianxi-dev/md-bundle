import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MarkdownPreview } from '../src/preview';

describe('MarkdownPreview', () => {
  it('renders h1, table, and blockquote from markdown', () => {
    const markdown =
      '# T\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n> quote';
    const { container } = render(<MarkdownPreview markdown={markdown} />);
    expect(container.querySelector('h1')?.textContent).toBe('T');
    expect(container.querySelector('table')).toBeTruthy();
    expect(container.querySelector('blockquote')?.textContent).toContain(
      'quote',
    );
  });

  it('escapes script tags in the input', () => {
    const { container } = render(
      <MarkdownPreview markdown={'<script>alert(1)</script>'} />,
    );
    expect(container.innerHTML).toContain('&lt;script');
    expect(container.innerHTML).not.toContain('<script');
  });

  it('renders empty string without crashing', () => {
    const { container } = render(<MarkdownPreview markdown="" />);
    expect(container.querySelector('.markdown-body')).toBeTruthy();
  });

  it.each([
    ['<script>alert(1)</script>', 'plain'],
    ['<SCRIPT>alert(1)</SCRIPT>', 'uppercase'],
    ['<script\nalert(1)</script>', 'newline after tag name'],
  ])('neutralizes %s (%s)', (markdown) => {
    const { container } = render(<MarkdownPreview markdown={markdown} />);
    const html = container.innerHTML.toLowerCase();
    expect(html).not.toContain('<script');
    expect(html).not.toContain('</script');
    expect(html).toContain('&lt;script');
    expect(container.querySelector('script')).toBeNull();
  });

  it('keeps inline-code script as inert escaped text', () => {
    const { container } = render(<MarkdownPreview markdown={'`<script>`'} />);
    expect(container.querySelector('code')).toBeTruthy();
    expect(container.innerHTML).toContain('&amp;lt;script');
    expect(container.innerHTML).not.toContain('<script');
    expect(container.querySelector('script')).toBeNull();
  });

  it('strips event-handler attributes from raw HTML', () => {
    const { container } = render(
      <MarkdownPreview markdown={'<img src="x" onerror="alert(1)">'} />,
    );
    expect(container.innerHTML).not.toContain('onerror');
    expect(container.innerHTML).not.toContain('alert(1)');
    expect(container.querySelector('img')).toBeTruthy();
  });

  it('removes iframe from raw HTML', () => {
    const { container } = render(
      <MarkdownPreview markdown={'<iframe src="https://evil"></iframe>'} />,
    );
    expect(container.innerHTML).not.toContain('<iframe');
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('removes other dangerous tags (object, embed, link, meta)', () => {
    const { container } = render(
      <MarkdownPreview
        markdown={
          '<object data="x"></object>\n<embed src="x">\n<link rel="stylesheet" href="https://evil/x.css">\n<meta http-equiv="refresh" content="0;url=https://evil">'
        }
      />,
    );
    const html = container.innerHTML.toLowerCase();
    expect(html).not.toContain('<object');
    expect(html).not.toContain('<embed');
    expect(html).not.toContain('<link');
    expect(html).not.toContain('<meta');
  });

  it('keeps safe raw HTML tags', () => {
    const { container } = render(
      <MarkdownPreview markdown={'<div class="note"><span>hi</span></div>'} />,
    );
    expect(container.querySelector('div.note')).toBeTruthy();
    expect(container.querySelector('span')?.textContent).toBe('hi');
  });

  it('blocks javascript: URLs in markdown links', () => {
    const { container } = render(
      <MarkdownPreview markdown={'[click](javascript:alert(1))'} />,
    );
    expect(container.innerHTML).not.toContain('javascript:');
    const link = container.querySelector('a');
    expect(link).toBeTruthy();
    expect(link?.getAttribute('href')).not.toContain('javascript:');
  });

  it('blocks javascript: URLs in raw HTML href/src', () => {
    const { container } = render(
      <MarkdownPreview
        markdown={'<a href="javascript:alert(1)">x</a> <img src="javascript:alert(1)">'}
      />,
    );
    expect(container.innerHTML).not.toContain('javascript:');
    expect(container.querySelector('a')?.getAttribute('href')).toBe('');
  });

  it('renders fenced code containing script as inert code text', () => {
    const { container } = render(
      <MarkdownPreview markdown={'```\n<script>alert(1)</script>\n```'} />,
    );
    const code = container.querySelector('pre code');
    expect(code).toBeTruthy();
    expect(code?.textContent).toContain('script');
    expect(container.innerHTML).not.toContain('<script');
    expect(container.querySelector('script')).toBeNull();
  });

  it('applies theme tokens to the container', () => {
    const { container } = render(
      <MarkdownPreview markdown="# T" theme="light" />,
    );
    const body = container.querySelector('.markdown-body') as HTMLElement;
    expect(body.getAttribute('data-theme')).toBe('light');
    expect(body.style.background).toBe('rgb(255, 255, 255)');
    expect(body.style.color).toBe('rgb(31, 35, 40)');
  });

  it('defaults to dark theme tokens', () => {
    const { container } = render(<MarkdownPreview markdown="# T" />);
    const body = container.querySelector('.markdown-body') as HTMLElement;
    expect(body.getAttribute('data-theme')).toBe('dark');
    expect(body.style.background).toBe('rgb(13, 17, 23)');
  });
});