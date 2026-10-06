/**
 * Core markdown rendering pipeline — ported from clairis src/renderers/markdown.ts.
 *
 * Pure Web: marked + DOMPurify + post-process (callouts, CJK spacing, figure
 * zoom). No Tauri / Node / IPC. Math and code highlighting are deferred to
 * Task 1.3 via stubs in math-stub.ts.
 *
 * Invariants (design.md Decision #1):
 * - renderMarkdown is synchronous, pure, never throws
 * - single feature degradation never fails the whole render
 * - DOMPurify is the SSOT for HTML sanitization
 */

import { marked, Renderer } from 'marked';
import DOMPurify from 'dompurify';
import { mathBlockExtension, mathInlineExtension } from './math';
import { preprocessFencedDivs } from './fencedDivExtension';
import type { RenderOptions } from './index';

// ── Block HTML depth-closing (aligns with Obsidian HTML block behavior) ────
// marked's HTML regex swallows block-level tags to the next blank line; when
// users mix `<div>…</div>` cards with markdown, the tail content gets eaten.
const BLOCK_HTML_TAGS =
  'address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul';

const OPEN_BLOCK_HTML_RE = new RegExp(
  `^ {0,3}<(${BLOCK_HTML_TAGS})(?:\\s[^>]*)?>(?=[ \\t]*(?:\\n|$))`,
  'i',
);

// Matches opening / closing / self-closing tags for depth counting.
const CLOSE_TAG_RE = (tag: string) =>
  new RegExp(`<\\/?${tag}(?:\\s[^>]*?)?\\/?>`, 'gi');

// ── DOMPurify configuration ───────────────────────────────────────────────
// Allowed tags: markdown basics + rich-text safe subset (supports embedded
// HTML/CSS in markdown). script / iframe / form / style tags and event
// Security-hardened: style and id removed from ALLOWED_ATTR (prevent CSS
// injection and DOM clobbering); SANITIZE_NAMED_PROPS strips <a name=...>
// anchors that could shadow DOM APIs. position:fixed escape is contained by
// .preview-content { contain: layout paint style } in reader.css.
const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    // markdown basics
    'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'pre', 'code', 'blockquote',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'img', 'a', 'em', 'strong', 'del', 'hr', 'br', 'input',
    // rich-text subset (embedded HTML)
    'div', 'span', 'section', 'article', 'aside',
    'details', 'summary',
    'figure', 'figcaption',
    'dl', 'dt', 'dd',
    'kbd', 'sup', 'sub', 'mark', 'abbr', 'small', 'u', 's',
    'var', 'samp', 'cite', 'q', 'time',
    'ins',
    'picture', 'source', 'video',
    // code block copy button
    'button',
  ],
  ALLOWED_ATTR: [
    'href', 'src', 'alt', 'title', 'class', 'target',
    'type', 'checked', 'disabled',
    'colspan', 'rowspan', 'start', 'value',
    'width', 'height', 'open', 'lang', 'dir',
    'controls', 'preload', 'poster',
    'data-math', 'data-math-tex', 'data-math-display', 'data-callout', 'data-zoomable', 'data-columns',
  ],
  ALLOW_DATA_ATTR: true,
  SANITIZE_NAMED_PROPS: true,
  ADD_ATTR: ['target'],
};

// ── HTML escape (source-level defense before DOMPurify) ───────────────────
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'ogv', 'mov', 'm4v']);
const IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'bmp', 'ico',
]);

function extensionOf(href: string): string {
  const clean = href.split(/[?#]/)[0];
  const dot = clean.lastIndexOf('.');
  return dot >= 0 ? clean.slice(dot + 1).toLowerCase() : '';
}

// ── Marked configuration ─────────────────────────────────────────────────
// Block HTML tokenizer: match Obsidian's behavior of pairing open/close tags
// instead of swallowing to the next blank line.
// Renderer overrides: code fences, images (figure+zoom), tables (wrap).

const defaultTableRenderer = Renderer.prototype.table;

marked.use({
  extensions: [mathBlockExtension, mathInlineExtension],
  tokenizer: {
    html(src: string) {
      // Block HTML: standalone open-tag line → depth-matched close tag end.
      const open = OPEN_BLOCK_HTML_RE.exec(src);
      if (open) {
        const tag = open[1].toLowerCase();
        const re = CLOSE_TAG_RE(tag);
        let depth = 1;
        const i = open[0].length;
        const parts: string[] = [];
        for (const line of src.slice(i).split('\n')) {
          if (parts.length > 0 && /^\s*$/.test(line)) break;
          parts.push(line);
          re.lastIndex = 0;
          let mm: RegExpExecArray | null;
          while ((mm = re.exec(line))) {
            const t = mm[0];
            if (t.startsWith('</')) depth -= 1;
            else if (!t.endsWith('/>')) depth += 1;
          }
          if (depth <= 0) break;
        }
        const raw = src.slice(0, i) + parts.join('\n');
        return { type: 'html', block: true, raw, pre: false, text: raw };
      }
      // Other HTML (comments / script/pre/style / inline tags) — default
      const rules = (
        this as unknown as {
          rules: { block: { html: RegExp } };
        }
      ).rules;
      const cap = rules.block.html.exec(src);
      if (cap) {
        return {
          type: 'html',
          block: true,
          raw: cap[0],
          pre: cap[1] === 'pre' || cap[1] === 'script' || cap[1] === 'style',
          text: cap[0],
        };
      }
      return undefined;
    },
  },
  renderer: {
    code({ text, lang }: { text: string; lang?: string }) {
      const language = (lang ?? '').trim().split(/\s+/)[0] || '';
      // Mermaid: emit wrapped pre.mermaid placeholder for lazy hydration (Task 1.3)
      if (language === 'mermaid') {
        return `<div class="mermaid-block wide"><pre class="mermaid">${text}</pre></div>`;
      }
      // Regular code: escaped plaintext (highlight applied during hydration)
      const inner = escapeHtml(text);
      const label = language
        ? `<div class="code-lang">${escapeHtml(language)}</div>`
        : '';
      const copy = '<button class="code-copy" type="button">复制</button>';
      return `<div class="code-block wide">${label}${copy}<pre><code>${inner}</code></pre></div>`;
    },
    image({ href, title, text }: { href: string; title: string | null; text: string }) {
      const safeHref = escapeHtml(href);
      const alt = escapeHtml(text ?? '');
      const caption = title ? `<figcaption>${escapeHtml(title)}</figcaption>` : '';
      const ext = extensionOf(href);
      if (ext !== '' && VIDEO_EXTENSIONS.has(ext)) {
        return `<figure class="wide mdb-video"><video controls preload="metadata" src="${safeHref}"></video>${caption}</figure>`;
      }
      if (ext !== '' && !IMAGE_EXTENSIONS.has(ext)) {
        const name = alt !== '' ? alt : escapeHtml(href);
        return `<figure class="wide mdb-file"><a href="${safeHref}">${name}</a>${caption}</figure>`;
      }
      return `<figure class="wide"><img src="${safeHref}" alt="${alt}" data-zoomable="" />${caption}</figure>`;
    },
    table(this: Renderer, token) {
      // Delegate cell/row rendering to the default renderer, then wrap.
      const inner = defaultTableRenderer.call(this, token) as string;
      return `<div class="table-wrap wide">${inner}</div>`;
    },
  },
});

// ── Checkbox guard (one-time DOMPurify hook) ─────────────────────────────
let checkboxGuardRegistered = false;

function registerCheckboxGuard(): void {
  if (checkboxGuardRegistered) return;
  checkboxGuardRegistered = true;
  // GFM task lists render via input[type=checkbox][disabled]; all other
  // inputs get their attributes stripped.
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName !== 'INPUT') return;
    const input = node as HTMLInputElement;
    if (input.type !== 'checkbox' || !input.disabled) {
      input.removeAttribute('type');
      input.removeAttribute('checked');
      input.removeAttribute('disabled');
    }
  });
}

// ── Column width reconstruction (#327) ───────────────────────────────────
let columnWidthHookRegistered = false;

/**
 * The sanitizer strips `style`, so per-column widths from the editor arrive as
 * a `data-cols="a,b"` attribute. Rebuild the grid tracks here — after attribute
 * sanitization, from a validated numeric value — so preview, HTML export and
 * PNG all honor the widths the editor wrote, without relaxing the sanitizer.
 */
function registerColumnWidthHook(): void {
  if (columnWidthHookRegistered) return;
  columnWidthHookRegistered = true;
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (!(node instanceof Element)) return;
    const cols = node.getAttribute('data-cols');
    if (!cols) return;
    const count = Number(/layout-col-(\d)/.exec(node.getAttribute('class') ?? '')?.[1]);
    const gapShare = { 2: '0.75em', 3: '0.8333em', 4: '0.9375em', 5: '0.8em' }[count];
    if (!gapShare) return;
    const widths = cols.split(',').slice(0, count).map(Number);
    if (widths.length !== count || widths.some((w) => !Number.isFinite(w) || w <= 0)) return;
    (node as HTMLElement).style.gridTemplateColumns = widths
      .map((w) => `calc(${w}% - ${gapShare})`)
      .join(' ');
  });
}

// ── YAML frontmatter stripping ───────────────────────────────────────────
// Obsidian hides leading YAML in reading view. Strip so `---` doesn't render
// as <hr> and `tags:` as heading. \uFEFF? tolerates BOM prefix (Obsidian).
const FRONTMATTER_RE = /^\uFEFF?---\s*\n[\s\S]*?\n---\s*(?:\n|$)/;

// ── Callout conversion ───────────────────────────────────────────────────
// Type names align with Obsidian: alphanumeric + -_/.; allowed, [! and ]
// may surround whitespace, case-insensitive.
const CALLOUT_HEAD = /^\[!\s*([^\]\r\n]+?)\s*\]([+-]?)/;

/** Callout label map — matches clairis CALLOUT_LABELS exactly. */
const CALLOUT_LABELS: Record<string, string> = {
  note: '注释',
  info: '信息',
  abstract: '摘要',
  summary: '总结',
  tip: '提示',
  hint: '提示',
  important: '重要',
  success: '成功',
  check: '完成',
  warning: '警告',
  caution: '注意',
  attention: '注意',
  danger: '危险',
  error: '错误',
  failure: '失败',
  bug: '问题',
  question: '疑问',
  help: '帮助',
  faq: '问答',
  example: '示例',
  quote: '引用',
  cite: '引述',
};

// Marker comment inserted before each detected opener so the multi-opener split
// can follow the ORIGINAL DOM nodes instead of a flattened text stream.
const CALLOUT_OPENER_MARKER = 'callout-opener-marker';

function isCalloutOpenerMarker(node: Node): boolean {
  return (
    node.nodeType === Node.COMMENT_NODE &&
    (node as Comment).data === CALLOUT_OPENER_MARKER
  );
}

/**
 * Count `[!TYPE]` openers that begin a text line inside the blockquote. Reads
 * text nodes directly (never the concatenated textContent) so an opener that
 * starts a fresh block after a list is still recognised, and so detection is a
 * pure read — no DOM mutation leaks into the single-callout path.
 */
function countCalloutOpeners(bq: Element, doc: Document): number {
  const re = /(^|\n)[ \t]*\[!\s*([^\]\r\n]+?)\s*\]([+-]?)/g;
  const walker = doc.createTreeWalker(bq, NodeFilter.SHOW_TEXT);
  let count = 0;
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const src = (node as Text).nodeValue ?? '';
    if (!src.includes('[!')) continue;
    re.lastIndex = 0;
    while (re.exec(src) !== null) count += 1;
  }
  return count;
}

/**
 * Split every text node that holds an opener so each opener starts a fresh text
 * node, then insert a marker comment immediately before it. Openers are marked
 * in document order; the caller segments by walking the marker comments.
 */
function markCalloutOpeners(bq: Element, doc: Document): void {
  const re = /(^|\n)[ \t]*\[!\s*([^\]\r\n]+?)\s*\]([+-]?)/g;
  const walker = doc.createTreeWalker(bq, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) textNodes.push(node as Text);

  for (const text of textNodes) {
    const src = text.nodeValue ?? '';
    if (!src.includes('[!')) continue;
    re.lastIndex = 0;
    const offsets: number[] = [];
    let match: RegExpExecArray | null;
    while ((match = re.exec(src)) !== null) {
      offsets.push(match.index + match[0].indexOf('[!'));
    }
    if (offsets.length === 0) continue;

    // Split left-to-right; `current` always starts at the previous opener, so
    // the next split offset is relative to it.
    let current = text;
    let consumed = 0;
    for (const offset of offsets) {
      const relative = offset - consumed;
      if (relative > 0) current = current.splitText(relative);
      current.parentNode?.insertBefore(doc.createComment(CALLOUT_OPENER_MARKER), current);
      consumed = offset;
    }
  }
}

/**
 * Split any element that directly contains an opener marker into sibling copies
 * of itself, one per marker-delimited run. Runs keep their ORIGINAL nodes (only
 * the wrapper element is cloned), and markers surface as direct children of the
 * blockquote so segmentation can assign every node to exactly one segment.
 */
function splitMarkedElements(container: Element, doc: Document): void {
  for (const child of Array.from(container.children)) {
    splitMarkedElements(child, doc);
  }
  const hasMarker = Array.from(container.childNodes).some(isCalloutOpenerMarker);
  if (!hasMarker) return;
  const parent = container.parentNode;
  if (!parent) return;

  const tag = container.tagName;
  const pieces: Node[] = [];
  let run: Node[] = [];
  const flushRun = (): void => {
    if (run.length === 0) return;
    const clone = doc.createElement(tag);
    for (const attr of Array.from(container.attributes)) {
      clone.setAttribute(attr.name, attr.value);
    }
    for (const n of run) clone.appendChild(n);
    pieces.push(clone);
    run = [];
  };

  for (const n of Array.from(container.childNodes)) {
    if (isCalloutOpenerMarker(n)) {
      flushRun();
      pieces.push(n);
    } else {
      run.push(n);
    }
  }
  flushRun();

  for (const piece of pieces) parent.insertBefore(piece, container);
  parent.removeChild(container);
}

/**
 * Build one callout element from a blockquote whose first element child's
 * innerHTML begins with a `[!TYPE]` head. Serializes the ORIGINAL child nodes
 * (innerHTML / outerHTML), so inline structure — <strong>, <a>, <code> — and
 * following blocks (lists) survive into the callout body. Returns null when the
 * head does not match.
 */
function buildCallout(bq: Element, doc: Document): Element | null {
  const first = bq.firstElementChild;
  if (!first) return null;
  // First child node index may not be 0 (preceding whitespace text nodes),
  // so slice from the actual first element's index onward.
  const children = Array.from(bq.childNodes);
  const after = children.slice(children.indexOf(first) + 1);

  const m = CALLOUT_HEAD.exec(first.innerHTML);
  if (!m) return null;

  const type = m[1].toLowerCase();
  const fold = m[2];
  const rest = first.innerHTML.slice(m[0].length);

  // Title goes to the first <br> or newline; remainder is body.
  const sep = /<br\s*\/?>|\n/.exec(rest);
  const at = sep ? sep.index : -1;
  const titleHtml = (at >= 0 ? rest.slice(0, at) : rest).trim();
  let bodyHtml = sep ? rest.slice(sep.index + sep[0].length) : '';

  after.forEach((n) => {
    bodyHtml += (n as Element).outerHTML ?? n.textContent ?? '';
  });

  const label = CALLOUT_LABELS[type] ?? type;
  const title = titleHtml || label;

  const el = doc.createElement(fold ? 'details' : 'div');
  el.className = 'callout';
  el.setAttribute('data-callout', type);
  if (fold === '+') el.setAttribute('open', '');

  const titleEl = doc.createElement(fold ? 'summary' : 'div');
  if (!fold) titleEl.className = 'callout-title';

  const typeEntry = CALLOUT_TYPE_MAP[type];
  if (typeEntry) {
    const iconSpan = doc.createElement('span');
    iconSpan.className = 'callout-icon';
    iconSpan.textContent = typeEntry.icon;
    titleEl.appendChild(iconSpan);
  }

  const titleText = doc.createElement('span');
  titleText.textContent = title;
  titleEl.appendChild(titleText);
  el.appendChild(titleEl);

  if (bodyHtml) {
    const wrap = doc.createElement('div');
    wrap.innerHTML = bodyHtml;
    while (wrap.firstChild) el.appendChild(wrap.firstChild);
  }

  return el;
}

function convertCallouts(doc: Document): void {
  doc.querySelectorAll('blockquote').forEach((bq) => {
    const openerCount = countCalloutOpeners(bq, doc);
    if (openerCount === 0) return;

    // Single callout: the original blockquote already has the right shape.
    if (openerCount === 1) {
      const el = buildCallout(bq, doc);
      if (el) bq.replaceWith(el);
      return;
    }

    // Multiple adjacent callouts merged into one blockquote: segment the
    // ORIGINAL DOM (markers + wrapper clones) and reuse buildCallout per
    // segment, so every original node keeps its place and its markup.
    markCalloutOpeners(bq, doc);
    for (const child of Array.from(bq.children)) {
      splitMarkedElements(child, doc);
    }

    const holders = Array.from({ length: openerCount }, () => doc.createElement('blockquote'));
    let segment = -1;
    for (const n of Array.from(bq.childNodes)) {
      if (isCalloutOpenerMarker(n)) {
        segment += 1;
        continue;
      }
      if (segment >= 0) holders[segment].appendChild(n);
    }

    const fragment = doc.createDocumentFragment();
    for (const holder of holders) {
      if (holder.firstElementChild === null) continue;
      const el = buildCallout(holder, doc);
      if (el) fragment.appendChild(el);
    }
    bq.replaceWith(fragment);
  });
}




// ── CJK spacing ──────────────────────────────────────────────────────────
// Insert zero-width spacers between CJK and Latin runs for better typography.
const CJK_RANGE = '\\u2e80-\\u9fff\\u3000-\\u303f\\uff00-\\uffef';
const CJK_LATIN = new RegExp(
  `([${CJK_RANGE}])([A-Za-z0-9])|([A-Za-z0-9])([${CJK_RANGE}])`,
  'g',
);
const SPACING_SKIP = 'pre, code, .katex, style, script';

function addCjkSpacing(doc: Document): void {
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const targets: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node as Text;
    const parent = text.parentElement;
    if (!parent || parent.closest(SPACING_SKIP)) continue;
    if (!text.nodeValue || text.nodeValue.length < 2) continue;
    targets.push(text);
  }

  targets.forEach((text) => {
    const src = text.nodeValue ?? '';
    const frag = doc.createDocumentFragment();
    let last = 0;

    for (const m of src.matchAll(CJK_LATIN)) {
      const at = m.index ?? 0;
      if (at > last) frag.appendChild(doc.createTextNode(src.slice(last, at)));
      frag.appendChild(doc.createTextNode(m[1] ?? m[3]));
      const pad = doc.createElement('span');
      pad.className = 'cjk-pad';
      frag.appendChild(pad);
      frag.appendChild(doc.createTextNode(m[2] ?? m[4]));
      last = at + m[0].length;
    }
    if (last === 0) return;
    if (last < src.length)
      frag.appendChild(doc.createTextNode(src.slice(last)));
    text.replaceWith(frag);
  });
}

// ── Dangerous URL neutralization (defense-in-depth) ─────────────────────
const DANGEROUS_URL_RE = /(?:javascript|vbscript):/gi;
const DANGEROUS_URL_TEST = /(?:javascript|vbscript):/i;
const URL_STRIP_SKIP = 'pre, code, .katex, style, script';

function stripDangerousUrls(doc: Document): void {
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const targets: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node as Text;
    if (!text.nodeValue) continue;
    if (!DANGEROUS_URL_TEST.test(text.nodeValue)) continue;
    if (text.parentElement?.closest(URL_STRIP_SKIP)) continue;
    targets.push(text);
  }
  DANGEROUS_URL_RE.lastIndex = 0;
  for (const text of targets) {
    text.nodeValue = (text.nodeValue ?? '').replace(DANGEROUS_URL_RE, '');
  }
}

// ── Post-process: callouts → links → url strip → CJK ────────────────
function postProcess(html: string, opts?: RenderOptions): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  convertCallouts(doc);
  doc.querySelectorAll('a').forEach((a) => {
    if (!a.getAttribute('target')) a.setAttribute('target', '_blank');
  });
  stripDangerousUrls(doc);
  const cjkDisabled = opts?.cjkSpacing === false;
  if (!cjkDisabled && (doc.body.textContent ?? '').length < 200_000) {
    addCjkSpacing(doc);
  }
  return doc.body.innerHTML;
}

// ── Public API ───────────────────────────────────────────────────────────

/** Callout type registry — icon/label/tone per type, pinned to clairis source. */
export const CALLOUT_TYPE_MAP: Readonly<
  Record<string, { label: string; tone: string; icon: string }>
> = {
  note: { label: '注释', tone: 'blue', icon: '📝' },
  info: { label: '信息', tone: 'blue', icon: 'ℹ️' },
  abstract: { label: '摘要', tone: 'purple', icon: '📋' },
  summary: { label: '总结', tone: 'purple', icon: '📋' },
  tip: { label: '提示', tone: 'green', icon: '💡' },
  hint: { label: '提示', tone: 'green', icon: '💡' },
  important: { label: '重要', tone: 'purple', icon: '⭐' },
  success: { label: '成功', tone: 'green', icon: '✅' },
  check: { label: '完成', tone: 'green', icon: '✅' },
  warning: { label: '警告', tone: 'orange', icon: '⚠️' },
  caution: { label: '注意', tone: 'orange', icon: '⚠️' },
  attention: { label: '注意', tone: 'orange', icon: '⚠️' },
  danger: { label: '危险', tone: 'red', icon: '🚨' },
  error: { label: '错误', tone: 'red', icon: '❌' },
  failure: { label: '失败', tone: 'red', icon: '✖️' },
  bug: { label: '问题', tone: 'red', icon: '🐛' },
  question: { label: '疑问', tone: 'teal', icon: '❓' },
  help: { label: '帮助', tone: 'teal', icon: '💬' },
  faq: { label: '问答', tone: 'teal', icon: '💬' },
  example: { label: '示例', tone: 'gray', icon: '📝' },
  quote: { label: '引用', tone: 'muted', icon: '💬' },
  cite: { label: '引述', tone: 'muted', icon: '📖' },
};

/**
 * Render markdown to sanitized HTML. Synchronous, pure, never throws.
 * Ported from clairis src/renderers/markdown.ts (pure Web adaptation).
 */
export function renderMarkdownCore(
  content: string,
  opts?: RenderOptions,
): string {
  if (!content) return '';

  registerCheckboxGuard();
  registerColumnWidthHook();

  const body = content.replace(FRONTMATTER_RE, '');
  const preprocessed = preprocessFencedDivs(body);
  const raw = marked.parse(preprocessed, { async: false }) as string;
  const clean = DOMPurify.sanitize(raw, SANITIZE_CONFIG);
  return postProcess(clean, opts);
}
