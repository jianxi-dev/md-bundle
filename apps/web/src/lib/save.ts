// 保存路由（任务 4.1）—— 内容驱动的「保存」主按钮逻辑。
// decideSaveKind：有图 → .mdpkg；无图但来源是 .mdpkg → .mdpkg（无缝重打包，
// prevManifest 保留）；否则 → .md。
// saveDocument：按决定的分发到 exportMd（.md）或 exportMdpkg + downloadBlob（.mdpkg）。
// 返回 Promise<SaveKind | null>：null = 用户取消了含图警告（未保存）—— 这是
// 6.3 徽标钩子的成功信号（非 null 即保存成功）。
import { exportMd } from './export';
import { exportMdpkg } from './exportMdpkg';
import { downloadBlob } from './download';
import type { Asset } from './assets';
import type { Manifest } from './mdpkg';

export type SaveKind = 'md' | 'mdpkg';

/** 默认 .mdpkg 下载文件名（调用方传 filename 基础名时被覆盖）。 */
export const DEFAULT_MDPKG_FILENAME = 'document.mdpkg';

export interface DecideSaveKindInput {
  assets: Asset[];
  sourceKind: 'md' | 'mdpkg';
}

/**
 * 内容驱动路由：
 * - assets.length > 0 → 'mdpkg'（.md 无法携带图片，有图必打包）
 * - sourceKind === 'mdpkg' → 'mdpkg'（打开的是包 → 重打包，prevManifest 保留）
 * - 其余 → 'md'
 */
export function decideSaveKind({ assets, sourceKind }: DecideSaveKindInput): SaveKind {
  if (assets.length > 0) return 'mdpkg';
  if (sourceKind === 'mdpkg') return 'mdpkg';
  return 'md';
}

export interface SaveDocumentOptions {
  markdown: string;
  assets: Asset[];
  sourceKind: 'md' | 'mdpkg';
  /** 下载文件名基础名（不含扩展名）；缺省 → document.md / document.mdpkg。 */
  filename?: string;
  /** 重打包时继承的 manifest（entrypoint/extensions/source_url）。 */
  prevManifest?: Manifest;
  /** 重打包时原样保留的额外包内文件（include 目标、附件等）。 */
  extraFiles?: Map<string, Uint8Array>;
  /** 确认函数（透传 exportMd 的含图警告；默认 window.confirm）。 */
  confirm?: (message: string) => boolean;
}

/**
 * 保存当前文档：按 decideSaveKind 分发并执行下载。
 * @returns 实际保存的类型；用户取消含图警告 → null（未保存）。
 */
export async function saveDocument(opts: SaveDocumentOptions): Promise<SaveKind | null> {
  const kind = decideSaveKind({ assets: opts.assets, sourceKind: opts.sourceKind });

  if (kind === 'md') {
    const ok = exportMd(opts.markdown, {
      hasImages: opts.assets.length > 0,
      confirm: opts.confirm,
      filename: opts.filename ? `${opts.filename}.md` : undefined,
    });
    return ok ? 'md' : null;
  }

  const bytes = exportMdpkg({
    markdown: opts.markdown,
    assets: opts.assets,
    prevManifest: opts.prevManifest,
    extraFiles: opts.extraFiles,
  });
  downloadBlob(
    new Blob([new Uint8Array(bytes)], { type: 'application/octet-stream' }),
    opts.filename ? `${opts.filename}.mdpkg` : DEFAULT_MDPKG_FILENAME,
  );
  return 'mdpkg';
}