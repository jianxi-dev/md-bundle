// 测试辅助：用 node:zlib 构造最小 ZIP（deflate 或 stored），供 zip/dropFiles 单元测试与 e2e 使用。
// 与 src/lib/zip.ts 的读取器互为镜像（同一 ZIP 结构约定）。
import { crc32, deflateRawSync } from 'node:zlib';

export interface ZipEntryInput {
  name: string;
  content: string | Uint8Array;
  /** 8 = deflate（默认），0 = stored。 */
  method?: 0 | 8;
}

function u16(v: number): Uint8Array {
  const b = new Uint8Array(2);
  new DataView(b.buffer).setUint16(0, v, true);
  return b;
}

function u32(v: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, v, true);
  return b;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

/** 构造 ZIP 字节（本地头 + 数据 + 中央目录 + EOCD）。 */
export function makeZip(entries: ZipEntryInput[]): Uint8Array {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const e of entries) {
    const nameBytes = new TextEncoder().encode(e.name);
    const raw = typeof e.content === 'string' ? new TextEncoder().encode(e.content) : e.content;
    const method = e.method ?? 8;
    const compressed = method === 8 ? deflateRawSync(raw) : raw;
    const crc = crc32(raw) >>> 0;

    const local = concat([
      u32(0x04034b50),
      u16(20), // version needed
      u16(0), // flags
      u16(method),
      u16(0), // mod time
      u16(0), // mod date
      u32(crc),
      u32(compressed.length),
      u32(raw.length),
      u16(nameBytes.length),
      u16(0), // extra len
      nameBytes,
      compressed,
    ]);
    locals.push(local);

    const central = concat([
      u32(0x02014b50),
      u16(20), // version made by
      u16(20), // version needed
      u16(0), // flags
      u16(method),
      u16(0), // mod time
      u16(0), // mod date
      u32(crc),
      u32(compressed.length),
      u32(raw.length),
      u16(nameBytes.length),
      u16(0), // extra len
      u16(0), // comment len
      u16(0), // disk start
      u16(0), // internal attrs
      u32(0), // external attrs
      u32(offset),
      nameBytes,
    ]);
    centrals.push(central);
    offset += local.length;
  }

  const centralDir = concat(centrals);
  const eocd = concat([
    u32(0x06054b50),
    u16(0), // disk number
    u16(0), // disk with central dir
    u16(entries.length),
    u16(entries.length),
    u32(centralDir.length),
    u32(offset),
    u16(0), // comment len
  ]);

  return concat([...locals, centralDir, eocd]);
}