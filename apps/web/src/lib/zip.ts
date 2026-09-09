// 最小 ZIP 读取器（Bug 2/3：拖入 .zip 解压找文档）。
// 只实现本产品需要的子集：标准 ZIP（无 zip64、无加密、无数据描述符依赖）。
// 解压用原生 DecompressionStream('deflate-raw')，零新依赖。
// 契约：所有公开函数返回确定性结果，绝不抛出。
//
// 结构速查（little-endian）：
// - EOCD：PK\x05\x06，22 字节定长 + 注释（最长 65535），从尾部倒扫定位。
// - 中央目录条目：PK\x01\x02，46 字节头 + 文件名/扩展/注释。
// - 本地文件头：PK\x03\x04，30 字节头 + 文件名/扩展，数据紧随其后。

const EOCD_SIG = 0x06054b50;
const CENTRAL_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;
const MAX_COMMENT_LEN = 0xffff;

/** 中央目录条目（仅保留读取数据所需字段）。 */
export interface ZipEntry {
  name: string;
  /** 0 = stored，8 = deflate。 */
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  /** 本地文件头起始偏移（数据区 = 本地头 + 30 + 文件名长 + 扩展长）。 */
  localOffset: number;
}

export type ZipIndexResult =
  | { ok: true; entries: ZipEntry[] }
  | { ok: false; error: string };

function u16(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

function u32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

/** 从尾部倒扫 EOCD（注释最长 64KB，回扫上限 22 + 65535 字节）。 */
function findEocd(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const min = Math.max(0, bytes.length - 22 - MAX_COMMENT_LEN);
  for (let i = bytes.length - 22; i >= min; i--) {
    if (u32(view, i) === EOCD_SIG) return i;
  }
  return -1;
}

/**
 * 解析 ZIP 中央目录 → 条目列表。
 * 失败（非 ZIP / 截断 / zip64 / 损坏）→ { ok:false, error }，绝不抛出。
 */
export function parseZipIndex(bytes: Uint8Array): ZipIndexResult {
  if (bytes.length < 22) return { ok: false, error: '文件过小，不是有效的 ZIP' };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEocd(bytes);
  if (eocd < 0) return { ok: false, error: '未找到 ZIP 中央目录（EOCD）' };

  const totalEntries = u16(view, eocd + 10);
  const centralSize = u32(view, eocd + 12);
  const centralOffset = u32(view, eocd + 16);
  if (totalEntries === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
    return { ok: false, error: '暂不支持 ZIP64 压缩包' };
  }
  // Bug 2 修复：SFX 自解压头或拼接数据会让中央目录与本地头整体后移。
  // prefixLen = 中央目录实际起点到文件头的距离；<0 说明目录越界（文件被截断）。
  const prefixLen = eocd - centralSize - centralOffset;
  if (prefixLen < 0) {
    return { ok: false, error: 'ZIP 中央目录越界（文件可能被截断）' };
  }

  const entries: ZipEntry[] = [];
  let pos = prefixLen + centralOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (pos + 46 > bytes.length || u32(view, pos) !== CENTRAL_SIG) {
      return { ok: false, error: 'ZIP 中央目录条目损坏' };
    }
    const flags = u16(view, pos + 8);
    const method = u16(view, pos + 10);
    if ((flags & 0x1) !== 0 || method === 99) {
      return { ok: false, error: '暂不支持加密的 ZIP 压缩包' };
    }
    const compressedSize = u32(view, pos + 20);
    const uncompressedSize = u32(view, pos + 24);
    const nameLen = u16(view, pos + 28);
    const extraLen = u16(view, pos + 30);
    const commentLen = u16(view, pos + 32);
    const localOffset = u32(view, pos + 42) + prefixLen;
    const name = new TextDecoder().decode(bytes.subarray(pos + 46, pos + 46 + nameLen));
    entries.push({ name, method, compressedSize, uncompressedSize, localOffset });
    pos += 46 + nameLen + extraLen + commentLen;
  }
  return { ok: true, entries };
}

/** deflate 原始流解压（原生 DecompressionStream，零依赖）。 */
async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('DecompressionStream 不可用');
  }
  const stream = new Blob([data.slice()]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * 读取并解压单个条目。
 * 失败（加密 / 未知压缩法 / 解压失败 / 越界）→ null，绝不抛出。
 */
export async function readZipEntry(bytes: Uint8Array, entry: ZipEntry): Promise<Uint8Array | null> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (entry.localOffset + 30 > bytes.length || u32(view, entry.localOffset) !== LOCAL_SIG) {
    return null;
  }
  const nameLen = u16(view, entry.localOffset + 26);
  const extraLen = u16(view, entry.localOffset + 28);
  const dataStart = entry.localOffset + 30 + nameLen + extraLen;
  if (dataStart + entry.compressedSize > bytes.length) return null;
  const compressed = bytes.subarray(dataStart, dataStart + entry.compressedSize);
  if (entry.method === 0) return compressed.slice();
  if (entry.method === 8) {
    try {
      return await inflateRaw(compressed);
    } catch {
      return null;
    }
  }
  return null;
}

/** 压缩包内找到的文档。 */
export interface ZipDoc {
  name: string;
  bytes: Uint8Array;
}

/** 在压缩包内找第一个 .md/.mdpkg 条目并解压；找不到 → null。 */
export async function extractZipDoc(bytes: Uint8Array): Promise<ZipDoc | null> {
  const index = parseZipIndex(bytes);
  if (!index.ok) return null;
  const entry = index.entries.find(
    (e) => !e.name.endsWith('/') && /\.(md|mdpkg)$/i.test(e.name),
  );
  if (!entry) return null;
  const data = await readZipEntry(bytes, entry);
  if (!data) return null;
  const name = entry.name.split('/').pop() ?? entry.name;
  return { name, bytes: data };
}