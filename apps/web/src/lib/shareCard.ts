// 分享卡「复制为图片」（任务 6.2）—— 卡片 HTML → SVG foreignObject → PNG → 剪贴板。
// 复用 3.5 的栅格化管线（svgFromHtml / svgToPngBlob，零重复实现）与 6.1 的 byline：
//   buildShareCardHtml（暗色卡片：标题 + 首行预览 + 字数/图数 + 角落 byline）
//   → shareCardSvg（svgFromHtml 委托，600×300 定尺寸）
//   → cardToPngBlob（svgToPngBlob 委托，canvas/Image 可注入）
//   → copyToClipboard（ClipboardItem 剪贴板 seam，无 API 立即 false）
//   → shareCardAsImage（组装全流程，返回 { copied, blob } —— 调用方决定兜底下载）
//   → canShare（无文档数据时禁用按钮的判定）
// 单测（node）注入 fake canvas/Image 与 copy seam；真机/CI 走默认实现。

import { renderMarkdown } from '@md-bundle/renderer';
import { getThemeColor, type ThemeName } from '@md-bundle/editor';
import { svgFromHtml, svgToPngBlob } from './exportPng';
import { bylineCornerBadgeHtml } from './byline';

/** 分享卡统计：字数 + 图数（App 从文档/资产清单计算）。 */
export interface ShareCardStats {
  chars: number;
  images: number;
}

/** 卡片默认尺寸（px）—— 与规格一致：~600×300。 */
export const CARD_WIDTH = 600;
export const CARD_HEIGHT = 300;

/** 预览文字截断长度（markdown 纯文本前 ~120 字）。 */
export const PREVIEW_MAX_CHARS = 120;

/** 卡片主题色（基于当前有效主题，通过 getThemeColor 取 token）。 */
export function cardColors(theme: ThemeName) {
  return {
    bg: getThemeColor(theme, 'card-bg'),
    border: getThemeColor(theme, 'border'),
    title: getThemeColor(theme, 'text'),
    text: getThemeColor(theme, 'text-secondary'),
  };
}

/**
 * Markdown → 纯文本预览片段：renderMarkdown（复用预览/导出的同一渲染器，
 * 含 script 转义与危险标签清洗）→ 剥标签 → 解码常见实体 → 折叠空白 → 截断。
 * 纯字符串处理（无 textContent）—— node 单测可跑，浏览器一致。
 */
export function markdownToPlainText(markdown: string, max = PREVIEW_MAX_CHARS): string {
  const text = renderMarkdown(markdown)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, max);
}

/** 用户文本 → XML 安全文本（卡片 HTML 会嵌入 foreignObject，按 XML 解析）。 */
function escapeXmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface BuildShareCardHtmlOptions {
  title: string;
  /** 文档源码 —— 卡片主体取首行预览（markdownToPlainText）。 */
  markdown: string;
  stats: ShareCardStats;
  theme?: ThemeName;
}

/**
 * 组装分享卡 HTML（暗色卡片，600×300）：
 * 标题（粗体 #e6edf3）+ 预览行（#8b949e，2 行截断）+ 统计行（「{chars} 字 · {images} 图」）
 * + 右下角 byline 徽标（bylineCornerBadgeHtml('md-share')）。
 * 外层 div `position:relative` 是徽标绝对定位的锚点（byline 徽标自带 absolute 定位）。
 * 无 void 元素 → 直接通过 toWellFormedXhtml 的 XML 校验。
 */
export function buildShareCardHtml({
  title,
  markdown,
  stats,
  theme = 'dark',
}: BuildShareCardHtmlOptions): string {
  const preview = markdownToPlainText(markdown);
  const c = cardColors(theme);
  return (
    '<div style="position:relative;width:600px;height:300px;box-sizing:border-box;' +
    `background:${c.bg};border:1px solid ${c.border};border-radius:12px;` +
    'padding:28px 32px;display:flex;flex-direction:column;' +
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;" +
    `color:${c.text};">` +
    `<div style="font-size:22px;font-weight:700;color:${c.title};line-height:1.35;margin-bottom:12px;">${escapeXmlText(title)}</div>` +
    `<div style="font-size:14px;line-height:1.6;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeXmlText(preview)}</div>` +
    `<div style="margin-top:auto;font-size:13px;">${stats.chars} 字 · ${stats.images} 图</div>` +
    bylineCornerBadgeHtml('md-share') +
    '</div>'
  );
}

export interface ShareCardSvgOptions {
  width?: number;
  height?: number;
}

/**
 * 卡片 HTML → 定尺寸 SVG（foreignObject 包裹）。委托 exportPng 的 svgFromHtml
 * （内部已做 toWellFormedXhtml：去 doctype + void 元素自闭合）—— 不重复实现。
 */
export function shareCardSvg(
  html: string,
  opts: ShareCardSvgOptions = {},
): string {
  return svgFromHtml(html, {
    width: opts.width ?? CARD_WIDTH,
    height: opts.height ?? CARD_HEIGHT,
  });
}

export interface CardToPngBlobOptions {
  /** 栅格缩放倍率（默认 2 —— 2x 出图更清晰）。 */
  scale?: number;
  /** 栅格前的画布底色（默认取主题 bg，圆角外的透明角落有底色）。 */
  background?: string;
  /** canvas 工厂注入点（透传 svgToPngBlob）。 */
  createCanvas?: (width: number, height: number) => HTMLCanvasElement;
  /** Image 工厂注入点（透传 svgToPngBlob）。 */
  makeImage?: () => HTMLImageElement;
}

/**
 * SVG → PNG Blob。直接委托 exportPng 的 svgToPngBlob（同一栅格化管线，
 * 含 data URI 加载 / canvas 2x 绘制 / toBlob 失败拒绝）—— 不重复实现。
 */
export function cardToPngBlob(svg: string, opts: CardToPngBlobOptions = {}): Promise<Blob> {
  return svgToPngBlob(svg, opts);
}

/**
 * Blob → 剪贴板（image/png）。默认实现：ClipboardItem + navigator.clipboard.write，
 * try/catch 收敛为 boolean。守卫：无 ClipboardItem API（node/jsdom/旧浏览器）→
 * 立即返回 false，绝不抛错 —— 调用方走下载兜底。
 */
export async function copyToClipboard(blob: Blob): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || typeof ClipboardItem === 'undefined') {
      return false;
    }
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return true;
  } catch {
    return false;
  }
}

export interface ShareCardAsImageOptions {
  title: string;
  markdown: string;
  stats: ShareCardStats;
  theme?: ThemeName;
  /** 复制 seam（默认 copyToClipboard；测试注入 stub 断言 copied 分支）。 */
  copy?: (blob: Blob) => Promise<boolean>;
  /** 栅格缩放倍率（透传 cardToPngBlob）。 */
  scale?: number;
  /** 画布底色（默认 getThemeColor(theme,'bg')）。 */
  background?: string;
  /** canvas 工厂注入点（透传 cardToPngBlob）。 */
  createCanvas?: (width: number, height: number) => HTMLCanvasElement;
  /** Image 工厂注入点（透传 cardToPngBlob）。 */
  makeImage?: () => HTMLImageElement;
}

/**
 * 分享卡全流程：build → svg → png → 尝试复制。
 * 返回 { copied, blob } —— 复制失败时调用方用 blob 走下载兜底
 * （App 6.4：`if (!copied) downloadBlob(blob, 'share-card.png')`）。
 */
export async function shareCardAsImage({
  title,
  markdown,
  stats,
  theme = 'dark',
  copy = copyToClipboard,
  scale,
  background,
  createCanvas,
  makeImage,
}: ShareCardAsImageOptions): Promise<{ copied: boolean; blob: Blob }> {
  const html = buildShareCardHtml({ title, markdown, stats, theme });
  const svg = shareCardSvg(html);
  const blob = await cardToPngBlob(svg, {
    scale,
    background: background ?? getThemeColor(theme, 'bg'),
    createCanvas,
    makeImage,
  });
  const copied = await copy(blob);
  return { copied, blob };
}

/**
 * 是否有可分享的文档数据（标题非空 或 字数 > 0）—— 6.4 用它禁用分享按钮。
 * 空文档（无标题、无内容）→ false。
 */
export function canShare(data: { title: string; stats: ShareCardStats }): boolean {
  return data.title.trim().length > 0 || data.stats.chars > 0;
}