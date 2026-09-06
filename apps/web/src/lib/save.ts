// 保存模型（Wave5 任务 24）—— 单一主按钮 + 导出副本。
// 决策 #42：唯一主按钮规则，无歧义：
//   ①页签持 diskHandle → 「保存」= createWritable 写回原文件
//   ②无句柄但有 FSA → 「保存」= showSaveFilePicker 另存为 + 记句柄
//   ③无 FSA → 按钮位显示「下载」（downloadBlob 落盘）
// 「下载副本」只进导出▾（独立菜单路径）。
// 返回 Promise<SaveResult>：IO 边界契约，永不向上抛。
import { exportMd } from './export';
import { exportMdpkg } from './exportMdpkg';
import { downloadBlob } from './download';
import { isFsaAvailable } from './fsa';
import type { Asset } from './assets';
import type { Manifest } from './mdpkg';

export type SaveKind = 'md' | 'mdpkg';

/** 保存途径：写回原文件 / 另存为 / 下载。 */
export type SaveVia = 'handle' | 'save-as' | 'download';

/** 保存结果（IO 边界 {error} 契约，永不抛）。 */
export type SaveResult =
  | { ok: true; kind: SaveKind; via: SaveVia }
  | { ok: false; error: string };

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
  /** 页签既有 diskHandle（FSA 写回用）；有 → 直接写回。 */
  diskHandle?: FileSystemFileHandle;
  /** showSaveFilePicker 的 suggestedName（可选）。 */
  suggestedName?: string;
}

/**
 * 保存当前文档：按决策 #42 三路径分发。
 * - 有 diskHandle → createWritable 写回（via='handle'）
 * - 无句柄 + FSA → showSaveFilePicker 另存为（via='save-as'）
 * - 无 FSA → downloadBlob 下载（via='download'）
 * @returns SaveResult；用户取消另存为 → {ok:false, error:'cancelled'}（静默）。
 */
export async function saveDocument(opts: SaveDocumentOptions): Promise<SaveResult> {
  const kind = decideSaveKind({ assets: opts.assets, sourceKind: opts.sourceKind });
  const filename = opts.filename;

  try {
    // 路径 ①：持句柄 → 写回原文件
    if (opts.diskHandle) {
      const bytes = serializeDocument(kind, opts);
      const writable = await opts.diskHandle.createWritable();
      try {
        await writable.write(bytes);
        await writable.close();
      } catch (e) {
        await writable.abort().catch(() => undefined);
        throw e;
      }
      return { ok: true, kind, via: 'handle' };
    }

    // 路径 ②：FSA 可用 → 另存为
    if (isFsaAvailable()) {
      const pickerName = filename
        ? `${filename}.${kind}`
        : kind === 'mdpkg'
          ? DEFAULT_MDPKG_FILENAME
          : 'document.md';
      let handle: FileSystemFileHandle;
      try {
        handle = await window.showSaveFilePicker({
          suggestedName: opts.suggestedName ?? pickerName,
          types: [
            {
              description: kind === 'mdpkg' ? 'Markdown Package' : 'Markdown',
              accept: {
                'application/octet-stream': kind === 'mdpkg' ? ['.mdpkg'] : ['.md'],
              },
            },
          ],
        });
      } catch {
        // AbortError = 用户取消 → 静默
        return { ok: false, error: 'cancelled' };
      }
      const bytes = serializeDocument(kind, opts);
      const writable = await handle.createWritable();
      try {
        await writable.write(bytes);
        await writable.close();
      } catch (e) {
        await writable.abort().catch(() => undefined);
        throw e;
      }
      return { ok: true, kind, via: 'save-as' };
    }

    // 路径 ③：无 FSA → 下载
    if (kind === 'md') {
      exportMd(opts.markdown, {
        hasImages: opts.assets.length > 0,
        confirm: opts.confirm,
        filename: filename ? `${filename}.md` : undefined,
      });
    } else {
      const bytes = exportMdpkg({
        markdown: opts.markdown,
        assets: opts.assets,
        prevManifest: opts.prevManifest,
        extraFiles: opts.extraFiles,
      });
      downloadBlob(
        new Blob([new Uint8Array(bytes)], { type: 'application/octet-stream' }),
        filename ? `${filename}.mdpkg` : DEFAULT_MDPKG_FILENAME,
      );
    }
    return { ok: true, kind, via: 'download' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

/** 序列化文档为字节（md → UTF-8 text，mdpkg → ZIP）。返回 BufferSource 供 createWritable.write。 */
function serializeDocument(kind: SaveKind, opts: SaveDocumentOptions): BufferSource {
  if (kind === 'md') {
    const encoded = new TextEncoder().encode(opts.markdown);
    return encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength) as ArrayBuffer;
  }
  const bytes = exportMdpkg({
    markdown: opts.markdown,
    assets: opts.assets,
    prevManifest: opts.prevManifest,
    extraFiles: opts.extraFiles,
  });
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}