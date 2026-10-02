/* Media reference rendering + sanitizer boundary — ticket #284. */
import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../src/index';

describe('media references (#284)', () => {
  it('renders a video-extension image reference as an inline <video controls>', () => {
    const html = renderMarkdown('![clip](clip.mp4)');
    expect(html).toContain('<video');
    expect(html).toContain('controls');
    expect(html).toContain('src="clip.mp4"');
  });

  it('renders a non-image/non-video reference as a file link', () => {
    const html = renderMarkdown('![report](report.pdf)');
    expect(html).toContain('mdb-file');
    expect(html).toContain('href="report.pdf"');
  });

  it('still renders image extensions as <img>', () => {
    const html = renderMarkdown('![pic](pic.png)');
    expect(html).toContain('<img');
  });

  it('keeps an embedded <video controls> through the sanitizer', () => {
    const html = renderMarkdown('<video controls src="clip.mp4"></video>');
    expect(html).toContain('<video');
    expect(html).toContain('controls');
  });

  it('drops javascript: URLs on media references', () => {
    const bad = renderMarkdown('<video src="javascript:alert(1)"></video>');
    expect(bad).not.toContain('javascript:');
    const badImg = renderMarkdown('![x](javascript:alert(1))');
    expect(badImg).not.toContain('javascript:');
  });
});
