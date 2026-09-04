// .md 导出 —— 纯逻辑 + 依赖注入（confirm/download 均可替换），jsdom 可整函数单测。
// 消费方（保存/导出栏 4.1）调用：exportMd(text, { hasImages: hasImageAssets(assets) })。
// 行为：文档含图片 → 先弹「丢图警告」，确认才下载；取消 → 不下载、返回 false。

import { downloadText, type DownloadText } from './download';

/** 含图导出的确认文案（UI 直接 window.confirm 展示；测试断言原文）。 */
export const WARNING_EXPORT_MD = '导出 .md 将丢失图片（.md 无法携带图片）。确定继续？';

/** 默认下载文件名（4.1 保存路由可按文档名覆盖）。 */
export const DEFAULT_MD_FILENAME = 'document.md';

export interface ExportMdOptions {
  /** 文档是否含图片资产（由 assets.ts 的 hasImageAssets 判定）。 */
  hasImages: boolean;
  /** 确认函数，默认 window.confirm —— 仅在 hasImages 时被调用。 */
  confirm?: (message: string) => boolean;
  /** 下载实现，默认 downloadText —— 测试注入 spy 断言字节与文件名。 */
  download?: DownloadText;
  /** 下载文件名，默认 'document.md'。 */
  filename?: string;
}

/**
 * 导出 markdown 源文本为 .md。
 * @returns true = 已下载（或 hasImages=false 直接下载）；false = 用户取消了含图警告。
 */
export function exportMd(text: string, opts: ExportMdOptions): boolean {
  if (opts.hasImages) {
    const ask = opts.confirm ?? ((message: string) => window.confirm(message));
    if (!ask(WARNING_EXPORT_MD)) return false; // 取消 → 不下载
  }
  const download = opts.download ?? downloadText;
  download(text, opts.filename ?? DEFAULT_MD_FILENAME);
  return true;
}
