// .mdpkg 导出 —— 复用上游 packMdpkg 的薄封装（任务 4.1）。
// 职责：把「当前源码 + 当前资产清单」组装成 files Map（document.md + 每资产原始字节），
// 交给 vendored packMdpkg 打包。ZIP 写入 / manifest 重建 / sha256 / 固定 mtime 全部由
// 上游负责（CLI 字节级一致）—— 本模块零 zip/hash 逻辑。
// prevManifest 透传：打开 .mdpkg 后重打包时携带原 manifest（entrypoint/extensions/
// source_url 继承），实现「无缝重打包」。
import { packMdpkg } from '../../vendor/mdpkg-web.js';
import type { Manifest } from './mdpkg';
import type { Asset } from './assets';
import { dataUrlToBytes } from './dataUrl';

export interface ExportMdpkgOptions {
  markdown: string;
  assets: Asset[];
  prevManifest?: Manifest;
  /** 额外包内文件（include 目标、附件等）—— 重打包时原样保留，保证无缝。 */
  extraFiles?: Map<string, Uint8Array>;
}

/** 打包入口文件名（与上游 DEFAULT_ENTRYPOINT 一致）。 */
export const ENTRY_FILENAME = 'document.md';

/**
 * 组装 files Map 并调用上游 packMdpkg：
 * - `document.md` = markdown 的 UTF-8 字节
 * - 每个资产：name → dataUrl 解码后的原始字节
 * - extraFiles：原样并入（重打包保留 include/附件）
 * - prevManifest 存在 → 透传（entrypoint/extensions/source_url 继承）
 * @returns 完整 .mdpkg 字节流（ZIP，PK\x03\x04 开头）。
 */
export function exportMdpkg({
  markdown,
  assets,
  prevManifest,
  extraFiles,
}: ExportMdpkgOptions): Uint8Array {
  const files = new Map<string, Uint8Array>();
  files.set(ENTRY_FILENAME, new TextEncoder().encode(markdown));
  for (const asset of assets) {
    files.set(asset.name, dataUrlToBytes(asset.dataUrl));
  }
  if (extraFiles) {
    for (const [name, bytes] of extraFiles) files.set(name, bytes);
  }
  return packMdpkg(files, prevManifest);
}