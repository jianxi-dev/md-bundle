import type { TokenizerAndRendererExtension } from 'marked';

// Escape tex for safe embedding in a double-quoted HTML attribute. The value is
// decoded back to its original form by getAttribute at hydrate time, so this
// only needs to survive the marked → DOMPurify → innerHTML round-trip.
function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const mathBlockExtension: TokenizerAndRendererExtension = {
  name: 'mathBlock',
  level: 'block',
  tokenizer(src) {
    const m = /^ {0,3}\$\$[ \t]*\n([\s\S]*?)\n[ \t]*\$\$(?:\n|$)/.exec(src);
    if (!m) return undefined;
    return { type: 'mathBlock', raw: m[0], text: m[1].trim() };
  },
  renderer(token) {
    // tex is embedded directly on the placeholder so hydration is scoped to
    // THIS document — no shared module store that a concurrent renderMarkdown
    // could repopulate out from under an in-flight KaTeX hydrate (lazy.ts).
    const tex = String(token.text ?? '');
    return `<div class="katex-block wide"><span data-math data-math-display data-math-tex="${escapeAttr(tex)}"></span></div>`;
  },
};

export const mathInlineExtension: TokenizerAndRendererExtension = {
  name: 'mathInline',
  level: 'inline',
  start(src) {
    return src.indexOf('$');
  },
  tokenizer(src) {
    const m = /^\$(?!\s)([^$\n]*?)(?<!\s)\$(?!\d)/.exec(src);
    if (!m) return undefined;
    return { type: 'mathInline', raw: m[0], text: m[1] };
  },
  renderer(token) {
    const tex = String(token.text ?? '');
    return `<span data-math data-math-tex="${escapeAttr(tex)}"></span>`;
  },
};
