import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../src/index';

describe('renderer callout merge bug reproduction', () => {
  it('should NOT merge two consecutive same-type callouts separated by blank line', () => {
    const md = `> [!DANGER]
> first

> [!DANGER]
> second
`;

    const html = renderMarkdown(md);
    console.log('HTML (blank line):', html);
    
    // Should have 2 callout elements
    const calloutMatches = html.match(/data-callout="danger"/g);
    console.log('Callout count:', calloutMatches?.length ?? 0);
    expect(calloutMatches?.length).toBe(2);
    
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
    console.log('HTML (adjacent):', html);
    
    // Should have 2 callout elements
    const calloutMatches = html.match(/data-callout="danger"/g);
    console.log('Callout count:', calloutMatches?.length ?? 0);
    expect(calloutMatches?.length).toBe(2);
    
    // Neither should contain literal [!DANGER] in body
    expect(html).not.toContain('[!DANGER]');
  });
});
