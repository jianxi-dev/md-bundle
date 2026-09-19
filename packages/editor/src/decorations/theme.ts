/**
 * Living-source decoration theme.
 *
 * The decoration modules (heading/boldItalic/list/quote/code/image/callout)
 * only emit DOM classes (`.cm-strong`, `.cm-quote`, `.cm-callout`, …); this
 * extension is what actually makes them *look* like rendered Markdown in edit
 * mode — Typora-style "living source".
 *
 * Semantic editing mode: two visual states per block.
 * - Non-active (`.cm-block-inactive`): fully rendered, zero syntax markers.
 * - Active (`.cm-block-active`): semantic reveal — structure markers shown at
 *   low opacity for structural awareness.
 *
 * Layout stability: line height is fixed at 1.7em for all states so that
 * toggling marker visibility never causes CLS. Heading sizes use em-based
 * scaling within the fixed line box.
 *
 * Transitions: opacity fades for marker reveal (100–150ms) so state changes
 * feel smooth. Bold/italic have no transition (instant, as they never change).
 *
 * Deliberately written as an `EditorView.baseTheme` so the styles are present
 * whenever decorations are enabled, while referencing the global `--mdb-*`
 * design tokens so both dark and light `data-theme` values are honoured.
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
  '.cm-content .cm-heading': {
    fontWeight: '650',
    lineHeight: '1.35em',
    // Fixed line height ensures no CLS when ## visibility toggles.
    transition: 'font-size 120ms ease-out',
  },
  '.cm-content .cm-heading.cm-h1': { fontSize: '1.6em', letterSpacing: '0.01em' },
  '.cm-content .cm-heading.cm-h2': { fontSize: '1.35em', letterSpacing: '0.005em' },
  '.cm-content .cm-heading.cm-h3': { fontSize: '1.2em' },
  '.cm-content .cm-heading.cm-h4': { fontSize: '1.05em' },
  '.cm-content .cm-heading.cm-h5': { fontSize: '0.95em' },
  '.cm-content .cm-heading.cm-h6': { fontSize: '0.875em', letterSpacing: '0.04em' },

  // ── Bold / italic (no transition — instant) ─────────────────────────
  '.cm-content .cm-strong': { fontWeight: '650', color: 'var(--mdb-text)' },
  '.cm-content .cm-em': { fontStyle: 'italic' },

  // ── Lists ─────────────────────────────────────────────────────────────
  '.cm-content .cm-line.cm-list': {
    paddingInlineStart: '0.35em',
    lineHeight: '1.7em',
  },
  '.cm-content .cm-line.cm-list:not(.cm-list-ordered):not(.cm-task-done):not(.cm-task-pending)::before': {
    content: "'•  '",
    color: 'var(--mdb-muted)',
    // Fade in/out when toggling between active/inactive.
    transition: 'opacity 100ms ease-out',
  },
  '.cm-content .cm-line.cm-task-done::before': {
    content: "'✓  '",
    color: 'var(--mdb-success)',
  },
  '.cm-content .cm-line.cm-task-pending::before': {
    content: "'○  '",
    color: 'var(--mdb-muted)',
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

  // ── Blockquote ────────────────────────────────────────────────────────
  '.cm-content .cm-line.cm-quote': {
    borderInlineStart: '3px solid var(--mdb-primary-fg)',
    paddingInlineStart: '0.6em',
    color: 'var(--mdb-text-secondary)',
    marginBlock: '0.15em 0',
    lineHeight: '1.7em',
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

  // ── Inline code ───────────────────────────────────────────────────────
  '.cm-content .cm-inline-code': {
    fontFamily:
      'var(--mdb-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
    fontSize: '0.9em',
    color: 'var(--mdb-primary-fg)',
    backgroundColor: 'var(--mdb-code-bg)',
    border: '1px solid var(--mdb-border)',
    borderRadius: '4px',
    padding: '0.1em 0.35em',
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

  // ── Callout card ──────────────────────────────────────────────────────
  '.cm-content .cm-callout': {
    display: 'block',
    padding: '0.6em 0.8em',
    marginBlock: '0.4em 0',
    borderInlineStart: '3px solid var(--callout-color, var(--mdb-primary-fg))',
    backgroundColor: 'var(--callout-soft, var(--mdb-selection))',
    borderRadius: '6px',
    color: 'var(--mdb-text)',
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

  // Callout tone colouring (defined after the base card so they win).
  ...calloutToneSpecs(),
});
