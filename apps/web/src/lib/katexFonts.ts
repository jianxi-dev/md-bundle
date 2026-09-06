// KaTeX CSS + font data URI inlining for self-contained HTML exports.
// Only included when serialized HTML contains class="katex" (zero font bytes otherwise).
// Dual-path: browser (Vite) uses import.meta.glob + fetch; vitest (Node.js) reads filesystem directly.
import katexCss from 'katex/dist/katex.min.css?raw';

const fontUrls = import.meta.glob<string>(
  '../../node_modules/katex/dist/fonts/*.woff2',
  { eager: true, query: '?url' },
);

export function hasKatex(html: string): boolean {
  return /class="katex"/.test(html) || /data-math="/.test(html);
}

function extractFontFilenames(css: string): string[] {
  const seen = new Set<string>();
  for (const m of css.matchAll(/url\(fonts\/([^)]+)\)/g)) {
    seen.add(m[1]);
  }
  return [...seen];
}

async function readKatexFilesystem(): Promise<{ css: string; fontsDir: string } | null> {
  try {
    const { createRequire } = await import('node:module');
    const { readFileSync } = await import('node:fs');
    const { dirname, join } = await import('node:path');
    const req = createRequire(import.meta.url);
    const cssPath = req.resolve('katex/dist/katex.min.css');
    const fontsDir = join(dirname(cssPath), 'fonts');
    const css = readFileSync(cssPath, 'utf-8');
    return { css, fontsDir };
  } catch {
    return null;
  }
}

async function readFontFromFs(fontsDir: string, filename: string): Promise<string | null> {
  try {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const buf = readFileSync(join(fontsDir, filename));
    return `data:font/woff2;base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

async function fetchFontAsDataUri(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const buf = await resp.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return `data:font/woff2;base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

let cachedCss: string | null = null;

export async function getKatexCssInlined(): Promise<string> {
  if (cachedCss) return cachedCss;

  const globEntries = Object.entries(fontUrls);
  const useFs = globEntries.length === 0 || !katexCss;
  const fsResult = useFs ? await readKatexFilesystem() : null;

  let css = katexCss || (fsResult?.css ?? '');

  if (!useFs && globEntries.length > 0) {
    for (const [globPath, urlValue] of globEntries) {
      const url =
        typeof urlValue === 'string'
          ? urlValue
          : String((urlValue as Record<string, string>).default ?? urlValue);
      const filename = globPath.split('/').pop()!;
      const dataUri = await fetchFontAsDataUri(url);
      if (dataUri) css = css.replaceAll(`fonts/${filename}`, dataUri);
    }
  } else if (fsResult) {
    for (const filename of extractFontFilenames(css)) {
      const dataUri = await readFontFromFs(fsResult.fontsDir, filename);
      if (dataUri) css = css.replaceAll(`fonts/${filename}`, dataUri);
    }
  }

  cachedCss = css;
  return cachedCss;
}
