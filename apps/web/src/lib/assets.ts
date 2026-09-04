// 资源清单 —— 纯逻辑、可单测。图片资产以 dataURL 形式驻留内存，
// 导出任务（3.3/3.4/3.5）与 mdpkg 写入（4.1）都消费这里的形状：
//   types + addAssets + removeAsset + replaceAsset + hasImageAssets + filesToAssets + wireReferences
// 约定：引用一律 `![name](name.png)`（无 ./ 前缀）；文档里已存在的 `./name.png` 变体同样可接线。
/** 单张图片资产：文件名（含扩展名）+ 原始字节数 + dataURL（缩略图/导出共用）。 */
export interface Asset {
  name: string;
  size: number;
  dataUrl: string;
}

/** dataURL 体积上限（约 15MB）—— 超过的图片跳过导入并提示，避免内存爆炸。 */
export const MAX_ASSET_BYTES = 15 * 1024 * 1024;

export interface AddAssetsResult {
  /** 合并后的完整清单（原清单不被修改）。 */
  assets: Asset[];
  /** 实际入库的文件名（去重改名后的最终名）。 */
  additions: string[];
  /** 被跳过（超限）的文件名。 */
  skipped: string[];
}

/** 去重改名：`name.png` 已存在 → `name_1.png`（保留扩展名），再冲突继续 +1。 */
export function uniqueName(name: string, used: ReadonlySet<string>): string {
  if (!used.has(name)) return name;
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let i = 1;
  let candidate = `${base}_${i}${ext}`;
  while (used.has(candidate)) {
    i++;
    candidate = `${base}_${i}${ext}`;
  }
  return candidate;
}

/**
 * 把新资产并入清单：去重改名 + 超限跳过。纯函数 —— 返回新数组，不改入参。
 * 超限检查是防御性的（filesToAssets 已按同一上限过滤），保证任何入口都不越界。
 */
export function addAssets(assets: Asset[], incoming: Asset[]): AddAssetsResult {
  const next = [...assets];
  const additions: string[] = [];
  const skipped: string[] = [];
  const used = new Set(next.map((a) => a.name));
  for (const a of incoming) {
    if (a.size > MAX_ASSET_BYTES) {
      skipped.push(a.name);
      continue;
    }
    const name = uniqueName(a.name, used);
    used.add(name);
    next.push({ name, size: a.size, dataUrl: a.dataUrl });
    additions.push(name);
  }
  return { assets: next, additions, skipped };
}

/** 按文件名删除资产（不存在则原样返回）。 */
export function removeAsset(assets: Asset[], name: string): Asset[] {
  return assets.filter((a) => a.name !== name);
}

/** 同名替换字节：dataUrl/size 更新，name 不变（文档里的引用保持有效）。超限 → 原样返回。 */
export async function replaceAsset(assets: Asset[], name: string, file: File): Promise<Asset[]> {
  if (file.size > MAX_ASSET_BYTES) return assets;
  const dataUrl = await readFileAsDataURL(file);
  return assets.map((a) => (a.name === name ? { name: a.name, size: file.size, dataUrl } : a));
}

/** 是否已有图片资产（导出任务用它决定是否提示「无资源」）。 */
export function hasImageAssets(assets: Asset[]): boolean {
  return assets.length > 0;
}

/** 读取 File 为 dataURL（FileReader；失败 reject）。 */
export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`读取图片失败：${file.name}`));
    reader.readAsDataURL(file);
  });
}

/** 图片引用正则：`![alt](name.png)` 或 `![alt](./name.png)`，扩展名限常见图片格式。 */
const IMAGE_REF = /!\[[^\]]*\]\((?:\.\/)?([^)\s]+\.(?:png|jpg|jpeg|gif|webp))\)/g;

/**
 * 自动接线：扫描 markdown 里的图片引用，凡与导入文件名（basename）匹配的，
 * 记录为 wired —— 该引用现在由导入的资产供图（预览/导出时解析）。
 * markdown 原样返回（接线是记录，不是改写）。
 */
export function wireReferences(
  markdown: string,
  importedNames: string[],
): { markdown: string; wired: string[] } {
  const refs = new Set<string>();
  for (const m of markdown.matchAll(IMAGE_REF)) refs.add(m[1]);
  const wired = importedNames.filter((n) => refs.has(n));
  return { markdown, wired };
}

/** 查找某个文件名的既有引用原文（含 `./` 变体）；无 → null。 */
export function findReference(markdown: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = markdown.match(new RegExp(`!\\[[^\\]]*\\]\\((\\.\\/)?${escaped}\\)`));
  return m ? m[0] : null;
}

/** 从文档中移除对某资源的所有引用（删除资产时同步清理）。 */
export function stripReferences(markdown: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return markdown.replace(new RegExp(`!\\[[^\\]]*\\]\\((\\.\\/)?${escaped}\\)`, 'g'), '');
}