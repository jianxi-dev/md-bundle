import type { Parser, Tree } from '@lezer/common';
import type { Highlighter } from '@lezer/highlight';

const MAX_HIGHLIGHT_CHARS = 20_000;
const CACHE_LIMIT = 50;
const cache = new Map<string, string>();

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

type HighlightDeps = {
  highlightCode: (
    code: string,
    tree: Tree,
    highlighter: Highlighter | readonly Highlighter[],
    callback: (code: string, classes: string) => void,
    lineBreak: () => void,
    from?: number,
    to?: number,
  ) => void;
  classHighlighter: Highlighter;
  LANGUAGES: Record<string, Parser>;
};

let cached: HighlightDeps | null = null;

function loadHighlightDeps(): Promise<HighlightDeps> {
  if (cached) return Promise.resolve(cached);

  return import('@lezer/highlight')
    .then(async (lezerMod) => {
      const [jsMod, pyMod, cssMod, htmlMod, jsonMod, yamlMod, mdMod] =
        await Promise.all([
          import('@codemirror/lang-javascript'),
          import('@codemirror/lang-python'),
          import('@codemirror/lang-css'),
          import('@codemirror/lang-html'),
          import('@codemirror/lang-json'),
          import('@codemirror/lang-yaml'),
          import('@codemirror/lang-markdown'),
        ]);
      cached = {
        highlightCode: lezerMod.highlightCode,
        classHighlighter: lezerMod.classHighlighter,
        LANGUAGES: {
          js: jsMod.javascriptLanguage.parser,
          mjs: jsMod.javascriptLanguage.parser,
          cjs: jsMod.javascriptLanguage.parser,
          node: jsMod.javascriptLanguage.parser,
          javascript: jsMod.javascriptLanguage.parser,
          jsx: jsMod.jsxLanguage.parser,
          ts: jsMod.typescriptLanguage.parser,
          typescript: jsMod.typescriptLanguage.parser,
          tsx: jsMod.tsxLanguage.parser,
          py: pyMod.pythonLanguage.parser,
          python: pyMod.pythonLanguage.parser,
          css: cssMod.cssLanguage.parser,
          html: htmlMod.htmlLanguage.parser,
          xml: htmlMod.htmlLanguage.parser,
          json: jsonMod.jsonLanguage.parser,
          jsonc: jsonMod.jsonLanguage.parser,
          yaml: yamlMod.yamlLanguage.parser,
          yml: yamlMod.yamlLanguage.parser,
          md: mdMod.markdownLanguage.parser,
          markdown: mdMod.markdownLanguage.parser,
        },
      };
      return cached;
    })
    .catch(() => {
      cached = { highlightCode: () => {}, classHighlighter: {} as Highlighter, LANGUAGES: {} };
      return cached;
    });
}

export async function highlightCodeBlock(
  code: string,
  lang?: string | null,
): Promise<string | null> {
  if (!lang || !code) return null;
  if (code.length > MAX_HIGHLIGHT_CHARS) return null;

  const deps = await loadHighlightDeps();

  const parser = deps.LANGUAGES[lang.trim().toLowerCase()];
  if (!parser) return null;

  const key = `${lang} ${code}`;
  const cached_val = cache.get(key);
  if (cached_val !== undefined) return cached_val;

  try {
    const tree = parser.parse(code);
    let out = '';
    deps.highlightCode(
      code,
      tree,
      deps.classHighlighter,
      (text, classes) => {
        out += classes
          ? `<span class="${classes}">${escapeHtml(text)}</span>`
          : escapeHtml(text);
      },
      () => {
        out += '\n';
      },
    );

    if (cache.size >= CACHE_LIMIT) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(key, out);
    return out;
  } catch {
    return null;
  }
}
