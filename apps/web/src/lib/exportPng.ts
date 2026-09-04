// PNG 长图导出 —— SVG foreignObject + canvas 栅格化（零新依赖，不用 html2canvas）。
// 流程：buildHtmlDocument（复用 3.4 的主题化自包含 HTML，图片已内联 data URI）→
//   measureHeight（浏览器离屏 DOM 测量 scrollHeight）→
//   svgFromHtml（XML 转义 + foreignObject 包裹 —— 浏览器原生排版，CJK/emoji 走系统字体）→
//   svgToPngBlob（data URI → <img> → canvas 2x 栅格 → toBlob('image/png')）。
// 所有浏览器 API（高度测量 / createElement canvas / new Image）走可注入 seam：
// 单测注入 fake（node 无 canvas/Image），真机/CI 走默认实现。

import {
  buildHtmlDocument,
  type BuildHtmlDocumentOptions,
} from './exportHtml';
import { bylineCornerBadgeHtml } from './byline';
import { getThemeColor } from '@md-bundle/editor';

export interface SvgFromHtmlOptions {
  width: number;
  height: number;
}

/**
 * HTML 文档 → 良构 XHTML：去掉 `<!doctype html>`、void 元素补自闭合。
 * SVG 以图片加载时整体按 XML 解析 —— foreignObject 内容必须是良构 XML，
 * 否则整图加载失败；转义成文本则会把源码当正文渲染（实测）。marked 输出
 * 的 `<img>`/`<hr>` 等 void 元素不自闭合，必须补 `/`。
 */
const VOID_TAG =
  /<(img|br|hr|meta|input|link|source|wbr|area|base|col|embed|param|track)\b([^>]*)>/gi;

export function toWellFormedXhtml(html: string): string {
  return html
    .replace(/<!doctype html>/i, '')
    .replace(VOID_TAG, (m, tag: string, attrs: string) =>
      attrs.trimEnd().endsWith('/') ? m : `<${tag}${attrs}/>`,
    );
}

/**
 * 把 HTML 包进一张定宽定高 SVG：内容放 `<foreignObject width/height="100%">`，
 * 内层 `<div xmlns="http://www.w3.org/1999/xhtml">` 声明 XHTML 命名空间（XML 必需），
 * 浏览器对该子树按 HTML 渲染 —— 文字用系统字体（CJK/emoji 保真，无 tofu）。
 * height 由调用方（浏览器端测量）显式传入 —— SVG 必须有确定高度才能栅格化。
 */
export function svgFromHtml(html: string, opts: SvgFromHtmlOptions): string {
  const { width, height } = opts;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<foreignObject width="100%" height="100%">`,
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;overflow:hidden;">`,
    toWellFormedXhtml(html),
    `</div>`,
    `</foreignObject>`,
    `</svg>`,
  ].join('\n');
}

/** 高度测量实现签名 —— 注入点：单测注入 fake，浏览器默认真实 DOM 测量。 */
export type MeasureHeight = (html: string, width: number) => number;

/** 页脚底部额外留白（避免最后一行文字贴边）。 */
export const FOOTER_PADDING = 24;

/**
 * 在导出文档里注入 PNG 右下角 byline 徽标（任务 6.1）：
 * body 加 `position:relative` 作为绝对定位锚点，徽标插在 `</body>` 前。
 * 纯字符串替换 —— 确定性、可单测（PNG 级文本断言不可行，字符串级是接缝）。
 * 徽标绝对定位不占文档流 → 不影响 measureHeight 的 scrollHeight。
 */
export function withCornerByline(html: string): string {
  if (html.includes(bylineCornerBadgeHtml())) return html;
  return html
    .replace('<body>', '<body style="position:relative">')
    .replace('</body>', `${bylineCornerBadgeHtml()}\n</body>`);
}

/**
 * 默认测量实现（浏览器）：把 HTML 放进离屏 div，读 scrollHeight，返回高度 + 底部留白。
 * jsdom 无布局引擎（scrollHeight 恒 0）→ 仅浏览器路径调用，node 单测必须注入。
 */
export function measureHtmlHeight(html: string, width: number): number {
  const host = document.createElement('div');
  host.style.position = 'absolute';
  host.style.left = '-9999px';
  host.style.top = '0';
  host.style.visibility = 'hidden';
  host.style.width = `${width}px`;
  host.innerHTML = html;
  document.body.appendChild(host);
  const height = host.scrollHeight;
  document.body.removeChild(host);
  return height + FOOTER_PADDING;
}

export interface SvgToPngBlobOptions {
  /** 栅格缩放倍率（默认 2 —— 2x 出图更清晰）。 */
  scale?: number;
  /** 栅格前的画布底色（主题 bg），避免透明/黑边。 */
  background?: string;
  /** 可注入 canvas 工厂（jsdom 无实现；单测注入 fake）。 */
  createCanvas?: (width: number, height: number) => HTMLCanvasElement;
  /** 可注入 Image 工厂（jsdom 无实现；单测注入 fake）。 */
  makeImage?: () => HTMLImageElement;
}

/** 从 `<svg width="W" height="H">` 解析栅格尺寸（决定 canvas 大小）。 */
function svgDims(svg: string): { width: number; height: number } {
  const w = svg.match(/\bwidth="(\d+)"/);
  const h = svg.match(/\bheight="(\d+)"/);
  if (!w || !h) throw new Error('PNG 栅格化失败：SVG 缺少 width/height。');
  return { width: Number(w[1]), height: Number(h[1]) };
}

/**
 * SVG → PNG Blob：data URI 加载 <img> → canvas 按 scale 放大绘制 → toBlob('image/png')。
 * 任一步失败都 reject（img onerror / 无 2D 上下文 / toBlob null），绝不产出损坏 PNG。
 */
export async function svgToPngBlob(
  svg: string,
  opts: SvgToPngBlobOptions = {},
): Promise<Blob> {
  const scale = opts.scale ?? 2;
  const createCanvas =
    opts.createCanvas ??
    ((w: number, h: number) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return c;
    });
  const makeImage = opts.makeImage ?? (() => new Image());
  const { width, height } = svgDims(svg);

  const svgDataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const img = makeImage();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('PNG 栅格化失败：SVG 图片加载出错。'));
    img.src = svgDataUri;
  });

  const canvas = createCanvas(
    Math.round(width * scale),
    Math.round(height * scale),
  );
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('PNG 栅格化失败：无法创建 canvas 2D 上下文。');
  ctx.scale(scale, scale);
  if (opts.background) {
    ctx.fillStyle = opts.background;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(img, 0, 0);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('PNG 编码失败：canvas.toBlob 返回 null。'));
    }, 'image/png');
  });
  return blob;
}

export interface ExportPngOptions extends BuildHtmlDocumentOptions {
  /** 栅格宽度（px）。默认 800 —— 与 .markdown-body 的 max-width 一致。 */
  width?: number;
  /** 栅格缩放倍率（透传 svgToPngBlob，默认 2）。 */
  scale?: number;
  /** 高度测量注入点（默认 measureHtmlHeight，浏览器 DOM 测量）。 */
  measureHeight?: MeasureHeight;
  /** canvas 工厂注入点（透传 svgToPngBlob）。 */
  createCanvas?: (width: number, height: number) => HTMLCanvasElement;
  /** Image 工厂注入点（透传 svgToPngBlob）。 */
  makeImage?: () => HTMLImageElement;
}

/**
 * Markdown → PNG Blob。空文档（全空白）→ 确定性 reject '文档为空'（绝不产出损坏 PNG）。
 * 非空 → 同一套主题化 HTML（buildHtmlDocument，图片已内联 data URI）→
 * 测量高度 → SVG → 栅格化 PNG（画布先铺主题 bg，避免透明/黑边）。
 */
export async function exportPngFromMarkdown({
  markdown,
  assets,
  title,
  theme = 'dark',
  width = 800,
  scale,
  measureHeight = measureHtmlHeight,
  createCanvas,
  makeImage,
}: ExportPngOptions): Promise<Blob> {
  if (!markdown.trim()) throw new Error('文档为空，无法导出 PNG。');
  const html = withCornerByline(buildHtmlDocument({ markdown, assets, title, theme }));
  const height = measureHeight(html, width);
  const svg = svgFromHtml(html, { width, height });
  return svgToPngBlob(svg, {
    scale,
    background: getThemeColor(theme, 'bg'),
    createCanvas,
    makeImage,
  });
}
