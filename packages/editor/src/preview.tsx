import { marked, type Tokens } from 'marked';
import { getThemeColor, type ThemeName } from './theme';

export interface MarkdownPreviewProps {
  markdown: string;
  theme?: ThemeName;
}

/**
 * Raw-HTML tags that are removed entirely (opening AND closing) because they
 * can execute code or load remote active content. `script` is additionally
 * escaped in the source before parsing (defense in depth) so it can never
 * even become a token.
 */
const REMOVED_HTML_TAGS = /^(?:script|iframe|object|embed|link|meta)$/i;

/** Attribute names that carry script (event handlers) — stripped. */
const EVENT_HANDLER_ATTR = /^on[a-z]/i;

/** Attributes whose value is a URL — `javascript:`/`vbscript:` schemes are neutralized. */
const URL_ATTR = /^(?:href|src|action|xlink:href|formaction)$/i;

const DANGEROUS_URL_SCHEME = /^(?:javascript|vbscript)\s*:/i;

/**
 * Browsers strip ASCII whitespace + control chars before parsing a URL scheme
 * (`java\tscript:` is `javascript:`), so strip them before the scheme check.
 */
function stripUrlJunk(value: string): string {
  return value.replace(/[\u0000-\u0020\u007f]/g, '');
}

function isDangerousUrl(value: string): boolean {
  return DANGEROUS_URL_SCHEME.test(stripUrlJunk(value));
}

/**
 * Match an HTML tag, tolerating `>` inside quoted attribute values.
 */
const HTML_TAG =
  /<\/?[a-zA-Z][^<>]*(?:"[^"]*"[^<>]*)*(?:'[^']*'[^<>]*)*>/g;

/** Match an attribute `name=value` (double-quoted, single-quoted, or unquoted). */
const HTML_ATTR =
  /([a-zA-Z_:][a-zA-Z0-9:._-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

/**
 * Sanitize a raw-HTML fragment (from a marked `html` token): drop dangerous
 * tags entirely, strip `on*` event-handler attributes, and neutralize
 * `javascript:`/`vbscript:` URLs. All other tags/attributes pass through.
 */
function sanitizeRawHtml(text: string): string {
  return text.replace(HTML_TAG, (tag) => {
    const name = (tag.match(/^<\/?([a-zA-Z][a-zA-Z0-9:-]*)/) ?? [])[1] ?? '';
    if (tag.startsWith('</')) {
      // Drop closing tags of removed elements too.
      return REMOVED_HTML_TAGS.test(name) ? '' : tag;
    }
    if (REMOVED_HTML_TAGS.test(name)) return '';
    return tag.replace(
      HTML_ATTR,
      (
        attr: string,
        attrName: string,
        dq: string | undefined,
        sq: string | undefined,
        uq: string | undefined,
      ) => {
        const lowerName = attrName.toLowerCase();
        if (EVENT_HANDLER_ATTR.test(lowerName)) return '';
        const rawValue = dq ?? sq ?? uq ?? '';
        if (URL_ATTR.test(lowerName) && isDangerousUrl(rawValue)) {
          return `${attrName}=""`;
        }
        return attr;
      },
    );
  });
}

/**
 * Renderer with the hardening overrides:
 * - `html`: sanitize raw HTML (dangerous tags removed, `on*` attrs stripped,
 *   `javascript:` URLs neutralized) — safe tags like `<div>`, `<span>`,
 *   `<img>`, `<table>` keep rendering.
 * - `link`/`image`: neutralize `javascript:`/`vbscript:` URLs (href/src
 *   blanked) — covers markdown links, autolinks, and reference links.
 */
function createSanitizingRenderer(): InstanceType<typeof marked.Renderer> {
  const renderer = new marked.Renderer();
  const defaultLink = renderer.link;
  const defaultImage = renderer.image;

  renderer.html = ({ text }: Tokens.HTML | Tokens.Tag) =>
    sanitizeRawHtml(text);

  renderer.link = (token: Tokens.Link) =>
    defaultLink.call(renderer, {
      ...token,
      href: isDangerousUrl(token.href) ? '' : token.href,
    });

  renderer.image = (token: Tokens.Image) =>
    defaultImage.call(renderer, {
      ...token,
      href: isDangerousUrl(token.href) ? '' : token.href,
    });

  return renderer;
}

const renderer = createSanitizingRenderer();

/**
 * Renders markdown to sanitized HTML (no wrapper element). Hardening, in
 * order:
 *
 * 1. `<script` / `</script` (case-insensitive, any following char incl. `\n`)
 *    are escaped in the SOURCE before parsing, so they can never become
 *    executable elements — they render as inert text.
 * 2. Raw HTML that survives parsing goes through a `renderer.html` override
 *    that removes dangerous tags (`iframe`, `object`, `embed`, `link`,
 *    `meta`, `script`) and strips `on*` event-handler attributes.
 * 3. `javascript:`/`vbscript:` URLs in links, autolinks, and images are
 *    neutralized (href/src blanked).
 *
 * Single source of truth for both the live preview and the export pipeline
 * (apps/web exportHtml): the export path must never reimplement sanitization.
 */
export function renderMarkdownToHtml(markdown: string): string {
  const safe = markdown.replace(/<\/?script/gi, (m) => m.replace('<', '&lt;'));
  return marked.parse(safe, { renderer, async: false }) as string;
}

/**
 * Renders markdown to sanitized HTML inside a `.markdown-body` container
 * (github-markdown-css). `dangerouslySetInnerHTML` is used deliberately: the
 * guarantees above make the injected HTML inert, and github-markdown-css
 * styles require real elements (tables, code blocks, blockquotes).
 */
export function MarkdownPreview({
  markdown,
  theme = 'dark',
}: MarkdownPreviewProps) {
  const parsed = renderMarkdownToHtml(markdown);
  return (
    <div
      className="markdown-body"
      data-theme={theme}
      style={{
        background: getThemeColor(theme, 'bg'),
        color: getThemeColor(theme, 'text'),
      }}
      dangerouslySetInnerHTML={{ __html: parsed }}
    />
  );
}