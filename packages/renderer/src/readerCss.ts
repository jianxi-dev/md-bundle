/**
 * readerCss.ts — Self-contained reader typography CSS (Task 1.4).
 *
 * Ported from clairis `src/styles/reader.css` + `src/styles/tokens.css`,
 * restructured as `[data-theme='light']` / `[data-theme='dark']` dual blocks.
 * All `--app-*` semantic tokens from tokens.css are inlined directly.
 *
 * Source mapping (clairis → this file):
 *   `:root { --app-* }`            → inlined in light block
 *   `.dark { --app-* }`            → inlined in dark block
 *   `.preview-content { --reader-* }` → per-block with resolved values
 *   `.dark .preview-content`       → `[data-theme='dark'] .preview-content`
 *   `.dark .tok-*`                 → `[data-theme='dark'] .tok-*`
 *   `.dark .callout[data-callout]` → `[data-theme='dark'] .callout[data-callout]`
 *   `.dark .reading-ink`           → `[data-theme='dark'] .reading-ink`
 *
 * Excluded (UI chrome, not reader): `.preview-shell`, `.reader-settings*`,
 * `html[data-skin=*]`, `html.dark[data-skin=*]`, `.reader-pill .reader-swatch`.
 */

// Language: typescript
export const READER_CSS: string = `
/* ── LIGHT THEME ──────────────────────────────────────────── */
[data-theme='light'] .preview-content {
  /* Layer 1: semantic tokens (inlined from tokens.css :root) */
  --app-accent: #6366f1;
  --app-bg: #f7f7f6;
  --app-surface: #fbfaf8;
  --app-sunken: #f4f2ec;
  --app-text: #24262b;
  --app-text-strong: #16181c;
  --app-text-2: #55595f;
  --app-text-3: #8b8f96;
  --app-border: #e7e3db;
  --app-border-strong: #d8d3c8;
  --app-shadow: 0 1px 2px rgba(31, 26, 20, 0.05), 0 8px 24px rgba(31, 26, 20, 0.05);

  /* Layer 2: reader appearance */
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
  --reader-shadow: var(--app-shadow);

  /* Layer 3: typography scale */
  --type-font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Source Han Sans SC", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif;
  --type-font-mono: "SF Mono", "JetBrains Mono", "Fira Code", Menlo, Consolas, "PingFang SC", monospace;
  --type-font-size: 17px;
  --type-line: 1.78;
  --type-measure: 1080px;
  --type-measure-wide: 1200px;

  min-height: 100%;
  flex: 1;
  width: 100%;
  max-width: var(--type-measure-wide);
  margin-inline: auto;
  padding: 2.5rem 2rem 6rem;
  background: var(--reader-paper);
  box-shadow: var(--reader-shadow);
  color: var(--reader-ink);
  font-family: var(--type-font-sans);
  font-size: var(--type-font-size);
  line-height: var(--type-line);
  contain: layout paint style;
  text-wrap: pretty;
  line-break: strict;
  overflow-wrap: break-word;
  hanging-punctuation: allow-end;
  text-spacing-trim: space-first;
  -webkit-font-smoothing: antialiased;
}

[data-theme='light'] .preview-content > * {
  max-width: var(--type-measure);
  margin-inline: auto !important;
  margin-block: 0 1.15em;
}

[data-theme='light'] .preview-content > .wide {
  max-width: var(--type-measure-wide);
}

[data-theme='light'] .preview-content > :first-child {
  margin-top: 0;
}

[data-theme='light'] .preview-content > :last-child {
  margin-bottom: 0;
}

/* ── Headings ─── */
[data-theme='light'] .preview-content h1,
[data-theme='light'] .preview-content h2,
[data-theme='light'] .preview-content h3,
[data-theme='light'] .preview-content h4,
[data-theme='light'] .preview-content h5,
[data-theme='light'] .preview-content h6 {
  color: var(--reader-ink-strong);
  font-weight: 650;
  line-height: 1.3;
  text-wrap: balance;
}

[data-theme='light'] .preview-content h1 {
  font-size: 1.75em;
  font-weight: 700;
  letter-spacing: 0.01em;
  color: var(--tone-1, var(--heading-h1, var(--reader-ink-strong)));
  margin-block: 0 0.9em;
}

[data-theme='light'] .preview-content h2 {
  font-size: 1.4em;
  font-weight: 700;
  letter-spacing: 0.005em;
  color: var(--tone-1, var(--heading-h2, var(--reader-ink-strong)));
  margin-block: 1.9em 0.75em;
}

[data-theme='light'] .preview-content h3 {
  font-size: 1.2em;
  color: var(--tone-2, var(--heading-h3, var(--reader-ink-strong)));
  line-height: 1.4;
  margin-block: 1.6em 0.6em;
}

[data-theme='light'] .preview-content h4 {
  font-size: 1.05em;
  color: var(--tone-2, var(--heading-h4, var(--reader-ink-strong)));
  line-height: 1.4;
  margin-block: 1.4em 0.5em;
}

[data-theme='light'] .preview-content h5 {
  font-size: 0.95em;
  color: var(--tone-3, var(--heading-h5, var(--reader-ink-2)));
  line-height: 1.4;
  margin-block: 1.4em 0.5em;
}

[data-theme='light'] .preview-content h6 {
  font-size: 0.875em;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--tone-3, var(--heading-h6, var(--reader-ink-3)));
  line-height: 1.4;
  margin-block: 1.4em 0.5em;
}

[data-theme='light'] .preview-content h1 + h2,
[data-theme='light'] .preview-content h2 + h3,
[data-theme='light'] .preview-content h3 + h4 {
  margin-top: 1.2em;
}

/* ── Paragraph + inline text ─── */
[data-theme='light'] .preview-content p {
  text-wrap: pretty;
}

[data-theme='light'] .preview-content strong {
  font-weight: 650;
  color: var(--tone-ink, var(--reader-ink-strong));
}

[data-theme='light'] .preview-content em {
  font-style: italic;
}

[data-theme='light'] .preview-content del {
  color: var(--reader-ink-3);
}

[data-theme='light'] .preview-content kbd {
  font-family: var(--type-font-mono);
  font-size: 0.82em;
  padding: 0.15em 0.4em;
  border: 1px solid var(--reader-line-2);
  border-bottom-width: 2px;
  border-radius: 4px;
  background: var(--reader-sunken);
}

.cjk-pad {
  display: inline-block;
  width: 0.12em;
}

/* ── Lists ─── */
[data-theme='light'] .preview-content ul,
[data-theme='light'] .preview-content ol {
  list-style-type: disc;
  padding-inline-start: 1.5em;
}

[data-theme='light'] .preview-content ol {
  list-style-type: decimal;
}

[data-theme='light'] .preview-content li {
  margin-block: 0.4em;
}

[data-theme='light'] .preview-content li::marker {
  color: var(--reader-ink-3);
}

[data-theme='light'] .preview-content li > ul,
[data-theme='light'] .preview-content li > ol {
  margin-block: 0.4em;
}

[data-theme='light'] .preview-content li:has(> input[type="checkbox"]) {
  list-style: none;
  margin-inline-start: -1.5em;
}

[data-theme='light'] .preview-content li > input[type="checkbox"] {
  appearance: none;
  -webkit-appearance: none;
  width: 1em;
  height: 1em;
  margin-inline-end: 0.6em;
  vertical-align: -2px;
  border: 1.5px solid var(--reader-line-2);
  border-radius: 50%;
  display: inline-block;
  position: relative;
  cursor: default;
}

[data-theme='light'] .preview-content li > input[type="checkbox"]:checked {
  background: var(--reader-accent);
  border-color: var(--reader-accent);
}

[data-theme='light'] .preview-content li > input[type="checkbox"]:checked::after {
  content: "";
  position: absolute;
  inset-inline-start: 0.24em;
  inset-block-start: 0.11em;
  width: 0.28em;
  height: 0.52em;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  transform: rotate(42deg);
}

[data-theme='light'] .preview-content li:has(> input[type="checkbox"]:checked) {
  color: var(--reader-ink-3);
}

/* ── Blockquote ─── */
[data-theme='light'] .preview-content blockquote {
  border-inline-start: 2px solid var(--reader-accent);
  background: var(--reader-accent-soft);
  padding: 0.7em 1em;
  border-radius: 0 var(--reader-radius) var(--reader-radius) 0;
  color: var(--reader-ink-2);
}

[data-theme='light'] .preview-content blockquote > :last-child {
  margin-bottom: 0;
}

[data-theme='light'] .preview-content blockquote p {
  white-space: pre-line;
}

/* ── Inline code ─── */
[data-theme='light'] .preview-content code {
  font-family: var(--type-font-mono);
  font-size: 0.88em;
  background: var(--reader-sunken);
  border: 1px solid var(--reader-line);
  border-radius: 4px;
  padding: 0.12em 0.35em;
  color: #a03a63;
}

/* ── Code block ─── */
[data-theme='light'] .preview-content .code-block {
  position: relative;
  background: var(--reader-sunken);
  border: 1px solid var(--reader-line);
  border-radius: var(--reader-radius);
  overflow: hidden;
}

[data-theme='light'] .preview-content .code-lang,
[data-theme='light'] .preview-content .code-copy {
  position: absolute;
  inset-block-start: 0;
  inset-inline-end: 0;
  font-size: 0.7em;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--reader-ink-3);
  padding: 0.45em 0.7em;
  user-select: none;
  transition: opacity 0.15s ease;
}

[data-theme='light'] .preview-content .code-copy {
  font-family: var(--type-font-sans);
  letter-spacing: 0.02em;
  text-transform: none;
  background: none;
  border: 0;
  cursor: pointer;
  opacity: 0;
}

[data-theme='light'] .preview-content .code-block:hover .code-lang {
  opacity: 0;
}

[data-theme='light'] .preview-content .code-block:hover .code-copy {
  opacity: 1;
}

[data-theme='light'] .preview-content .code-copy:hover {
  color: var(--reader-accent);
}

[data-theme='light'] .preview-content .code-block .code-copy:focus-visible {
  opacity: 1;
  outline: 2px solid var(--reader-accent);
  outline-offset: 1px;
}

[data-theme='light'] .preview-content pre {
  margin: 0;
  padding: 1.1em 1.15em;
  overflow-x: auto;
  font-family: var(--type-font-mono);
  font-size: 0.88em;
  line-height: 1.65;
  tab-size: 2;
  color: var(--reader-ink);
}

[data-theme='light'] .preview-content pre code {
  background: none;
  border: 0;
  padding: 0;
  font-size: 1em;
  color: inherit;
}

/* ── Syntax highlighting: light mineral family ─── */
[data-theme='light'] .tok-keyword,
[data-theme='light'] .tok-controlKeyword,
[data-theme='light'] .tok-moduleKeyword,
[data-theme='light'] .tok-definitionKeyword,
[data-theme='light'] .tok-operatorKeyword,
[data-theme='light'] .tok-tagName {
  color: #9d3a7d;
}

[data-theme='light'] .tok-string,
[data-theme='light'] .tok-string2,
[data-theme='light'] .tok-docString,
[data-theme='light'] .tok-regexp,
[data-theme='light'] .tok-character,
[data-theme='light'] .tok-attributeValue {
  color: #2f7a4f;
}

[data-theme='light'] .tok-number,
[data-theme='light'] .tok-integer,
[data-theme='light'] .tok-float,
[data-theme='light'] .tok-bool,
[data-theme='light'] .tok-null,
[data-theme='light'] .tok-atom,
[data-theme='light'] .tok-unit {
  color: #b1551e;
}

[data-theme='light'] .tok-comment,
[data-theme='light'] .tok-meta,
[data-theme='light'] .tok-documentMeta,
[data-theme='light'] .tok-processingInstruction {
  color: #8b8f96;
  font-style: italic;
}

[data-theme='light'] .tok-variableName.tok-definition,
[data-theme='light'] .tok-function,
[data-theme='light'] .tok-labelName {
  color: #2b5f8f;
}

[data-theme='light'] .tok-typeName,
[data-theme='light'] .tok-className,
[data-theme='light'] .tok-namespace,
[data-theme='light'] .tok-standard {
  color: #a8631a;
}

[data-theme='light'] .tok-propertyName,
[data-theme='light'] .tok-attributeName {
  color: #3a6b6b;
}

[data-theme='light'] .tok-operator,
[data-theme='light'] .tok-punctuation,
[data-theme='light'] .tok-separator,
[data-theme='light'] .tok-bracket,
[data-theme='light'] .tok-paren,
[data-theme='light'] .tok-brace,
[data-theme='light'] .tok-angleBracket,
[data-theme='light'] .tok-squareBracket {
  color: #7a7f86;
}

[data-theme='light'] .tok-invalid {
  color: #a8402f;
}

/* ── Table ─── */
[data-theme='light'] .preview-content .table-wrap {
  overflow-x: auto;
  border: 1px solid var(--reader-line);
  border-radius: var(--reader-radius-lg);
}

[data-theme='light'] .preview-content table {
  border-collapse: separate;
  border-spacing: 0;
  width: 100%;
  font-size: 0.95em;
}

[data-theme='light'] .preview-content th,
[data-theme='light'] .preview-content td {
  padding: 0.55em 0.8em;
  border-bottom: 1px solid var(--reader-line);
  text-align: start;
  vertical-align: top;
  overflow-wrap: anywhere;
}

[data-theme='light'] .preview-content thead th {
  background: var(--reader-sunken);
  font-weight: 600;
  color: var(--reader-ink-2);
  border-top: 0;
}

[data-theme='light'] .preview-content tbody tr:last-child td {
  border-bottom: 0;
}

[data-theme='light'] .preview-content tbody tr:hover {
  background: var(--reader-accent-soft);
}

/* ── Image ─── */
[data-theme='light'] .preview-content figure {
  text-align: center;
}

[data-theme='light'] .preview-content img {
  max-width: 100%;
  height: auto;
  display: block;
  margin-inline: auto;
  border-radius: var(--reader-radius);
  box-shadow: 0 1px 3px rgba(31, 26, 20, 0.08);
}

[data-theme='light'] .preview-content figcaption {
  padding-block-start: 0.8em;
  font-size: 0.82em;
  color: var(--reader-ink-3);
}

/* ── Link ─── */
[data-theme='light'] .preview-content a {
  color: var(--reader-accent);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 0.18em;
}

[data-theme='light'] .preview-content a:hover {
  text-decoration-thickness: 2px;
  background: var(--reader-accent-soft);
  border-radius: 2px;
}

/* ── Horizontal rule ─── */
[data-theme='light'] .preview-content hr {
  border: 0;
  height: 26px;
  margin-block: 1.6em;
  background: radial-gradient(circle at center, var(--reader-line-2) 1.5px, transparent 1.7px) center / 20px 100% repeat-x;
}

/* ── Callout ─── */
[data-theme='light'] .preview-content .callout {
  --callout-color: var(--reader-accent);
  --callout-soft: var(--reader-accent-soft);
  border-inline-start: 3px solid var(--callout-color);
  background: var(--callout-soft);
  border-radius: var(--reader-radius);
  padding: 0.75em 1em;
  color: var(--reader-ink);
}

[data-theme='light'] .preview-content .callout-title {
  display: flex;
  align-items: baseline;
  gap: 0.5em;
  font-weight: 650;
  color: var(--callout-color);
  font-size: 0.95em;
  margin-block-end: 0.35em;
}

[data-theme='light'] .preview-content .callout-title::before {
  font-size: 1em;
  line-height: 1;
}

[data-theme='light'] .preview-content .callout > :last-child {
  margin-bottom: 0;
}

[data-theme='light'] details.callout > summary {
  cursor: pointer;
  list-style: none;
  display: flex;
  align-items: baseline;
  gap: 0.5em;
  font-weight: 650;
  color: var(--callout-color);
  font-size: 0.95em;
}

[data-theme='light'] details.callout > summary::-webkit-details-marker {
  display: none;
}

[data-theme='light'] details.callout > summary::after {
  content: "\\25B8";
  margin-inline-start: auto;
  opacity: 0.6;
}

[data-theme='light'] details.callout[open] > summary::after {
  content: "\\25BE";
}

[data-theme='light'] details.callout[open] > summary {
  margin-block-end: 0.35em;
}

[data-theme='light'] .preview-content .callout[data-callout="note"],
[data-theme='light'] .preview-content .callout[data-callout="info"],
[data-theme='light'] .preview-content .callout[data-callout="abstract"],
[data-theme='light'] .preview-content .callout[data-callout="summary"] {
  --callout-color: #3d5a8a;
  --callout-soft: rgba(61, 90, 138, 0.08);
}

[data-theme='light'] .preview-content .callout[data-callout="tip"],
[data-theme='light'] .preview-content .callout[data-callout="hint"],
[data-theme='light'] .preview-content .callout[data-callout="success"],
[data-theme='light'] .preview-content .callout[data-callout="check"] {
  --callout-color: #2f7a4f;
  --callout-soft: rgba(47, 122, 79, 0.08);
}

[data-theme='light'] .preview-content .callout[data-callout="important"] {
  --callout-color: #7a4f9d;
  --callout-soft: rgba(122, 79, 157, 0.08);
}

[data-theme='light'] .preview-content .callout[data-callout="warning"],
[data-theme='light'] .preview-content .callout[data-callout="caution"],
[data-theme='light'] .preview-content .callout[data-callout="attention"] {
  --callout-color: #b1551e;
  --callout-soft: rgba(177, 85, 30, 0.08);
}

[data-theme='light'] .preview-content .callout[data-callout="danger"],
[data-theme='light'] .preview-content .callout[data-callout="error"],
[data-theme='light'] .preview-content .callout[data-callout="failure"],
[data-theme='light'] .preview-content .callout[data-callout="bug"] {
  --callout-color: #a8402f;
  --callout-soft: rgba(168, 64, 47, 0.08);
}

[data-theme='light'] .preview-content .callout[data-callout="question"],
[data-theme='light'] .preview-content .callout[data-callout="help"],
[data-theme='light'] .preview-content .callout[data-callout="faq"] {
  --callout-color: #3a6b6b;
  --callout-soft: rgba(58, 107, 107, 0.08);
}

[data-theme='light'] .preview-content .callout[data-callout="example"] {
  --callout-color: #55595f;
  --callout-soft: rgba(85, 89, 95, 0.08);
}

[data-theme='light'] .preview-content .callout[data-callout="quote"],
[data-theme='light'] .preview-content .callout[data-callout="cite"] {
  --callout-color: #8b8f96;
  --callout-soft: rgba(139, 143, 150, 0.08);
}

/* ── KaTeX ─── */
[data-theme='light'] .preview-content .katex-block {
  overflow-x: auto;
  overflow-y: hidden;
  padding-block: 0.2em;
  text-align: center;
}

[data-theme='light'] .preview-content .katex {
  font-size: 1.05em;
}

[data-theme='light'] .preview-content .katex-error {
  color: #a8402f;
  font-family: var(--type-font-mono);
  font-size: 0.9em;
}

/* ── Mermaid ─── */
[data-theme='light'] .preview-content .mermaid-block {
  background: var(--reader-sunken);
  border: 1px solid var(--reader-line);
  border-radius: var(--reader-radius);
  padding: 1em 1.1em;
  overflow-x: auto;
}

[data-theme='light'] .preview-content .mermaid-block pre.mermaid {
  margin: 0;
  padding: 0;
  color: var(--reader-ink-2);
  font-size: 0.85em;
  white-space: pre-wrap;
}

[data-theme='light'] .preview-content .mermaid-view svg {
  display: block;
  max-width: 100%;
  height: auto;
  margin-inline: auto;
}

/* 滚动条统一走系统原生 overlay（macOS 滚动显示、停止淡出）。不再自定义
   ::-webkit-scrollbar：自定义任何一处都会让 Chromium 切换滚动条渲染模式，
   导致正文滚动条粗细/显示不稳定（Bug #17）。 */
@media (prefers-reduced-motion: reduce) {
  [data-theme='light'] .preview-content .code-lang,
  [data-theme='light'] .preview-content .code-copy {
    transition: none;
  }
}

/* ── DARK THEME ──────────────────────────────────────────── */
[data-theme='dark'] .preview-content {
  /* Layer 1: semantic tokens (inlined from tokens.css .dark) */
  --app-accent: #818cf8;
  --app-bg: #131316;
  --app-surface: #1a1b1e;
  --app-sunken: #22242a;
  --app-text: #d8dade;
  --app-text-strong: #eceef1;
  --app-text-2: #a7abb3;
  --app-text-3: #75797f;
  --app-border: #2e3138;
  --app-border-strong: #3d4149;
  --app-shadow: 0 1px 2px rgba(0, 0, 0, 0.2), 0 8px 24px rgba(0, 0, 0, 0.2);

  /* Layer 2: reader appearance */
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
  --reader-shadow: var(--app-shadow);

  /* Layer 3: typography scale (same as light) */
  --type-font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Source Han Sans SC", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif;
  --type-font-mono: "SF Mono", "JetBrains Mono", "Fira Code", Menlo, Consolas, "PingFang SC", monospace;
  --type-font-size: 17px;
  --type-line: 1.78;
  --type-measure: 1080px;
  --type-measure-wide: 1200px;

  min-height: 100%;
  flex: 1;
  width: 100%;
  max-width: var(--type-measure-wide);
  margin-inline: auto;
  padding: 2.5rem 2rem 6rem;
  background: var(--reader-paper);
  box-shadow: var(--reader-shadow);
  color: var(--reader-ink);
  font-family: var(--type-font-sans);
  font-size: var(--type-font-size);
  line-height: var(--type-line);
  contain: layout paint style;
  text-wrap: pretty;
  line-break: strict;
  overflow-wrap: break-word;
  hanging-punctuation: allow-end;
  text-spacing-trim: space-first;
  -webkit-font-smoothing: antialiased;
}

[data-theme='dark'] .preview-content > * {
  max-width: var(--type-measure);
  margin-inline: auto !important;
  margin-block: 0 1.15em;
}

[data-theme='dark'] .preview-content > .wide {
  max-width: var(--type-measure-wide);
}

[data-theme='dark'] .preview-content > :first-child {
  margin-top: 0;
}

[data-theme='dark'] .preview-content > :last-child {
  margin-bottom: 0;
}

/* ── Headings ─── */
[data-theme='dark'] .preview-content h1,
[data-theme='dark'] .preview-content h2,
[data-theme='dark'] .preview-content h3,
[data-theme='dark'] .preview-content h4,
[data-theme='dark'] .preview-content h5,
[data-theme='dark'] .preview-content h6 {
  color: var(--reader-ink-strong);
  font-weight: 650;
  line-height: 1.3;
  text-wrap: balance;
}

[data-theme='dark'] .preview-content h1 {
  font-size: 1.75em;
  font-weight: 700;
  letter-spacing: 0.01em;
  color: var(--tone-1, var(--heading-h1, var(--reader-ink-strong)));
  margin-block: 0 0.9em;
}

[data-theme='dark'] .preview-content h2 {
  font-size: 1.4em;
  font-weight: 700;
  letter-spacing: 0.005em;
  color: var(--tone-1, var(--heading-h2, var(--reader-ink-strong)));
  margin-block: 1.9em 0.75em;
}

[data-theme='dark'] .preview-content h3 {
  font-size: 1.2em;
  color: var(--tone-2, var(--heading-h3, var(--reader-ink-strong)));
  line-height: 1.4;
  margin-block: 1.6em 0.6em;
}

[data-theme='dark'] .preview-content h4 {
  font-size: 1.05em;
  color: var(--tone-2, var(--heading-h4, var(--reader-ink-strong)));
  line-height: 1.4;
  margin-block: 1.4em 0.5em;
}

[data-theme='dark'] .preview-content h5 {
  font-size: 0.95em;
  color: var(--tone-3, var(--heading-h5, var(--reader-ink-2)));
  line-height: 1.4;
  margin-block: 1.4em 0.5em;
}

[data-theme='dark'] .preview-content h6 {
  font-size: 0.875em;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--tone-3, var(--heading-h6, var(--reader-ink-3)));
  line-height: 1.4;
  margin-block: 1.4em 0.5em;
}

[data-theme='dark'] .preview-content h1 + h2,
[data-theme='dark'] .preview-content h2 + h3,
[data-theme='dark'] .preview-content h3 + h4 {
  margin-top: 1.2em;
}

/* ── Paragraph + inline text ─── */
[data-theme='dark'] .preview-content p {
  text-wrap: pretty;
}

[data-theme='dark'] .preview-content strong {
  font-weight: 650;
  color: var(--tone-ink, var(--reader-ink-strong));
}

[data-theme='dark'] .preview-content em {
  font-style: italic;
}

[data-theme='dark'] .preview-content del {
  color: var(--reader-ink-3);
}

[data-theme='dark'] .preview-content kbd {
  font-family: var(--type-font-mono);
  font-size: 0.82em;
  padding: 0.15em 0.4em;
  border: 1px solid var(--reader-line-2);
  border-bottom-width: 2px;
  border-radius: 4px;
  background: var(--reader-sunken);
}

/* ── Lists ─── */
[data-theme='dark'] .preview-content ul,
[data-theme='dark'] .preview-content ol {
  list-style-type: disc;
  padding-inline-start: 1.5em;
}

[data-theme='dark'] .preview-content ol {
  list-style-type: decimal;
}

[data-theme='dark'] .preview-content li {
  margin-block: 0.4em;
}

[data-theme='dark'] .preview-content li::marker {
  color: var(--reader-ink-3);
}

[data-theme='dark'] .preview-content li > ul,
[data-theme='dark'] .preview-content li > ol {
  margin-block: 0.4em;
}

[data-theme='dark'] .preview-content li:has(> input[type="checkbox"]) {
  list-style: none;
  margin-inline-start: -1.5em;
}

[data-theme='dark'] .preview-content li > input[type="checkbox"] {
  appearance: none;
  -webkit-appearance: none;
  width: 1em;
  height: 1em;
  margin-inline-end: 0.6em;
  vertical-align: -2px;
  border: 1.5px solid var(--reader-line-2);
  border-radius: 50%;
  display: inline-block;
  position: relative;
  cursor: default;
}

[data-theme='dark'] .preview-content li > input[type="checkbox"]:checked {
  background: var(--reader-accent);
  border-color: var(--reader-accent);
}

[data-theme='dark'] .preview-content li > input[type="checkbox"]:checked::after {
  content: "";
  position: absolute;
  inset-inline-start: 0.24em;
  inset-block-start: 0.11em;
  width: 0.28em;
  height: 0.52em;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  transform: rotate(42deg);
}

[data-theme='dark'] .preview-content li:has(> input[type="checkbox"]:checked) {
  color: var(--reader-ink-3);
}

/* ── Blockquote ─── */
[data-theme='dark'] .preview-content blockquote {
  border-inline-start: 2px solid var(--reader-accent);
  background: var(--reader-accent-soft);
  padding: 0.7em 1em;
  border-radius: 0 var(--reader-radius) var(--reader-radius) 0;
  color: var(--reader-ink-2);
}

[data-theme='dark'] .preview-content blockquote > :last-child {
  margin-bottom: 0;
}

[data-theme='dark'] .preview-content blockquote p {
  white-space: pre-line;
}

/* ── Inline code ─── */
[data-theme='dark'] .preview-content code {
  font-family: var(--type-font-mono);
  font-size: 0.88em;
  background: var(--reader-sunken);
  border: 1px solid var(--reader-line);
  border-radius: 4px;
  padding: 0.12em 0.35em;
  color: #e59ac0;
}

/* ── Code block ─── */
[data-theme='dark'] .preview-content .code-block {
  position: relative;
  background: var(--reader-sunken);
  border: 1px solid var(--reader-line);
  border-radius: var(--reader-radius);
  overflow: hidden;
}

[data-theme='dark'] .preview-content .code-lang,
[data-theme='dark'] .preview-content .code-copy {
  position: absolute;
  inset-block-start: 0;
  inset-inline-end: 0;
  font-size: 0.7em;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--reader-ink-3);
  padding: 0.45em 0.7em;
  user-select: none;
  transition: opacity 0.15s ease;
}

[data-theme='dark'] .preview-content .code-copy {
  font-family: var(--type-font-sans);
  letter-spacing: 0.02em;
  text-transform: none;
  background: none;
  border: 0;
  cursor: pointer;
  opacity: 0;
}

[data-theme='dark'] .preview-content .code-block:hover .code-lang {
  opacity: 0;
}

[data-theme='dark'] .preview-content .code-block:hover .code-copy {
  opacity: 1;
}

[data-theme='dark'] .preview-content .code-copy:hover {
  color: var(--reader-accent);
}

[data-theme='dark'] .preview-content .code-block .code-copy:focus-visible {
  opacity: 1;
  outline: 2px solid var(--reader-accent);
  outline-offset: 1px;
}

[data-theme='dark'] .preview-content pre {
  margin: 0;
  padding: 1.1em 1.15em;
  overflow-x: auto;
  font-family: var(--type-font-mono);
  font-size: 0.88em;
  line-height: 1.65;
  tab-size: 2;
  color: var(--reader-ink);
}

[data-theme='dark'] .preview-content pre code {
  background: none;
  border: 0;
  padding: 0;
  font-size: 1em;
  color: inherit;
}

/* ── Syntax highlighting: dark mineral family ─── */
[data-theme='dark'] .tok-keyword,
[data-theme='dark'] .tok-controlKeyword,
[data-theme='dark'] .tok-moduleKeyword,
[data-theme='dark'] .tok-definitionKeyword,
[data-theme='dark'] .tok-operatorKeyword,
[data-theme='dark'] .tok-tagName {
  color: #c9a0e0;
}

[data-theme='dark'] .tok-string,
[data-theme='dark'] .tok-string2,
[data-theme='dark'] .tok-docString,
[data-theme='dark'] .tok-regexp,
[data-theme='dark'] .tok-character,
[data-theme='dark'] .tok-attributeValue {
  color: #93cf9f;
}

[data-theme='dark'] .tok-number,
[data-theme='dark'] .tok-integer,
[data-theme='dark'] .tok-float,
[data-theme='dark'] .tok-bool,
[data-theme='dark'] .tok-null,
[data-theme='dark'] .tok-atom,
[data-theme='dark'] .tok-unit {
  color: #dfae72;
}

[data-theme='dark'] .tok-comment,
[data-theme='dark'] .tok-meta,
[data-theme='dark'] .tok-documentMeta,
[data-theme='dark'] .tok-processingInstruction {
  color: #6f7784;
  font-style: italic;
}

[data-theme='dark'] .tok-variableName.tok-definition,
[data-theme='dark'] .tok-function,
[data-theme='dark'] .tok-labelName {
  color: #8ab4e8;
}

[data-theme='dark'] .tok-typeName,
[data-theme='dark'] .tok-className,
[data-theme='dark'] .tok-namespace,
[data-theme='dark'] .tok-standard {
  color: #e0b779;
}

[data-theme='dark'] .tok-propertyName,
[data-theme='dark'] .tok-attributeName {
  color: #7fc4c4;
}

[data-theme='dark'] .tok-operator,
[data-theme='dark'] .tok-punctuation,
[data-theme='dark'] .tok-separator,
[data-theme='dark'] .tok-bracket,
[data-theme='dark'] .tok-paren,
[data-theme='dark'] .tok-brace,
[data-theme='dark'] .tok-angleBracket,
[data-theme='dark'] .tok-squareBracket {
  color: #8b9099;
}

[data-theme='dark'] .tok-invalid {
  color: #e08b7a;
}

/* ── Table ─── */
[data-theme='dark'] .preview-content .table-wrap {
  overflow-x: auto;
  border: 1px solid var(--reader-line);
  border-radius: var(--reader-radius-lg);
}

[data-theme='dark'] .preview-content table {
  border-collapse: separate;
  border-spacing: 0;
  width: 100%;
  font-size: 0.95em;
}

[data-theme='dark'] .preview-content th,
[data-theme='dark'] .preview-content td {
  padding: 0.55em 0.8em;
  border-bottom: 1px solid var(--reader-line);
  text-align: start;
  vertical-align: top;
  overflow-wrap: anywhere;
}

[data-theme='dark'] .preview-content thead th {
  background: var(--reader-sunken);
  font-weight: 600;
  color: var(--reader-ink-2);
  border-top: 0;
}

[data-theme='dark'] .preview-content tbody tr:last-child td {
  border-bottom: 0;
}

[data-theme='dark'] .preview-content tbody tr:hover {
  background: var(--reader-accent-soft);
}

/* ── Image ─── */
[data-theme='dark'] .preview-content figure {
  text-align: center;
}

[data-theme='dark'] .preview-content img {
  max-width: 100%;
  height: auto;
  display: block;
  margin-inline: auto;
  border-radius: var(--reader-radius);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

[data-theme='dark'] .preview-content figcaption {
  padding-block-start: 0.8em;
  font-size: 0.82em;
  color: var(--reader-ink-3);
}

/* ── Link ─── */
[data-theme='dark'] .preview-content a {
  color: var(--reader-accent);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 0.18em;
}

[data-theme='dark'] .preview-content a:hover {
  text-decoration-thickness: 2px;
  background: var(--reader-accent-soft);
  border-radius: 2px;
}

/* ── Horizontal rule ─── */
[data-theme='dark'] .preview-content hr {
  border: 0;
  height: 26px;
  margin-block: 1.6em;
  background: radial-gradient(circle at center, var(--reader-line-2) 1.5px, transparent 1.7px) center / 20px 100% repeat-x;
}

/* ── Callout ─── */
[data-theme='dark'] .preview-content .callout {
  --callout-color: var(--reader-accent);
  --callout-soft: var(--reader-accent-soft);
  border-inline-start: 3px solid var(--callout-color);
  background: var(--callout-soft);
  border-radius: var(--reader-radius);
  padding: 0.75em 1em;
  color: var(--reader-ink);
}

[data-theme='dark'] .preview-content .callout-title {
  display: flex;
  align-items: baseline;
  gap: 0.5em;
  font-weight: 650;
  color: var(--callout-color);
  font-size: 0.95em;
  margin-block-end: 0.35em;
}

[data-theme='dark'] .preview-content .callout-title::before {
  font-size: 1em;
  line-height: 1;
}

[data-theme='dark'] .preview-content .callout > :last-child {
  margin-bottom: 0;
}

[data-theme='dark'] details.callout > summary {
  cursor: pointer;
  list-style: none;
  display: flex;
  align-items: baseline;
  gap: 0.5em;
  font-weight: 650;
  color: var(--callout-color);
  font-size: 0.95em;
}

[data-theme='dark'] details.callout > summary::-webkit-details-marker {
  display: none;
}

[data-theme='dark'] details.callout > summary::after {
  content: "\\25B8";
  margin-inline-start: auto;
  opacity: 0.6;
}

[data-theme='dark'] details.callout[open] > summary::after {
  content: "\\25BE";
}

[data-theme='dark'] details.callout[open] > summary {
  margin-block-end: 0.35em;
}

[data-theme='dark'] .preview-content .callout[data-callout="note"],
[data-theme='dark'] .preview-content .callout[data-callout="info"],
[data-theme='dark'] .preview-content .callout[data-callout="abstract"],
[data-theme='dark'] .preview-content .callout[data-callout="summary"] {
  --callout-color: #8ab4e8;
  --callout-soft: rgba(138, 180, 232, 0.1);
}

[data-theme='dark'] .preview-content .callout[data-callout="tip"],
[data-theme='dark'] .preview-content .callout[data-callout="hint"],
[data-theme='dark'] .preview-content .callout[data-callout="success"],
[data-theme='dark'] .preview-content .callout[data-callout="check"] {
  --callout-color: #7fbf92;
  --callout-soft: rgba(127, 191, 146, 0.1);
}

[data-theme='dark'] .preview-content .callout[data-callout="important"] {
  --callout-color: #b79ae0;
  --callout-soft: rgba(183, 154, 224, 0.1);
}

[data-theme='dark'] .preview-content .callout[data-callout="warning"],
[data-theme='dark'] .preview-content .callout[data-callout="caution"],
[data-theme='dark'] .preview-content .callout[data-callout="attention"] {
  --callout-color: #dfa76a;
  --callout-soft: rgba(223, 167, 106, 0.1);
}

[data-theme='dark'] .preview-content .callout[data-callout="danger"],
[data-theme='dark'] .preview-content .callout[data-callout="error"],
[data-theme='dark'] .preview-content .callout[data-callout="failure"],
[data-theme='dark'] .preview-content .callout[data-callout="bug"] {
  --callout-color: #e08b7a;
  --callout-soft: rgba(224, 139, 122, 0.1);
}

[data-theme='dark'] .preview-content .callout[data-callout="question"],
[data-theme='dark'] .preview-content .callout[data-callout="help"],
[data-theme='dark'] .preview-content .callout[data-callout="faq"] {
  --callout-color: #7fc4c4;
  --callout-soft: rgba(127, 196, 196, 0.1);
}

[data-theme='dark'] .preview-content .callout[data-callout="example"] {
  --callout-color: #a7abb3;
  --callout-soft: rgba(167, 171, 179, 0.1);
}

[data-theme='dark'] .preview-content .callout[data-callout="quote"],
[data-theme='dark'] .preview-content .callout[data-callout="cite"] {
  --callout-color: #8b9099;
  --callout-soft: rgba(139, 144, 153, 0.1);
}

/* ── KaTeX ─── */
[data-theme='dark'] .preview-content .katex-block {
  overflow-x: auto;
  overflow-y: hidden;
  padding-block: 0.2em;
  text-align: center;
}

[data-theme='dark'] .preview-content .katex {
  font-size: 1.05em;
}

[data-theme='dark'] .preview-content .katex-error {
  color: #e08b7a;
  font-family: var(--type-font-mono);
  font-size: 0.9em;
}

/* ── Mermaid ─── */
[data-theme='dark'] .preview-content .mermaid-block {
  background: var(--reader-sunken);
  border: 1px solid var(--reader-line);
  border-radius: var(--reader-radius);
  padding: 1em 1.1em;
  overflow-x: auto;
}

[data-theme='dark'] .preview-content .mermaid-block pre.mermaid {
  margin: 0;
  padding: 0;
  color: var(--reader-ink-2);
  font-size: 0.85em;
  white-space: pre-wrap;
}

[data-theme='dark'] .preview-content .mermaid-view svg {
  display: block;
  max-width: 100%;
  height: auto;
  margin-inline: auto;
}

/* ── Scrollbar ─── */
/* 滚动条统一走系统原生 overlay（macOS 滚动显示、停止淡出）。不再自定义
   ::-webkit-scrollbar：自定义任何一处都会让 Chromium 切换滚动条渲染模式，
   导致正文滚动条粗细/显示不稳定（Bug #17）。 */
@media (prefers-reduced-motion: reduce) {
  [data-theme='dark'] .preview-content .code-lang,
  [data-theme='dark'] .preview-content .code-copy {
    transition: none;
  }
}
`;
