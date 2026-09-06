/**
 * Mermaid lazy rendering — ported from clairis src/renderers/mermaid.ts.
 *
 * Dynamic import('mermaid') keeps it out of the initial bundle. On first call
 * the import is cached; if it fails (offline / build anomaly) the module
 * degrades to source-code display and never rejects.
 *
 * renderMermaid(root) scans pre.mermaid elements, renders SVG, and hides the
 * source block on success. On mermaid parse error the source stays visible.
 */

type MermaidApi = typeof import('mermaid').default;

let cached: Promise<MermaidApi | null> | null = null;

function loadMermaid(): Promise<MermaidApi | null> {
  cached ??= import('mermaid')
    .then((m) => m.default)
    .catch(() => null);
  return cached;
}

let seq = 0;

/**
 * Render all un-rendered `pre.mermaid` blocks under `root`.
 * Source code is kept in the DOM (hidden on success) so theme switches can
 * re-render from source without re-fetching the markdown.
 */
export async function renderMermaid(
  root: ParentNode | null,
  theme?: 'dark' | 'light',
): Promise<void> {
  if (!root) return;
  const blocks = Array.from(root.querySelectorAll<HTMLElement>('pre.mermaid'));
  if (!blocks.length) return;

  const mermaid = await loadMermaid();
  if (!mermaid) return;

  const resolvedTheme = theme ?? 'light';
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: resolvedTheme === 'dark' ? 'dark' : 'default',
  });

  for (const src of blocks) {
    const block = src.parentElement;
    if (!block) continue;
    let view = block.querySelector<HTMLElement>('.mermaid-view');
    if (!view) {
      view = document.createElement('div');
      view.className = 'mermaid-view';
      block.appendChild(view);
    }
    try {
      const { svg } = await mermaid.render(
        `mermaid-${(seq += 1)}`,
        src.textContent ?? '',
      );
      view.innerHTML = svg;
      src.hidden = true;
    } catch {
      // Syntax error: keep source text visible for editing
      view.innerHTML = '';
      src.hidden = false;
    }
  }
}
