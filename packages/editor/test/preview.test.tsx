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
});
