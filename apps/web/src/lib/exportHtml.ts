// HTML 导出 —— 纯逻辑、可单测。产出完全自包含的 HTML 字符串：
//   - 样式全部内联（readerCss 原文 + 主题 token 覆盖 + 可选 KaTeX CSS/字体），零外部请求
//   - 图片引用按资产清单解析为 data URI；解析不了的 <img> 整段移除（不裂图、无外链）
//   - 页脚 Made-with byline（`?ref=md-html` 品牌链接）
// 安全：复用 @md-bundle/renderer 的 renderMarkdown（唯一净化管线），不重复实现。
// KaTeX 字体条件注入：仅当序列化 HTML 含 class="katex" 时内联 woff2 data URI（零多余字节）。
import { renderMarkdown, readerCssText, hydrateLazyFeatures } from '@md-bundle/renderer';
import { getThemeColor, type ThemeName } from '@md-bundle/editor';
import type { Asset } from './assets';
import { bylineFooterHtml } from './byline';
import { hasKatex, getKatexCssInlined } from './katexFonts';

/** 匹配一个 `<img ...>` 标签（容忍属性值里的 `>`）。 */
const IMG_TAG = /<img\b[^>]*>/gi;

/** 提取 `src` 属性值（双引号 / 单引号 / 无引号）。 */
const SRC_ATTR = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i;

/**
 * 把 HTML 里的图片引用解析为 data URI：
 * - src 已是 `data:` URI → 原样保留
 * - src 是资产名（`name.png` 或 `./name.png`）→ 替换为资产的 dataUrl
 * - 其余（绝对 http(s)/file:// URL、空 src、解析不到资产）→ 整段移除 `<img>`
 * 确定性、纯字符串操作；alt 等其余属性原样保留。
 */
export function inlineImages(html: string, assets: Asset[]): string {
  const byName = new Map(assets.map((a) => [a.name, a.dataUrl]));
  return html.replace(IMG_TAG, (tag) => {
    const m = tag.match(SRC_ATTR);
    if (!m) return '';
    const src = m[1] ?? m[2] ?? m[3] ?? '';
    if (src.startsWith('data:')) return tag;
    const bare = src.startsWith('./') ? src.slice(2) : src;
    const dataUrl = byName.get(bare);
    if (dataUrl) return tag.replace(SRC_ATTR, `src="${dataUrl}"`);
    return '';
  });
}

export interface BuildHtmlDocumentOptions {
  markdown: string;
  assets: Asset[];
  title?: string;
  theme?: ThemeName;
}

/** 转义 <title> 内容（标题来自用户输入）。 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 构建完整自包含 HTML 文档（异步 —— KaTeX 字体内联需 fetch）：
 * `<!doctype html>` + `<head>`（charset/viewport/title + readerCss 主题样式 +
 * 可选 KaTeX CSS/字体 + 主题 token 覆盖）+ `.preview-content` 正文
 * （图片已内联为 data URI，`data-theme` 激活 CSS 的暗色变量）+ Made-with 页脚。
 * 顺序：renderMarkdown（净化）→ inlineImages（内联）→ KaTeX 条件注入 → 组装文档。
 */
export async function buildHtmlDocument({
  markdown,
  assets,
  title = 'MD-Bundle 文档',
  theme = 'dark',
}: BuildHtmlDocumentOptions): Promise<string> {
  const raw = renderMarkdown(markdown);

  let hydrated: string;
  if (typeof document !== 'undefined') {
    const root = document.createElement('div');
    root.innerHTML = raw;
    await hydrateLazyFeatures(root, theme);
    hydrated = root.innerHTML;
  } else {
    hydrated = raw;
  }

  const body = inlineImages(hydrated, assets);
  const bg = getThemeColor(theme, 'bg');
  const text = getThemeColor(theme, 'text');
  const primary = getThemeColor(theme, 'primary');
  const muted = getThemeColor(theme, 'muted');

  const overrides = [
    '.preview-content {',
    `  background: ${bg};`,
    `  color: ${text};`,
    '  max-width: 800px;',
    '  margin: 0 auto;',
    '  padding: 32px 20px;',
    '  box-sizing: border-box;',
    '}',
    '.preview-content img { max-width: 100%; }',
    'footer {',
    '  text-align: center;',
    '  padding: 24px 0 32px;',
    `  color: ${muted};`,
    "  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;",
    '  font-size: 14px;',
    '}',
    'footer a {',
    `  color: ${primary};`,
    '  text-decoration: none;',
    '}',
    'footer a:hover { text-decoration: underline; }',
  ].join('\n');

  // 条件注入 KaTeX CSS + 内联字体（仅当文档含公式时）
  const katexSection = hasKatex(body)
    ? `<style>${await getKatexCssInlined()}</style>`
    : '';

  return [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    `<style>${readerCssText}</style>`,
    katexSection,
    `<style>${overrides}</style>`,
    '</head>',
    '<body>',
    `<div class="preview-content" data-theme="${theme}">${body}</div>`,
    bylineFooterHtml(),
    '</body>',
    '</html>',
  ].join('\n');
}
