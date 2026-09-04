// 生成图片导入测试夹具（任务 3.1）：3 张真实 2x2 PNG（red/green/shot）。
// 依赖：仅 Node 内置（zlib 生成真实 PNG + crc32）。
// 产出（apps/web/test/fixtures/imgs/）：red.png / green.png / shot.png
// 运行：node apps/web/scripts/gen-img-fixtures.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([t, data])) >>> 0);
  return Buffer.concat([len, t, data, crc]);
}

function makePng(w, h, [r, g, b]) {
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0; // filter: None
    for (let x = 0; x < w; x++) {
      const o = y * (1 + w * 3) + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.concat([
    (() => { const b = Buffer.alloc(4); b.writeUInt32BE(w); return b; })(),
    (() => { const b = Buffer.alloc(4); b.writeUInt32BE(h); return b; })(),
    Buffer.from([8, 2, 0, 0, 0]), // bit depth 8, color type 2 (RGB)
  ]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'test', 'fixtures', 'imgs');
mkdirSync(OUT, { recursive: true });

writeFileSync(join(OUT, 'red.png'), makePng(2, 2, [220, 38, 38]));
writeFileSync(join(OUT, 'green.png'), makePng(2, 2, [46, 160, 67]));
writeFileSync(join(OUT, 'shot.png'), makePng(2, 2, [37, 99, 235]));
console.log('img fixtures written to', OUT);