// 独立渲染器序列化 —— 把 @md-bundle/renderer 的渲染能力打包进 .mdpkg，
// 使包可以在任何浏览器中独立打开（无需外部依赖、无需网络请求）。
// 职责：
//   1. 生成 renderer/renderer.js：自包含的 marked + DOMPurify 渲染管线
//   2. 生成 styles/styles.css：readerCssText 原文
// 这两个文件在导出时生成，写入 .mdpkg 后由 viewer.html 消费。
import { readerCssText } from '@md-bundle/renderer';

/** 独立渲染器源码（marked + DOMPurify + postProcess 的精简独立副本）。 */
export const STANDALONE_RENDERER_JS = String.raw`/**
 * mdpkg 独立渲染器 —— 自包含的 Markdown → HTML 渲染管线。
 * 由导出时生成，内嵌于 .mdpkg 包内，供 viewer.html 在离线环境下使用。
 * 依赖：全局 marked + DOMPurify（由 viewer.html 从包内或 CDN 加载）。
 */
(function (global) {
  'use strict';

  // ── YAML frontmatter 剥离 ──────────────────────────────────────────────
  const FRONTMATTER_RE = /^\uFEFF?---\s*\n[\s\S]*?\n---\s*(?:\n|$)/;

  // ── DOMPurify 配置（与 @md-bundle/renderer 一致）────────────────────────
  const SANITIZE_CONFIG = {
    ALLOWED_TAGS: [
      'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'pre', 'code', 'blockquote',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'img', 'a', 'em', 'strong', 'del', 'hr', 'br', 'input',
      'div', 'span', 'section', 'article',
      'details', 'summary',
      'figure', 'figcaption',
      'dl', 'dt', 'dd',
      'kbd', 'sup', 'sub', 'mark', 'abbr', 'small', 'u', 's',
      'var', 'samp', 'cite', 'q', 'time',
      'picture', 'source',
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

  // ── HTML 转义 ──────────────────────────────────────────────────────────
  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ── Checkbox guard（一次性 DOMPurify hook）──────────────────────────────
  function registerCheckboxGuard() {
    if (global.__mdpkgCheckboxGuard) return;
    global.__mdpkgCheckboxGuard = true;
    if (typeof DOMPurify !== 'undefined' && DOMPurify.addHook) {
      DOMPurify.addHook('afterSanitizeAttributes', function (node) {
        if (node.tagName !== 'INPUT') return;
        var input = node;
        if (input.type !== 'checkbox' || !input.disabled) {
          input.removeAttribute('type');
          input.removeAttribute('checked');
          input.removeAttribute('disabled');
        }
      });
    }
  }

  // ── Callout 转换 ───────────────────────────────────────────────────────
  var CALLOUT_HEAD = /^\[!\s*([^\]\r\n]+?)\s*\]([+-]?)/;
  var CALLOUT_LABELS = {
    note: '注释', info: '信息', abstract: '摘要', summary: '总结',
    tip: '提示', hint: '提示', important: '重要', success: '成功',
    check: '完成', warning: '警告', caution: '注意', attention: '注意',
    danger: '危险', error: '错误', failure: '失败', bug: '问题',
    question: '疑问', help: '帮助', faq: '问答', example: '示例',
    quote: '引用', cite: '引述',
  };

  function convertCallouts(doc) {
    var bqs = doc.querySelectorAll('blockquote');
    for (var i = 0; i < bqs.length; i++) {
      var bq = bqs[i];
      var first = bq.firstElementChild;
      if (!first) continue;
      var m = CALLOUT_HEAD.exec(first.innerHTML);
      if (!m) continue;
      var type = m[1].toLowerCase();
      var fold = m[2];
      var rest = first.innerHTML.slice(m[0].length);
      var sep = /<br\s*\/?>|\n/.exec(rest);
      var at = sep ? sep.index : -1;
      var titleHtml = (at >= 0 ? rest.slice(0, at) : rest).trim();
      var bodyHtml = sep ? rest.slice(sep.index + sep[0].length) : '';
      var label = CALLOUT_LABELS[type] || type;
      var title = titleHtml || label;
      var el = doc.createElement(fold ? 'details' : 'div');
      el.className = 'callout';
      el.setAttribute('data-callout', type);
      if (fold === '+') el.setAttribute('open', '');
      var titleEl = doc.createElement(fold ? 'summary' : 'div');
      if (!fold) titleEl.className = 'callout-title';
      titleEl.innerHTML = title;
      el.appendChild(titleEl);
      if (bodyHtml) {
        var wrap = doc.createElement('div');
        wrap.innerHTML = bodyHtml;
        while (wrap.firstChild) el.appendChild(wrap.firstChild);
      }
      bq.replaceWith(el);
    }
  }

  // ── 危险 URL 清理 ──────────────────────────────────────────────────────
  var DANGEROUS_URL_RE = /(?:javascript|vbscript):/gi;
  var DANGEROUS_URL_TEST = /(?:javascript|vbscript):/i;

  function stripDangerousUrls(doc) {
    var walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    var targets = [];
    var node;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue) continue;
      if (!DANGEROUS_URL_TEST.test(node.nodeValue)) continue;
      targets.push(node);
    }
    DANGEROUS_URL_RE.lastIndex = 0;
    for (var i = 0; i < targets.length; i++) {
      targets[i].nodeValue = (targets[i].nodeValue || '').replace(DANGEROUS_URL_RE, '');
    }
  }

  // ── 后处理 ─────────────────────────────────────────────────────────────
  function postProcess(html) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    convertCallouts(doc);
    var links = doc.querySelectorAll('a');
    for (var i = 0; i < links.length; i++) {
      if (!links[i].getAttribute('target')) links[i].setAttribute('target', '_blank');
    }
    stripDangerousUrls(doc);
    return doc.body.innerHTML;
  }

  // ── 公共 API ───────────────────────────────────────────────────────────
  global.MdpkgRenderer = {
    render: function (markdown) {
      if (!markdown) return '';
      registerCheckboxGuard();
      var body = markdown.replace(FRONTMATTER_RE, '');
      var raw = marked.parse(body, { async: false });
      var clean = DOMPurify.sanitize(raw, SANITIZE_CONFIG);
      return postProcess(clean);
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
`;

/** 导出时生成包内 styles/styles.css 内容（readerCssText 原文）。 */
export function getStandaloneStyles(): string {
  return readerCssText;
}
