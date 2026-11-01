/** 单张图片资产：文件名（含扩展名）+ 原始字节数 + dataURL（缩略图/导出共用）。 */
export interface Asset {
  name: string;
  size: number;
  dataUrl: string;
}

/**
 * 按引用路径解析资产 dataURL（编辑器行内图 widget 与 inlineImages 共用的匹配口径）：
 * - `./` 前缀在匹配前剥离（`./name.png` ≡ `name.png`）
 * - 先精确匹配完整路径（mdpkg 包内条目以包内路径为名，如 `images/name.png`）
 * - 再按引用 basename 匹配资产名（应用内导入资产以文件名去重存储，如 `name.png`；
 *   文档写 `./images/name.png` / `sub/name.png` 也能命中扁平资产 `name.png`）
 * - 绝对 URL（http/https/file）→ null：禁止按 basename 错配本地资产
 *   （inlineImages 在调用前已整段移除外链；此处兜底编辑器 widget 的同类引用）
 * 解析不到 → null（编辑器回退为 `[图片: path]` 文本，预览/导出移除该 `<img>`）。
 */
export function resolveAssetDataUrl(assets: Asset[], path: string): string | null {
  if (/^(?:https?:|file:)/i.test(path)) return null;
  const normalized = path.startsWith('./') ? path.slice(2) : path;
  const exact = assets.find((a) => a.name === normalized);
  if (exact) return exact.dataUrl;
  const base = normalized.split(/[/\\]/).pop() ?? normalized;
  const byBase = assets.find((a) => a.name === base);
  return byBase?.dataUrl ?? null;
}
