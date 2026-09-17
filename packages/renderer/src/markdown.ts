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
    'div', 'span', 'section', 'article',
    'details', 'summary',
    'figure', 'figcaption',
    'dl', 'dt', 'dd',
    'kbd', 'sup', 'sub', 'mark', 'abbr', 'small', 'u', 's',
    'var', 'samp', 'cite', 'q', 'time',
    'picture', 'source',
    // code block copy button
    'button',
  ],
  ALLOWED_ATTR: [
    'href', 'src', 'alt', 'title', 'class', 'target',
    'type', 'checked', 'disabled',
    'colspan', 'rowspan', 'start', 'value',
    'width', 'height', 'open', 'lang', 'dir',
    'data-math', 'data-math-tex', 'data-math-display', 'data-callout', 'data-zoomable',
  ],
  ALLOW_DATA_ATTR: true,
  SANITIZE_NAMED_PROPS: true,
  ADD_ATTR: ['target'],
};

// ── HTML escape (source-level defense before DOMPurify) ───────────────────
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
      const alt = escapeHtml(text ?? '');
      const caption = title
        ? `<figcaption>${escapeHtml(title)}</figcaption>`
        : '';
      return `<figure class="wide"><img src="${escapeHtml(href)}" alt="${alt}" data-zoomable="" />${caption}</figure>`;
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

// ── YAML frontmatter stripping ───────────────────────────────────────────
// Obsidian hides leading YAML in reading view. Strip so `---` doesn't render
// as <hr> and `tags:` as heading. \uFEFF? tolerates BOM prefix (Obsidian).
const FRONTMATTER_RE = /^\uFEFF?---\s*\n[\s\S]*?\n---\s*(?:\n|$)/;

// ── Callout conversion ───────────────────────────────────────────────────
// Type names align with Obsidian: alphanumeric + -_/.; allowed, [! and ]
// may surround whitespace, case-insensitive.
const CALLOUT_HEAD = /^\[!\s*([^\]\r\n]+?)\s*\]([+-]?)/;

/** 22-key callout label map — matches clairis CALLOUT_LABELS exactly. */
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

function convertCallouts(doc: Document): void {
  doc.querySelectorAll('blockquote').forEach((bq) => {
    const first = bq.firstElementChild;
    if (!first) return;
    // First child node index may not be 0 (preceding whitespace text nodes),
    // so slice from the actual first element's index onward.
    const children = Array.from(bq.childNodes);
    const after = children.slice(children.indexOf(first) + 1);

    const m = CALLOUT_HEAD.exec(first.innerHTML);
    if (!m) return;

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
    titleEl.innerHTML = title;
    el.appendChild(titleEl);

    if (bodyHtml) {
      const wrap = doc.createElement('div');
      wrap.innerHTML = bodyHtml;
      while (wrap.firstChild) el.appendChild(wrap.firstChild);
    }

    bq.replaceWith(el);
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

/** Callout type registry — 22-key snapshot pinned to clairis source. */
export const CALLOUT_TYPE_MAP: Readonly<
  Record<string, { label: string; tone: string }>
> = {
  note: { label: '注释', tone: 'blue' },
  info: { label: '信息', tone: 'blue' },
  abstract: { label: '摘要', tone: 'purple' },
  summary: { label: '总结', tone: 'purple' },
  tip: { label: '提示', tone: 'green' },
  hint: { label: '提示', tone: 'green' },
  important: { label: '重要', tone: 'purple' },
  success: { label: '成功', tone: 'green' },
  check: { label: '完成', tone: 'green' },
  warning: { label: '警告', tone: 'orange' },
  caution: { label: '注意', tone: 'orange' },
  attention: { label: '注意', tone: 'orange' },
  danger: { label: '危险', tone: 'red' },
  error: { label: '错误', tone: 'red' },
  failure: { label: '失败', tone: 'red' },
  bug: { label: '问题', tone: 'red' },
  question: { label: '疑问', tone: 'teal' },
  help: { label: '帮助', tone: 'teal' },
  faq: { label: '问答', tone: 'teal' },
  example: { label: '示例', tone: 'gray' },
  quote: { label: '引用', tone: 'muted' },
  cite: { label: '引述', tone: 'muted' },
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

  const body = content.replace(FRONTMATTER_RE, '');
  const raw = marked.parse(body, { async: false }) as string;
  const clean = DOMPurify.sanitize(raw, SANITIZE_CONFIG);
  return postProcess(clean, opts);
}
