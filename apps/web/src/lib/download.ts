// 下载助手 —— 所有导出类型（md/mdpkg/html/png + 分享卡片兜底）共用的落盘入口。
// 流程：Blob → object URL → 临时 <a download> 点击 → finally 撤销 URL。
// jsdom 不实现 URL.createObjectURL/revokeObjectURL —— 因此 createObjectUrl 可注入
// （测试塞 spy，无需浏览器）；无 object URL 能力的环境（jsdom/SSR）静默跳过，绝不抛错。

/** 创建 object URL 的可注入实现（默认浏览器 URL.createObjectURL）。 */
export type CreateObjectUrl = (blob: Blob) => string;

/** 下载回调签名 —— exportMd 等导出函数把下载作为依赖注入，便于 jsdom 单测。 */
export type DownloadText = (text: string, filename: string) => void;

/**
 * Blob → object URL → 临时 `<a download>` 点击 → finally 撤销。
 * `createObjectUrl` 缺省时回退 `URL.createObjectURL`；两者都不可用（jsdom/SSR）→ 静默返回。
 */
export function downloadBlob(
  blob: Blob,
  filename: string,
  createObjectUrl?: CreateObjectUrl,
): void {
  const makeUrl: CreateObjectUrl | undefined =
    typeof createObjectUrl === 'function'
      ? createObjectUrl
      : typeof URL.createObjectURL === 'function'
        ? (b: Blob) => URL.createObjectURL(b)
        : undefined;
  if (!makeUrl) return; // 无 object URL 能力：不下载、不抛错
  const url = makeUrl(blob);
  let anchor: HTMLAnchorElement | null = null;
  try {
    anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
  } finally {
    // createElement/click 抛错也要撤销，避免泄漏 object URL。
    if (anchor && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url);
  }
}

/** 文本按 UTF-8 落盘为 .md —— jsdom 路径由 downloadBlob 的守卫兜底（静默跳过）。 */
export function downloadText(text: string, filename: string): void {
  downloadBlob(new Blob([text], { type: 'text/markdown' }), filename);
}
