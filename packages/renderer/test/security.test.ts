/**
 * SECURITY SANITIZATION TESTS — refs #135.
 *
 * Pins the hardened DOMPurify config: style/id stripping, data-attr
 * preservation, SANITIZE_NAMED_PROPS, and script removal.
 */
import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../src/index';

describe('DOMPurify attribute hardening', () => {
  it('strips style attribute from embedded HTML', () => {
    const html = renderMarkdown('<div style="color:red">x</div>');
    expect(html).not.toContain('style=');
    expect(html).toContain('<div');
    expect(html).toContain('x');
  });

  it('strips id attribute from embedded HTML', () => {
    const html = renderMarkdown('<div id="clobber">x</div>');
    expect(html).not.toContain('id=');
    expect(html).toContain('<div');
    expect(html).toContain('x');
  });

  it('preserves data-callout attribute (ALLOW_DATA_ATTR=true)', () => {
    const html = renderMarkdown('> [!INFO] note\n> body');
    expect(html).toContain('data-callout="info"');
  });

  it('sanitizes <a name="cookie"> via SANITIZE_NAMED_PROPS', () => {
    const html = renderMarkdown('<a name="cookie">trap</a>');
    expect(html).not.toContain('name=');
    expect(html).toContain('trap');
  });

  it('strips <script> tags entirely', () => {
    const html = renderMarkdown('<script>alert(1)</script>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('alert(1)');
  });
});
