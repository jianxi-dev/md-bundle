/**
 * @md-bundle/renderer — public entry (barrel). The ONLY importable surface.
 *
 * Barrel contract (design.md Decision #1): exactly four runtime exports —
 * renderMarkdown, readerCssText, calloutTypeMap, hydrateLazyFeatures — plus
 * the RenderOptions type. The curtain test at test/public-api.test.ts pins
 * this surface; adding or removing an export must go through that test.
 *
 * Task 1.2: real marked+DOMPurify pipeline (ported from clairis).
 * Task 1.3: KaTeX/mermaid/highlight lazy hydration (placeholder).
 * Task 1.4: dual-theme reader CSS (placeholder).
 */

import { renderMarkdownCore, CALLOUT_TYPE_MAP } from './markdown';
import { hydrateLazyFeatures as hydrateImpl } from './lazy';
import { READER_CSS } from './readerCss';

/** Feature flags accepted by renderMarkdown. All optional; absence = off. */
export type RenderOptions = {
  math?: boolean;
  mermaid?: boolean;
  callouts?: boolean;
  cjkSpacing?: boolean;
  theme?: 'dark' | 'light';
};

/**
 * Render markdown to a sanitized HTML string. Pure and never throws; a
 * single failing feature degrades instead of failing the whole render.
 * Ported from clairis src/renderers/markdown.ts — pure Web pipeline.
 */
export function renderMarkdown(markdown: string, opts?: RenderOptions): string {
  return renderMarkdownCore(markdown, opts);
}

/**
 * Reader typography CSS, inlined by consumers at export time. Exposes
 * `[data-theme='dark'|'light']` dual blocks. Self-contained: all tokens
 * from tokens.css inlined; no external CSS dependency.
 */
export const readerCssText: string = READER_CSS;

/**
 * Callout type registry shared with the editor's callout decoration so both
 * render and editing surfaces agree on labels, icons and tones.
 */
export const calloutTypeMap: Readonly<
  Record<string, { label: string; tone: string; icon: string }>
> = CALLOUT_TYPE_MAP;

/**
 * Hydrate lazy features (KaTeX math, mermaid diagrams, code highlighting)
 * under `root`. Never rejects — every failure degrades in place so callers
 * can `await` unconditionally at async boundaries.
 */
export async function hydrateLazyFeatures(
  root: ParentNode,
  theme?: 'dark' | 'light',
): Promise<void> {
  return hydrateImpl(root, theme);
}
