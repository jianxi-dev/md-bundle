// Made-with byline —— 单一事实来源（任务 6.1）。
// HTML 页脚（exportHtml）/ PNG 右下角徽标（exportPng）/ 分享卡（6.2 将复用）
// 共用同一文案与品牌链接；`.mdpkg` 文件本体绝不注入 byline（洁净性由
// test/byline.test.ts 断言：打包往返后源码字节一致、包内无 byline 痕迹）。
// 品牌链接是导出 HTML 中唯一允许出现的绝对 URL（3.4 测试守卫）。

/** byline 文案（品牌链接的可见文本）。 */
export const BYLINE_TEXT = 'Made with MD-Bundle';

/** 品牌链接基址（唯一绝对 URL）。 */
export const BYLINE_BASE_URL = 'https://bundle.jianxi.me';

/** 按渠道生成带 ref 的品牌链接：`https://bundle.jianxi.me/?ref=<ref>`。 */
export function bylineHref(ref: string): string {
  return `${BYLINE_BASE_URL}/?ref=${ref}`;
}

/**
 * HTML 页脚 byline（默认 ref=md-html）—— 与 3.4 的页脚标记逐字节一致：
 * `<footer><a href="https://bundle.jianxi.me/?ref=md-html">Made with MD-Bundle</a></footer>`。
 * 样式（footer 居中/间距/颜色）留在 exportHtml 的 overrides 里，这里只负责标记。
 */
export function bylineFooterHtml(ref = 'md-html'): string {
  return `<footer><a href="${bylineHref(ref)}">${BYLINE_TEXT}</a></footer>`;
}

/**
 * PNG 长图右下角徽标（默认 ref=md-png）—— 半透明胶囊、12px 字体、绝对定位
 * （`position:absolute; right:16px; bottom:12px`），锚定到 `position:relative`
 * 的 body（exportPng 的 withCornerByline 负责加锚点）。品牌蓝 #165DFF 半透明
 * 在暗/亮主题上都可读；无 void 元素 → 直接通过 toWellFormedXhtml 的 XML 校验。
 */
export function bylineCornerBadgeHtml(ref = 'md-png'): string {
  return (
    '<div style="position:absolute;right:16px;bottom:12px;padding:4px 10px;' +
    'border-radius:999px;background:rgba(22,93,255,0.12);' +
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;" +
    'font-size:12px;line-height:1.4;">' +
    `<a href="${bylineHref(ref)}" style="color:rgba(22,93,255,0.85);text-decoration:none;">${BYLINE_TEXT}</a>` +
    '</div>'
  );
}