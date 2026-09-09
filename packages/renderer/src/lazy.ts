import { renderMermaid } from './mermaid';
import { highlightCodeBlock } from './highlight';

let cachedKatex: Promise<(typeof import('katex'))['default'] | null> | null =
  null;

function loadKatex(): Promise<(typeof import('katex'))['default'] | null> {
  cachedKatex ??= import('katex')
    .then((m) => m.default)
    .catch(() => null);
  return cachedKatex;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function hydrateLazyFeatures(
  root: ParentNode,
  theme?: 'dark' | 'light',
): Promise<void> {
  if (!root) return;

  // KaTeX hydration — dynamic import, per-entry renderToString
  await hydrateKaTeX(root);

  // Mermaid — process all .mermaid-block wrappers (no quantity cap)
  const mermaidBlocks = Array.from(
    root.querySelectorAll<HTMLElement>('div.mermaid-block'),
  );
  if (mermaidBlocks.length > 0) {
    await Promise.allSettled(
      mermaidBlocks.map(async (block) => {
        try {
          await renderMermaid(block, theme);
        } catch {
          // Mermaid failure — source block stays visible
        }
      }),
    );
  }

  // Code highlighting
  const codeEls = Array.from(
    root.querySelectorAll<HTMLElement>('div.code-block code'),
  );
  if (codeEls.length > 0) {
    await Promise.allSettled(
      codeEls.map(async (codeEl) => {
        const langEl = codeEl
          .closest('.code-block')
          ?.querySelector('.code-lang');
        const langText = langEl?.textContent?.trim() ?? '';
        const source = codeEl.textContent ?? '';
        const highlighted = await highlightCodeBlock(source, langText);
        if (highlighted) {
          codeEl.innerHTML = highlighted;
        }
      }),
    );
  }
}

async function hydrateKaTeX(root: ParentNode): Promise<void> {
  const placeholders = Array.from(
    root.querySelectorAll<HTMLElement>('span[data-math]'),
  );
  if (placeholders.length === 0) return;

  const katex = await loadKatex();

  for (const node of placeholders) {
    // tex + displayMode live on the placeholder itself (embedded by math.ts at
    // render time), so hydration is scoped to this DOM and cannot be corrupted
    // by another renderMarkdown running concurrently.
    const tex = node.getAttribute('data-math-tex');
    if (tex === null) {
      node.remove();
      continue;
    }
    const displayMode = node.hasAttribute('data-math-display');

    if (!katex) {
      node.textContent = tex;
      continue;
    }

    try {
      const html = katex.renderToString(tex, {
        displayMode,
        throwOnError: false,
        output: 'html',
        strict: false,
      });
      const tpl = document.createElement('template');
      tpl.innerHTML = html;
      node.replaceWith(tpl.content);
    } catch {
      node.innerHTML = `<span class="katex-error">${escapeHtml(tex)}</span>`;
    }
  }
}
