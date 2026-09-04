// PNG 尺寸解析 —— 零依赖、纯字节操作。验证 8 字节签名后读 IHDR 宽高（big-endian）。
// 供导出流水线（e2e 断言、UI 预览）在 node / 浏览器侧共用。

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

/**
 * 解析 PNG 宽高：非 PNG（签名不符）或字节不足 → null。
 * IHDR 布局：signature(8) + chunkLen(4) + "IHDR"(4) + width(4) + height(4)，
 * 宽高即 bytes 16..24（big-endian，PNG 规范最大 2^31-1，int32 足够）。
 */
export function parsePngSize(
  bytes: Uint8Array,
): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) return null;
  }
  const readU32 = (off: number) =>
    (bytes[off] << 24) |
    (bytes[off + 1] << 16) |
    (bytes[off + 2] << 8) |
    bytes[off + 3];
  return { width: readU32(16), height: readU32(20) };
}
