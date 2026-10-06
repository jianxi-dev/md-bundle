/**
 * Living-source decoration theme.
 *
 * The decoration modules (heading/boldItalic/list/quote/code/image/callout)
 * only emit DOM classes (`.cm-strong`, `.cm-quote`, `.cm-callout`, …); this
 * extension is what actually makes them *look* like rendered Markdown in edit
 * mode — Typora-style "living source".
 *
 * D1 (non-destructive parity, design.md): the editor content area carries the
 * `preview-content` class (via EditorView.contentAttributes) so the reader CSS
 * — the single style source — applies. Its variables (`--reader-ink-strong`,
 * `--type-font-sans`, `--reader-radius`, …) are available to every decoration
 * rule below, and the per-type values are aligned to the reader CSS so a given
 * block's computed styles are equal in edit and preview. The container box
 * (max-width, margin-inline, padding-inline) comes from the reader CSS on
 * `.preview-content`; only block-axis padding and the `.preview-content > *`
 * child rule (which would add per-line margins and centering that break CM6
 * line layout) are overridden.
 *
 * Semantic editing mode: two visual states per block.
 * - Non-active (`.cm-block-inactive`): fully rendered, zero syntax markers.
 * - Active (`.cm-block-active`): semantic reveal — structure markers shown at
 *   low opacity for structural awareness.
 *
 * Transitions: opacity fades for marker reveal (100–150ms) so state changes
 * feel smooth. Bold/italic have no transition (instant, as they never change).
 *
 * Deliberately written as an `EditorView.baseTheme` so the styles are present
 * whenever decorations are enabled, while referencing the reader CSS
 * variables (and `--mdb-*` design tokens where no reader equivalent exists)
 * so both dark and light `data-theme` values are honoured.
 */
import { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';

/**
 * Per-tone callout border/badge colour, keyed by the `cm-callout-tone-*`
 * classes the callout widget emits. Mirrors the renderer's calloutTypeMap
 * tones (blue/green/orange/red/purple/teal/gray/muted) but maps the primary
 * semantic tones onto theme-aware `--mdb-*` tokens so dark/light stay legible.
 */
const calloutToneSpecs = (): Record<string, Record<string, string>> => ({
  '.cm-content .cm-callout.cm-callout-tone-blue': {
    '--callout-color': 'var(--mdb-primary-fg)',
    '--callout-soft': 'var(--mdb-selection)',
  },
  '.cm-content .cm-callout.cm-callout-tone-green': {
    '--callout-color': 'var(--mdb-success)',
    '--callout-soft': 'rgba(63, 185, 80, 0.12)',
  },
  '.cm-content .cm-callout.cm-callout-tone-orange': {
    '--callout-color': 'var(--mdb-warning)',
    '--callout-soft': 'rgba(210, 153, 34, 0.12)',
  },
  '.cm-content .cm-callout.cm-callout-tone-red': {
    '--callout-color': 'var(--mdb-danger)',
    '--callout-soft': 'rgba(248, 81, 73, 0.12)',
  },
  '.cm-content .cm-callout.cm-callout-tone-purple': {
    '--callout-color': '#a371f7',
    '--callout-soft': 'rgba(163, 113, 247, 0.14)',
  },
  '.cm-content .cm-callout.cm-callout-tone-teal': {
    '--callout-color': '#35c4c4',
    '--callout-soft': 'rgba(53, 196, 196, 0.14)',
  },
  '.cm-content .cm-callout.cm-callout-tone-gray': {
    '--callout-color': 'var(--mdb-text-secondary)',
    '--callout-soft': 'var(--mdb-surface)',
  },
  '.cm-content .cm-callout.cm-callout-tone-muted': {
    '--callout-color': 'var(--mdb-muted)',
    '--callout-soft': 'var(--mdb-surface)',
  },
});

/**
 * Base theme extension that styles every living-source decoration class.
 * Include this once inside the `editorDecorations()` extension so the DOM
 * produced by the decoration field renders as styled Markdown.
 *
 * Per-type values (font-size, font-weight, border-radius, padding, …) are
 * aligned to the reader CSS (packages/renderer/src/readerCss.ts) so a given
 * block's computed styles are equal in edit and preview (D1 non-destructive
 * parity). Reader CSS variables are available on `.cm-content` because the
 * `editorDecorations` extension also adds the `preview-content` class to it
 * (see editorContentScope below).
 */
export const editorDecorationsTheme: Extension = EditorView.baseTheme({
  // ── Layout stability: fixed line height for all decorated lines ──────
  '.cm-content .cm-line': {
    lineHeight: '1.7em',
    transition: 'opacity 100ms ease-out',
  },

  // ── Heading marker (raw "# " prefix) ─────────────────────────────────
  // Non-active: marker hidden (opacity 0) so only rendered heading text shows.
  // display:inline-block + fixed line-height preserves layout (no CLS).
  '.cm-content .cm-heading-marker': {
    display: 'inline-block',
    fontSize: '0.72em',
    fontWeight: '600',
    letterSpacing: '0.02em',
    lineHeight: '1',
    color: 'var(--mdb-primary-fg)',
    marginRight: '0.35em',
    verticalAlign: 'middle',
    userSelect: 'none',
    opacity: '0',
    transition: 'opacity 120ms ease-out',
  },

  // Active block: heading marker shown at low opacity (semantic reveal).
  '.cm-content .cm-heading-marker-active': {
    opacity: '0.4',
    fontFamily: 'var(--mdb-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
    marginRight: '0.25em',
  },

  // ── Heading text scaling (mark applied over the heading content) ─────
  // Values aligned to reader CSS (packages/renderer/src/readerCss.ts) so
  // computed styles are equal in edit and preview (D1 non-destructive parity).
  '.cm-content .cm-heading': {
    color: 'var(--reader-ink-strong)',
    fontWeight: '650',
    lineHeight: '1.3',
    transition: 'font-size 120ms ease-out',
  },
  '.cm-content .cm-heading.cm-h1': { fontSize: '1.75em', fontWeight: '700', letterSpacing: '0.01em' },
  '.cm-content .cm-heading.cm-h2': { fontSize: '1.4em', fontWeight: '700', letterSpacing: '0.005em' },
  '.cm-content .cm-heading.cm-h3': { fontSize: '1.2em', lineHeight: '1.4' },
  '.cm-content .cm-heading.cm-h4': { fontSize: '1.05em', lineHeight: '1.4' },
  '.cm-content .cm-heading.cm-h5': { fontSize: '0.95em', color: 'var(--reader-ink-2)', lineHeight: '1.4' },
  '.cm-content .cm-heading.cm-h6': { fontSize: '0.875em', fontWeight: '600', letterSpacing: '0.04em', color: 'var(--reader-ink-3)', lineHeight: '1.4' },

  // ── Bold / italic (no transition — instant) ─────────────────────────
  '.cm-content .cm-strong': { fontWeight: '650', color: 'var(--mdb-text)' },
  '.cm-content .cm-em': { fontStyle: 'italic' },
  // Strikethrough / underline inline markers (ticket #260 — hide raw ~~ / <u> tags)
  '.cm-content .cm-strikethrough': { textDecoration: 'line-through' },
  '.cm-content .cm-underline': { textDecoration: 'underline' },
  '.cm-content .cm-font-serif': { fontFamily: 'var(--mdb-font-serif, Georgia, serif)' },
  '.cm-content .cm-font-mono': { fontFamily: 'var(--mdb-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)' },
  '.cm-content .cm-font-sans': { fontFamily: 'var(--mdb-font-sans, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif)' },
  '.cm-content .cm-color-red': { color: 'var(--mdb-danger)' },
  '.cm-content .cm-color-blue': { color: 'var(--mdb-primary)' },
  '.cm-content .cm-color-green': { color: 'var(--mdb-success)' },
  '.cm-content .cm-color-orange': { color: 'var(--mdb-warning)' },
  '.cm-content .cm-color-purple': { color: '#a371f7' },
  '.cm-content .cm-color-yellow': { color: '#f0b622' },
  '.cm-content .cm-color-cyan': { color: '#20b2aa' },
  // Background colors (ticket #278): translucent so they stay readable on
  // both dark and light editor surfaces. Mirrors the renderer's dark palette.
  '.cm-content .cm-bg-red': { backgroundColor: 'rgba(248, 81, 73, 0.25)' },
  '.cm-content .cm-bg-blue': { backgroundColor: 'rgba(123, 134, 234, 0.25)' },
  '.cm-content .cm-bg-green': { backgroundColor: 'rgba(63, 185, 80, 0.25)' },
  '.cm-content .cm-bg-orange': { backgroundColor: 'rgba(227, 179, 65, 0.25)' },
  '.cm-content .cm-bg-purple': { backgroundColor: 'rgba(163, 113, 247, 0.25)' },
  '.cm-content .cm-bg-yellow': { backgroundColor: 'rgba(240, 182, 34, 0.25)' },
  '.cm-content .cm-bg-cyan': { backgroundColor: 'rgba(32, 178, 170, 0.25)' },
  '.cm-content .cm-bg-gray': { backgroundColor: 'rgba(235, 235, 235, 0.22)' },
  '.cm-content .cm-bg-darkred': { backgroundColor: 'rgba(179, 68, 68, 0.30)' },
  '.cm-content .cm-bg-brown': { backgroundColor: 'rgba(132, 81, 23, 0.30)' },
  '.cm-content .cm-bg-olive': { backgroundColor: 'rgba(135, 123, 16, 0.30)' },
  '.cm-content .cm-bg-darkgreen': { backgroundColor: 'rgba(41, 107, 34, 0.30)' },
  '.cm-content .cm-bg-navy': { backgroundColor: 'rgba(32, 62, 120, 0.30)' },
  '.cm-content .cm-bg-indigo': { backgroundColor: 'rgba(77, 38, 145, 0.30)' },
  '.cm-content .cm-bg-slate': { backgroundColor: 'rgba(95, 95, 95, 0.30)' },

  // ── Lists (values aligned to reader CSS) ──────────────────────────────
  '.cm-content .cm-line.cm-list': {
    paddingInlineStart: '1.5em',
    lineHeight: '1.7em',
  },
  '.cm-content .cm-line.cm-list:not(.cm-list-ordered):not(.cm-task-done):not(.cm-task-pending)::before': {
    content: "'•  '",
    color: 'var(--reader-ink-3, var(--mdb-muted))',
    transition: 'opacity 100ms ease-out',
  },
  '.cm-content .cm-task-checkbox': {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '14px',
    height: '14px',
    marginInlineEnd: '0.4em',
    border: '1.5px solid var(--mdb-muted)',
    borderRadius: '3px',
    cursor: 'pointer',
    verticalAlign: 'middle',
    transition: 'background 100ms ease-out, border-color 100ms ease-out',
  },
  '.cm-content .cm-task-checkbox[data-checked="true"]': {
    background: 'var(--mdb-success)',
    borderColor: 'var(--mdb-success)',
  },
  '.cm-content .cm-task-checkbox[data-checked="true"]::after': {
    content: "'✓'",
    fontSize: '10px',
    lineHeight: '1',
    color: '#ffffff',
  },
  // Recede the whole checked row to tertiary ink (not just the checkbox widget,
  // so the ✓ stays white on green). `.cm-task-pending` stays untouched on purpose.
  '.cm-content .cm-line.cm-task-done': {
    color: 'var(--reader-ink-3, var(--mdb-muted))',
  },

  // Ordered-list digit marker: always visible (a digit IS the marker).
  '.cm-content .cm-list-marker': {
    color: 'var(--mdb-primary-fg)',
    fontFamily: 'var(--mdb-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
    fontSize: '0.9em',
    marginInlineEnd: '0.25em',
    transition: 'opacity 100ms ease-out',
  },

  // Active list block: show the raw marker at low opacity.
  '.cm-content .cm-list-marker-active': {
    color: 'var(--mdb-muted)',
    opacity: '0.4',
    fontFamily: 'var(--mdb-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
    fontSize: '0.85em',
    transition: 'opacity 100ms ease-out',
  },

  // ── Blockquote (values aligned to reader CSS) ─────────────────────────
  '.cm-content .cm-line.cm-quote': {
    borderInlineStart: '2px solid var(--reader-accent, var(--mdb-primary-fg))',
    paddingInlineStart: '1em',
    paddingBlock: '0.7em',
    color: 'var(--reader-ink-2, var(--mdb-text-secondary))',
    marginBlock: '0 0',
    lineHeight: '1.7em',
    background: 'var(--reader-accent-soft, transparent)',
    borderRadius: '0 var(--reader-radius, 6px) var(--reader-radius, 6px) 0',
    transition: 'border-color 100ms ease-out',
  },

  // Active quote block: show the > marker at low opacity.
  '.cm-content .cm-quote-marker-active': {
    color: 'var(--mdb-primary-fg)',
    opacity: '0.4',
    fontFamily: 'var(--mdb-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
    fontSize: '0.85em',
    marginInlineEnd: '0.25em',
    transition: 'opacity 100ms ease-out',
  },

  // ── Inline code (values aligned to reader CSS) ───────────────────────
  '.cm-content .cm-inline-code': {
    fontFamily:
      'var(--type-font-mono, var(--mdb-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace))',
    fontSize: '0.88em',
    color: 'var(--reader-ink, var(--mdb-primary-fg))',
    backgroundColor: 'var(--reader-sunken, var(--mdb-code-bg))',
    border: '1px solid var(--reader-line, var(--mdb-border))',
    borderRadius: '4px',
    padding: '0.12em 0.35em',
    transition: 'background-color 100ms ease-out, border-color 100ms ease-out',
  },

  // Active code block: show faint backticks.
  '.cm-content .cm-code-marker-active': {
    color: 'var(--mdb-muted)',
    opacity: '0.4',
    fontFamily: 'var(--mdb-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
    fontSize: '0.85em',
    transition: 'opacity 100ms ease-out',
  },

  // ── Fenced code block (values aligned to reader CSS) ──────────────────
  // Reader CSS sets font-family/font-size on `pre`/`code` inside .code-block,
  // not on .code-block itself — so the block element inherits sans/17px from
  // the container. We match that here.
  '.cm-content .cm-fenced-code': {
    backgroundColor: 'var(--reader-sunken, var(--mdb-code-bg))',
    color: 'var(--reader-ink, var(--mdb-text))',
    border: '1px solid var(--reader-line, var(--mdb-border))',
    borderRadius: 'var(--reader-radius, 6px)',
  },
  '.cm-content .cm-fenced-code.cm-block-inactive': {
    backgroundColor: 'var(--reader-sunken, var(--mdb-code-bg))',
  },
  '.cm-content .cm-fenced-code.cm-block-active': {
    // Active: faint background so the user sees the code structure.
    backgroundColor: 'color-mix(in srgb, var(--mdb-code-bg) 60%, transparent)',
  },

  // Language label widget on the fence opening line.
  '.cm-content .cm-fenced-code-language': {
    display: 'inline-block',
    fontSize: '0.75em',
    fontWeight: '500',
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
    color: 'var(--mdb-muted)',
    backgroundColor: 'var(--mdb-surface)',
    border: '1px solid var(--mdb-border)',
    borderRadius: '4px',
    padding: '0.1em 0.45em',
    marginLeft: '0.5em',
    verticalAlign: 'middle',
    userSelect: 'none',
    float: 'right',
    lineHeight: '1.4',
    transition: 'opacity 100ms ease-out, color 100ms ease-out',
  },
  '.cm-content .cm-fenced-code-language-active': {
    opacity: '0.5',
    color: 'var(--mdb-text-secondary)',
  },

  // ── Inline image widget ───────────────────────────────────────────────
  '.cm-content .cm-image-widget': {
    marginInline: '0.15em',
    verticalAlign: 'middle',
  },
  '.cm-content .cm-image-fallback': {
    color: 'var(--mdb-text-secondary)',
    fontStyle: 'italic',
  },
  '.cm-content .cm-image-toolbar': {
    backgroundColor: 'var(--mdb-bg-secondary)',
    color: 'var(--mdb-text)',
    borderColor: 'var(--mdb-border)',
  },

  // ── Media widgets (video player / file card) ──────────────────────────
  '.cm-content .cm-media-widget': {
    marginInline: '0.15em',
    verticalAlign: 'middle',
  },
  '.cm-content .cm-media-widget video': {
    display: 'block',
    maxWidth: '100%',
    borderRadius: 'var(--reader-radius, 6px)',
  },
  '.cm-content .cm-media-file': {
    display: 'inline-flex',
    alignItems: 'center',
    maxWidth: '100%',
    padding: '0.35em 0.7em',
    border: '1px solid var(--reader-line, var(--mdb-border))',
    borderRadius: 'var(--reader-radius, 6px)',
    backgroundColor: 'var(--reader-sunken, var(--mdb-code-bg))',
  },
  '.cm-content .cm-media-file a': {
    color: 'var(--mdb-primary-fg)',
    textDecoration: 'none',
    overflowWrap: 'anywhere',
  },

  // ── Mermaid block (inactive block: fence replaced by the diagram) ─────
  '.cm-content .cm-mermaid-block': {
    display: 'block',
    // Reserve height so the widget does not collapse before hydration swaps
    // in the SVG, and so a failed render still leaves a visible source box.
    minHeight: '80px',
    marginBlock: '0.4em 0',
    padding: '1em 1.1em',
    backgroundColor: 'var(--reader-sunken, var(--mdb-code-bg))',
    border: '1px solid var(--reader-line, var(--mdb-border))',
    borderRadius: 'var(--reader-radius, 6px)',
    overflowX: 'auto',
  },
  '.cm-content .cm-mermaid-block pre.mermaid': {
    margin: '0',
    color: 'var(--reader-ink-2, var(--mdb-text-secondary))',
    fontFamily: 'var(--type-font-mono, var(--mdb-font-mono, ui-monospace, monospace))',
    fontSize: '0.85em',
    whiteSpace: 'pre-wrap',
  },
  '.cm-content .cm-mermaid-block .mermaid-view svg': {
    display: 'block',
    maxWidth: '100%',
    height: 'auto',
    marginInline: 'auto',
  },

  // ── Callout card (values aligned to reader CSS) ───────────────────────
  '.cm-content .cm-callout': {
    display: 'block',
    position: 'relative',
    padding: '0.75em 1em',
    marginBlock: '0.4em 0',
    borderInlineStart: '3px solid var(--callout-color, var(--reader-accent, var(--mdb-primary-fg)))',
    backgroundColor: 'var(--callout-soft, var(--reader-accent-soft, var(--mdb-selection)))',
    borderRadius: 'var(--reader-radius, 6px)',
    color: 'var(--reader-ink, var(--mdb-text))',
  },
  '.cm-content .cm-callout-header': {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.5em',
  },
  '.cm-content .cm-callout-icon': {
    fontSize: '1em',
    lineHeight: '1',
    flexShrink: '0',
    cursor: 'pointer',
    borderRadius: '4px',
    padding: '0 2px',
  },
  '.cm-content .cm-callout-icon:hover': {
    backgroundColor: 'rgba(127, 127, 127, 0.18)',
  },
  '.cm-content .cm-callout-emoji-picker': {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: '0',
    zIndex: '30',
    width: '224px',
    padding: '6px',
    backgroundColor: 'var(--mdb-bg-secondary)',
    border: '1px solid var(--mdb-border)',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.18)',
  },
  '.cm-content .cm-callout-emoji-search': {
    boxSizing: 'border-box',
    width: '100%',
    height: '26px',
    marginBottom: '6px',
    padding: '0 6px',
    border: '1px solid var(--mdb-border)',
    borderRadius: '4px',
    backgroundColor: 'transparent',
    color: 'var(--mdb-text)',
    font: 'inherit',
    fontSize: '12px',
    outline: 'none',
  },
  '.cm-content .cm-callout-emoji-grid': {
    display: 'grid',
    gridTemplateColumns: 'repeat(8, 1fr)',
    gap: '2px',
    maxHeight: '140px',
    overflowY: 'auto',
  },
  '.cm-content .cm-callout-emoji-option': {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    padding: '0',
    border: 'none',
    borderRadius: '4px',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: '16px',
    lineHeight: '1',
  },
  '.cm-content .cm-callout-emoji-option:hover': {
    backgroundColor: 'rgba(127, 127, 127, 0.18)',
  },
  '.cm-content .cm-callout-emoji-reset': {
    display: 'block',
    width: '100%',
    height: '26px',
    marginTop: '6px',
    border: '1px solid var(--mdb-border)',
    borderRadius: '4px',
    background: 'transparent',
    color: 'var(--mdb-text-secondary)',
    cursor: 'pointer',
    fontSize: '12px',
  },
  '.cm-content .cm-callout-emoji-reset:hover': {
    backgroundColor: 'rgba(127, 127, 127, 0.12)',
  },
  '.cm-content .cm-callout-badge': {
    fontSize: '0.8em',
    fontWeight: '650',
    color: 'var(--callout-color, var(--mdb-primary-fg))',
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
  },
  '.cm-content .cm-callout-title': {
    fontWeight: '600',
  },
  '.cm-content .cm-callout-content': {
    color: 'var(--mdb-text-secondary)',
    fontSize: '0.92em',
    whiteSpace: 'pre-wrap',
    marginTop: '0.35em',
  },
  // Callout body lines are block elements (the old plain-text node relied on
  // `white-space: pre-wrap`); min-height keeps blank lines the same height they
  // had as preserved newlines, and backs the list line's own 1.7em.
  '.cm-content .cm-callout-content .cm-callout-line': {
    minHeight: '1.7em',
  },
  '.cm-content .cm-columns': {
    marginBlock: '0.4em',
  },
  '.cm-content .cm-column': {
    position: 'relative',
    minWidth: '0',
    padding: '2px 6px',
  },
  '.cm-content .cm-column-body': {
    whiteSpace: 'pre-wrap',
    minHeight: '1.2em',
  },
  '.cm-content .cm-column-handle': {
    position: 'absolute',
    left: '0',
    top: '0',
    width: '14px',
    height: '14px',
    borderRadius: 'var(--reader-radius, 4px)',
    border: '1px solid var(--reader-line, var(--mdb-border))',
    background: 'var(--reader-sunken, var(--mdb-bg-secondary))',
    opacity: '0',
    cursor: 'pointer',
    zIndex: '6',
  },
  '.cm-content .cm-column:hover .cm-column-handle': {
    opacity: '1',
  },
  '.cm-content .cm-column-gutter': {
    flex: '0 0 12px',
    position: 'relative',
    cursor: 'col-resize',
  },
  '.cm-content .cm-column-gutter-line': {
    position: 'absolute',
    left: '50%',
    top: '0',
    bottom: '0',
    width: '2px',
    transform: 'translateX(-50%)',
    background: 'transparent',
    borderRadius: '1px',
  },
  '.cm-content .cm-column-gutter:hover .cm-column-gutter-line': {
    background: 'var(--reader-accent, var(--mdb-primary-fg))',
  },
  '.cm-content .cm-callout-editor': {
    display: 'block',
    width: '100%',
    boxSizing: 'border-box',
    marginTop: '0.35em',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    resize: 'none',
    overflow: 'hidden',
    font: 'inherit',
    fontSize: '0.92em',
    color: 'var(--mdb-text-secondary)',
  },

  // ── Thematic break (horizontal rule) ────────────────────────────────────
  '.cm-content .cm-thematic-break': {
    border: 'none',
    borderTop: '1px solid var(--mdb-border)',
    margin: '0.7em 0',
    width: '100%',
  },

  // ── Link ────────────────────────────────────────────────────────────────
  '.cm-content .cm-link': {
    color: 'var(--mdb-primary-fg)',
    textDecoration: 'underline',
    textDecorationColor: 'var(--mdb-primary-fg)',
    textUnderlineOffset: '2px',
    cursor: 'pointer',
  },
  '.cm-content .cm-link.cm-block-active': {
    // Active block: show raw source, but keep link text styled
    textDecoration: 'underline',
    textDecorationColor: 'var(--mdb-muted)',
    color: 'var(--mdb-text)',
  },

  // ── Tables (values aligned to reader CSS) ─────────────────────────────
  '.cm-content .cm-table': {
    borderCollapse: 'separate',
    borderSpacing: '0',
    margin: '0.35em 0',
    fontSize: '0.95em',
    width: '100%',
  },
  '.cm-content .cm-table th, .cm-content .cm-table td': {
    position: 'relative',
    borderBottom: '1px solid var(--reader-line, var(--mdb-border))',
    padding: '0.55em 0.8em',
    textAlign: 'left',
    verticalAlign: 'top',
    cursor: 'text',
  },
  '.cm-content .cm-table th': {
    background: 'var(--reader-sunken, var(--mdb-bg-secondary))',
    fontWeight: '600',
    color: 'var(--reader-ink-2, var(--mdb-text-secondary))',
    borderTop: '0',
  },
  '.cm-content .cm-table-wrap': {
    display: 'block',
    // Positioning context for the absolutely positioned boundary overlay.
    position: 'relative',
    overflowX: 'auto',
    border: '1px solid var(--reader-line, var(--mdb-border))',
    borderRadius: 'var(--reader-radius-lg, 12px)',
  },
  '.cm-content .cm-table-cell-text': {
    // inline-block so min-width/min-height take effect — min-* is ignored on
    // inline boxes, and an empty cell must still be a clickable target.
    display: 'inline-block',
    minWidth: '1em',
    minHeight: '1em',
    whiteSpace: 'pre-wrap',
    cursor: 'text',
  },
  '.cm-content .cm-table-cell-editing .cm-table-cell-text': {
    display: 'none',
  },
  '.cm-content .cm-table-cell-input': {
    width: '100%',
    boxSizing: 'border-box',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    font: 'inherit',
    color: 'inherit',
    padding: '0',
  },
  '.cm-content .cm-table-cell-active': {
    boxShadow: 'inset 0 0 0 2px var(--reader-accent, var(--mdb-primary-fg))',
  },
  // Cell range selection (ticket #328): outline only, so a background color
  // applied by `.cm-table-cell-bg-*` below still shows through.
  '.cm-content .cm-table-cell-selected': {
    boxShadow: 'inset 0 0 0 2px var(--reader-accent, var(--mdb-primary-fg))',
    backgroundColor: 'var(--mdb-selection)',
  },
  // Cell background span (`mdb-bg-*` wrapping the whole cell text) painted onto
  // the `<td>`/`<th>` itself. Values mirror the `.cm-bg-*` inline marks.
  '.cm-content .cm-table-cell-bg-red': { backgroundColor: 'rgba(248, 81, 73, 0.25)' },
  '.cm-content .cm-table-cell-bg-blue': { backgroundColor: 'rgba(123, 134, 234, 0.25)' },
  '.cm-content .cm-table-cell-bg-green': { backgroundColor: 'rgba(63, 185, 80, 0.25)' },
  '.cm-content .cm-table-cell-bg-orange': { backgroundColor: 'rgba(227, 179, 65, 0.25)' },
  '.cm-content .cm-table-cell-bg-purple': { backgroundColor: 'rgba(163, 113, 247, 0.25)' },
  '.cm-content .cm-table-cell-handle': {
    position: 'absolute',
    top: '2px',
    right: '2px',
    width: '16px',
    height: '16px',
    borderRadius: 'var(--reader-radius, 4px)',
    border: '1px solid var(--reader-line, var(--mdb-border))',
    background: 'var(--reader-sunken, var(--mdb-bg-secondary))',
    opacity: '0',
    cursor: 'pointer',
    pointerEvents: 'auto',
    // Above .cm-table-boundary (z-index 5): the boundary layer spans the wrap,
    // so a lower handle would be unpaintable and unclickable where they overlap.
    zIndex: '6',
  },
  '.cm-content .cm-table-cell-handle::after': {
    content: '"+"',
    display: 'block',
    textAlign: 'center',
    fontSize: '11px',
    lineHeight: '14px',
    color: 'var(--reader-ink-2, var(--mdb-text-secondary))',
  },
  '.cm-content .cm-table th:hover .cm-table-cell-handle, .cm-content .cm-table td:hover .cm-table-cell-handle, .cm-content .cm-table-cell-handle-active': {
    opacity: '1',
  },
  // ── Insertion boundaries (F-03/F-04) ─────────────────────────────────
  // The 6px strip sits ON the boundary and is inert: only the hotspot dot
  // inside it takes the pointer, and only while the table is hovered, so a
  // cell interior can never be swallowed by the layer.
  '.cm-content .cm-table-boundaries': {
    position: 'absolute',
    inset: '0',
    pointerEvents: 'none',
  },
  '.cm-content .cm-table-boundary': {
    background: 'transparent',
    pointerEvents: 'none',
  },
  '.cm-content .cm-table-boundary-line': {
    position: 'absolute',
    background: 'transparent',
    borderRadius: '1px',
    transition: 'background-color 120ms ease-out',
  },
  '.cm-content .cm-table-boundary-col .cm-table-boundary-line': {
    left: '50%',
    top: '0',
    bottom: '0',
    width: '2px',
    transform: 'translateX(-50%)',
  },
  '.cm-content .cm-table-boundary-row .cm-table-boundary-line': {
    top: '50%',
    left: '0',
    right: '0',
    height: '2px',
    transform: 'translateY(-50%)',
  },
  '.cm-content .cm-table-boundary-active .cm-table-boundary-line': {
    background: 'var(--reader-accent, var(--mdb-primary-fg))',
  },
  // Hotspots: hidden until the pointer is near their boundary line. The dot
  // for the nearest row/column boundary is revealed by `wireBoundaryReveal`
  // (#385a) — a cell hover no longer lights every dot — and the hovered dot
  // turns brand-blue with its bubble + boundary line.
  '.cm-content .cm-table-hotspot': {
    display: 'none',
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'auto',
    cursor: 'pointer',
    zIndex: '6',
  },
  // Set by `wireBoundaryReveal` on the one hotspot nearest the pointer, so the
  // dot appears only while the pointer is within BOUNDARY_REVEAL_DISTANCE of
  // that row/column line; it stays revealed while the pointer travels onto it.
  '.cm-content .cm-table-hotspot.cm-table-hotspot-revealed': {
    display: 'flex',
  },
  '.cm-content .cm-table-hotspot-col': {
    left: '50%',
    top: '6px',
    transform: 'translateX(-50%)',
  },
  '.cm-content .cm-table-hotspot-row': {
    top: '50%',
    left: '8px',
    transform: 'translateY(-50%)',
  },
  '.cm-content .cm-table-hotspot-dot': {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '16px',
    height: '16px',
    boxSizing: 'border-box',
    borderRadius: '50%',
    border: '1px solid var(--reader-line, var(--mdb-border))',
    background: 'var(--reader-sunken, var(--mdb-bg-secondary))',
    color: 'var(--reader-ink-2, var(--mdb-text-secondary))',
    fontSize: '12px',
    lineHeight: '1',
    pointerEvents: 'auto',
  },
  '.cm-content .cm-table-hotspot-active .cm-table-hotspot-dot': {
    background: 'var(--reader-accent, var(--mdb-primary-fg))',
    borderColor: 'var(--reader-accent, var(--mdb-primary-fg))',
    color: '#ffffff',
  },
  '.cm-content .cm-table-hotspot-bubble': {
    position: 'absolute',
    display: 'none',
    whiteSpace: 'nowrap',
    padding: '2px 6px',
    borderRadius: '4px',
    border: '1px solid var(--reader-line, var(--mdb-border))',
    background: 'var(--reader-sunken, var(--mdb-bg-secondary))',
    color: 'var(--reader-ink, var(--mdb-text))',
    fontSize: '12px',
    lineHeight: '1.4',
    pointerEvents: 'none',
    zIndex: '7',
  },
  '.cm-content .cm-table-hotspot-active .cm-table-hotspot-bubble': {
    display: 'block',
  },
  '.cm-content .cm-table-hotspot-col .cm-table-hotspot-bubble': {
    left: '50%',
    top: '20px',
    transform: 'translateX(-50%)',
  },
  '.cm-content .cm-table-hotspot-row .cm-table-hotspot-bubble': {
    top: '50%',
    left: '22px',
    transform: 'translateY(-50%)',
  },

  // Block widgets (callout, table) live inside .cm-line elements that may
  // carry per-type padding/border (.cm-line.cm-quote, etc.). Reset those so
  // the widget fills the content width — matching preview where .callout /
  // table are direct children of .preview-content.
  '.cm-content .cm-line:has(.cm-callout), .cm-content .cm-line:has(.cm-table-wrap)': {
    padding: '0',
    border: 'none',
    background: 'transparent',
    borderRadius: '0',
  },

  // Callout tone colouring (defined after the base card so they win).
  ...calloutToneSpecs(),
});

// D1 non-destructive parity: bridge reader CSS variables + container box onto
// `.cm-content`. We do NOT add the `preview-content` class — that would
// trigger `.preview-content > *` and break CM6's contiguous line layout.
// Instead we re-define the reader token chain (`--reader-*`, `--type-*`) on
// `.cm-content` itself so the per-type rules above can use the same variables
// the reader uses, and apply the same inline container box (max-width +
// centered measure + 2rem inline padding) so block widths match preview.
const editorContentScope: Extension = EditorView.theme({
  '.cm-content': {
    maxWidth: '1200px',
    marginLeft: 'auto',
    marginRight: 'auto',
    paddingLeft: '2rem',
    paddingRight: '2rem',
    paddingTop: '0',
    paddingBottom: '0',
    fontFamily: 'var(--type-font-sans)',
    color: 'var(--reader-ink)',
    lineHeight: 'var(--type-line)',
  },
});

// CSS custom properties can't go through EditorView.theme reliably (CM6's
// style serializer may skip keys starting with `--`). Inject them via a plain
// <style> element so the decoration rules above can use var(--reader-*) etc.
// Values mirror the reader CSS (readerCss.ts) exactly — not --mdb-* fallbacks —
// so computed styles match between edit and preview.
let scopeCssInjected = false;
function ensureScopeCss(): Extension {
  if (scopeCssInjected || typeof document === 'undefined') return [];
  scopeCssInjected = true;
  const style = document.createElement('style');
  style.textContent = `
[data-theme='light'] .cm-editor .cm-content {
  --app-accent: #6366f1;
  --app-surface: #fbfaf8;
  --app-sunken: #f4f2ec;
  --app-text: #24262b;
  --app-text-strong: #16181c;
  --app-text-2: #55595f;
  --app-text-3: #8b8f96;
  --app-border: #e7e3db;
  --app-border-strong: #d8d3c8;
  --reader-paper: var(--app-surface);
  --reader-sunken: var(--app-sunken);
  --reader-ink: var(--app-text);
  --reader-ink-strong: var(--app-text-strong);
  --reader-ink-2: var(--app-text-2);
  --reader-ink-3: var(--app-text-3);
  --reader-line: var(--app-border);
  --reader-line-2: var(--app-border-strong);
  --reader-accent: #3d5a8a;
  --reader-accent-soft: rgba(61, 90, 138, 0.1);
  --reader-radius: 6px;
  --reader-radius-lg: 12px;
  --type-font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Source Han Sans SC", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif;
  --type-font-mono: "SF Mono", "JetBrains Mono", "Fira Code", Menlo, Consolas, "PingFang SC", monospace;
  --type-font-size: 17px;
  --type-line: 1.78;
  --type-measure: 1080px;
  --type-measure-wide: 1200px;
}
[data-theme='dark'] .cm-editor .cm-content {
  --app-accent: #818cf8;
  --app-surface: #1a1b1e;
  --app-sunken: #22242a;
  --app-text: #d8dade;
  --app-text-strong: #eceef1;
  --app-text-2: #a7abb3;
  --app-text-3: #75797f;
  --app-border: #2e3138;
  --app-border-strong: #3d4149;
  --reader-paper: var(--app-surface);
  --reader-sunken: var(--app-sunken);
  --reader-ink: var(--app-text);
  --reader-ink-strong: var(--app-text-strong);
  --reader-ink-2: var(--app-text-2);
  --reader-ink-3: var(--app-text-3);
  --reader-line: var(--app-border);
  --reader-line-2: var(--app-border-strong);
  --reader-accent: #8ab4e8;
  --reader-accent-soft: rgba(138, 180, 232, 0.14);
  --reader-radius: 6px;
  --reader-radius-lg: 12px;
  --type-font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Source Han Sans SC", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif;
  --type-font-mono: "SF Mono", "JetBrains Mono", "Fira Code", Menlo, Consolas, "PingFang SC", monospace;
  --type-font-size: 17px;
  --type-line: 1.78;
  --type-measure: 1080px;
  --type-measure-wide: 1200px;
}
/* Body font size and line height are consumed from the --type-* tokens so edit
   and preview stay on one source of truth. These MUST live here rather than in
   editorContentScope: EditorView.theme() emits a ".ͼN .cm-content" selector
   (specificity 0,2,0), which ties with the ".cm-content" rule in createTheme()
   (editor.ts) and loses on stylesheet order — the theme compartment is appended
   last. The selector below is [data-theme] + .cm-editor + .cm-content (0,3,0),
   so it wins on specificity instead of relying on injection order. Every
   property editorContentScope declares for .cm-content is affected by this;
   font-size and line-height are the two that carry body text. font-size has no
   visual delta today (the token resolves to 17px), line-height does. */
[data-theme='light'] .cm-editor .cm-content,
[data-theme='dark'] .cm-editor .cm-content {
  font-size: var(--type-font-size);
  line-height: var(--type-line);
}
`;
  document.head.appendChild(style);
  return [];
}

/** Combined decorations theme: baseTheme rules + reader-CSS variable bridge. */
export const editorDecorationsThemeExt: Extension = [
  ensureScopeCss(),
  editorDecorationsTheme,
  editorContentScope,
];
