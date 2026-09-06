import type { TokenizerAndRendererExtension } from 'marked';

export type MathEntry = { tex: string; displayMode: boolean };

let pending: MathEntry[] = [];

export function resetMathStore(): void {
  pending = [];
}

function pushMath(entry: MathEntry): number {
  return pending.push(entry) - 1;
}

export function takeMathEntry(id: number): MathEntry | undefined {
  return pending[id];
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
    const id = pushMath({ tex: String(token.text ?? ''), displayMode: true });
    return `<div class="katex-block wide"><span data-math="${id}"></span></div>`;
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
    const id = pushMath({ tex: String(token.text ?? ''), displayMode: false });
    return `<span data-math="${id}"></span>`;
  },
};
