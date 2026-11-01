/**
 * `@md-bundle/app-kit/clipboard` — 图片剪贴板公共入口（#511）。
 * 公开契约：永不抛错；成功 true，失败 false（调用方据此走兜底下载）。
 */
import type { ClipboardWriter } from '../contracts';

/**
 * 浏览器默认实现：ClipboardItem + navigator.clipboard.write。
 * 缺 API（node / jsdom / 旧浏览器）或写入被拒 → false。
 */
export const browserClipboardWriter: ClipboardWriter = async (png) => {
  try {
    if (typeof navigator === 'undefined' || typeof ClipboardItem === 'undefined') return false;
    if (!navigator.clipboard?.write) return false;
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
    return true;
  } catch {
    return false;
  }
};

/**
 * 把 PNG 放进剪贴板。Clairis 传 Electron 的 clipboard.writeImage 适配器。
 * 边界处再兜一层 try/catch —— 契约是「永不抛错」，注入实现也不例外。
 */
export async function copyImageToClipboard(
  png: Blob,
  writer: ClipboardWriter = browserClipboardWriter,
): Promise<boolean> {
  try {
    return await writer(png);
  } catch {
    return false;
  }
}
