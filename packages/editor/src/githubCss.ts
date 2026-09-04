import githubMarkdownCss from 'github-markdown-css/github-markdown.css?raw';

/**
 * Raw github-markdown-css text (vite `?raw` import — resolved from this
 * package's own dependency, so apps/web needs no extra dep).
 *
 * The export pipeline (apps/web exportHtml) inlines this into the exported
 * document's `<style>` block so the HTML is fully self-contained — zero
 * external requests. The CSS carries `[data-theme="dark"]` selectors, which
 * the exported `.markdown-body` div activates via its `data-theme` attribute.
 */
export const githubMarkdownCssText: string = githubMarkdownCss;