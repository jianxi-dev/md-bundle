// dataURL ↔ 字节 —— 导出任务（4.1 mdpkg 写入）共用的最小转换层。
// 约定：资产 dataURL 一律 `data:<mime>;base64,<payload>`（charset 前缀如
// `data:image/png;charset=utf-8;base64,` 同样接受）；非 base64 / 畸形输入确定性抛错。
// atob/btoa 在浏览器与 Node ≥16 均为全局 —— 无需 polyfill。

const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;

/**
 * dataURL → 原始字节。解析逗号后的 base64 载荷；`;base64` 标记缺失或
 * 载荷含非法 base64 字符 → 抛错（绝不静默产出损坏字节）。
 */
export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',');
  if (comma === -1) throw new Error('不是有效的 data URL（缺少逗号分隔）。');
  const meta = dataUrl.slice(0, comma);
  const payload = dataUrl.slice(comma + 1);
  if (!meta.includes(';base64')) {
    throw new Error('不是有效的 data URL（仅支持 base64 编码）。');
  }
  if (!BASE64_RE.test(payload)) {
    throw new Error('不是有效的 data URL（base64 载荷含非法字符）。');
  }
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** 原始字节 → dataURL（`data:<mime>;base64,<payload>`）。 */
export function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `data:${mime};base64,${btoa(binary)}`;
}