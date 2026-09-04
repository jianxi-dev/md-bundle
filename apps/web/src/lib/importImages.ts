// 图片提取 —— 三个通道（粘贴 / 拖拽 / 批量选择）统一收敛为 File[] → Asset[]。
// 只做「提取」，不做「入库」：去重改名 / 超限跳过 / 接线由 lib/assets 负责。
import { MAX_ASSET_BYTES, readFileAsDataURL, type Asset } from './assets';

/**
 * 从剪贴板提取图片文件：只取 image/* 的 file 项；文本/其它粘贴 → 空数组
 * （调用方据此放行默认行为，编辑器内容不受影响）。
 */
export async function imagesFromClipboard(
  items: DataTransferItemList | readonly DataTransferItem[] | null | undefined,
): Promise<File[]> {
  if (!items) return [];
  const files: File[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const f = item.getAsFile();
      if (f) files.push(f);
    }
  }
  return files;
}

/**
 * 从拖拽 DataTransfer 提取图片文件：目录项跳过，只取 image/* 的 file 项。
 */
export async function imagesFromDataTransfer(dt: DataTransfer | null | undefined): Promise<File[]> {
  if (!dt) return [];
  const files: File[] = [];
  for (let i = 0; i < dt.items.length; i++) {
    const item = dt.items[i];
    if (item.kind === 'directory') continue;
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const f = item.getAsFile();
      if (f) files.push(f);
    }
  }
  return files;
}

/**
 * File[] → Asset[]：FileReader 读 dataURL；超过 15MB 上限的跳过（不读，省内存），
 * 名字进 skipped 由调用方提示。
 */
export async function filesToAssets(
  files: File[],
): Promise<{ assets: Asset[]; skipped: string[] }> {
  const assets: Asset[] = [];
  const skipped: string[] = [];
  for (const file of files) {
    if (file.size > MAX_ASSET_BYTES) {
      skipped.push(file.name);
      continue;
    }
    const dataUrl = await readFileAsDataURL(file);
    assets.push({ name: file.name, size: file.size, dataUrl });
  }
  return { assets, skipped };
}