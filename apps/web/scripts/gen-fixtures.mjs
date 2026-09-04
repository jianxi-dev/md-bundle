// 生成 mdpkg 集成测试夹具（确定性、可重跑）。
// 依赖：仅 Node 内置（zlib 生成真实 PNG + crc32）+ vendored mdpkg-web.js（packMdpkg/openMdpkg）。
// 产出（apps/web/test/fixtures/）：
//   valid.mdpkg           —— document.md + includes/ch1.md + 2 张真实 2x2 PNG，manifest 由 packMdpkg 构建
//   invalid-manifest.mdpkg —— 合法包内容 + manifest.json 注入未知顶层字段 not_schema_field
//                            （违反 schema additionalProperties:false → 校验报 MDPKG-E302）
//   corrupted.zip         —— valid.mdpkg 截断至 40%（EOCD/中央目录缺失）
//   not-mdpkg.bin         —— 512 字节种子伪随机数据（无 ZIP 魔数）
// 运行：node apps/web/scripts/gen-fixtures.mjs
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

// vendored bundle 顶层引用 document（decode-named-character-reference 的 DOM 变体，
// esbuild 按 browser target 打包时选中）。Node 下先注入最小 stub（仅测试/生成脚本用；
// 浏览器端由真实 DOM 提供，行为一致：常见实体可解码）。
if (typeof globalThis.document === 'undefined') {
  const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };
  globalThis.document = {
    createElement: () => {
      let html = '';
      return {
        set innerHTML(v) { html = String(v); },
        get innerHTML() { return html; },
        get textContent() {
          return html.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, name) => {
            if (name[0] === '#') {
              const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
              return Number.isFinite(code) ? String.fromCodePoint(code) : m;
            }
            return ENT[name] ?? m;
          });
        },
      };
    },
  };
}

const { openMdpkg, packMdpkg } = await import('../vendor/mdpkg-web.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, '..', 'test', 'fixtures');
mkdirSync(FIXTURES, { recursive: true });

const enc = new TextEncoder();

// ---------- 真实最小 PNG（2x2、8-bit RGB、filter 0） ----------
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

const pngRed = makePng(2, 2, [220, 38, 38]);
const pngBlue = makePng(2, 2, [37, 99, 235]);

// ---------- 最小 ZIP 写入器（仅 stored 条目，无压缩；供篡改 manifest 的夹具用） ----------
function zipStored(entries) {
  const names = Object.keys(entries).sort();
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const name of names) {
    const data = entries[name];
    const nameBytes = enc.encode(name);
    const crc = zlib.crc32(data) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(0, 8); // method: stored
    local.writeUInt16LE(0, 10); // mod time
    local.writeUInt16LE(0, 12); // mod date
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28); // extra len
    localParts.push(local, nameBytes, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0, 8); // flags
    central.writeUInt16LE(0, 10); // method
    central.writeUInt16LE(0, 12); // time
    central.writeUInt16LE(0, 14); // date
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt16LE(0, 30); // extra len
    central.writeUInt16LE(0, 32); // comment len
    central.writeUInt16LE(0, 34); // disk
    central.writeUInt16LE(0, 36); // internal attrs
    central.writeUInt32LE(0, 38); // external attrs
    central.writeUInt32LE(offset, 42); // local header offset
    centralParts.push(central, nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const cdSize = centralParts.reduce((a, p) => a + p.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4); // disk
  eocd.writeUInt16LE(0, 6); // cd disk
  eocd.writeUInt16LE(names.length, 8);
  eocd.writeUInt16LE(names.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20); // comment len
  return Buffer.concat([...localParts, ...centralParts, eocd]);
}

// ---------- 种子伪随机（mulberry32） ----------
function seededBytes(n, seed) {
  let a = seed >>> 0;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.floor(next() * 256);
  return out;
}

// ---------- 夹具 1：valid.mdpkg ----------
const doc = '# 打包测试 (tm)\n\n![红图](assets/red.png)\n\n![蓝图](assets/blue.png)\n\n<<< includes/ch1.md\n';
const files = new Map([
  ['document.md', enc.encode(doc)],
  ['includes/ch1.md', enc.encode('第一章 (c) --> 结束\n')],
  ['assets/red.png', pngRed],
  ['assets/blue.png', pngBlue],
]);
const validBytes = packMdpkg(files);
writeFileSync(join(FIXTURES, 'valid.mdpkg'), validBytes);

// ---------- 夹具 2：invalid-manifest.mdpkg ----------
// 取合法包的 manifest（sha256/size 与各文件一致），注入未知顶层字段后
// 用最小 ZIP 写入器重打包全部内容文件 —— packMdpkg 会重建 manifest，所以必须绕过它。
// 期望：唯一校验错误为 [MDPKG-E302] / must NOT have additional properties（schema 违反）。
const opened = await openMdpkg(validBytes);
const tampered = { ...opened.manifest, not_schema_field: 1 };
const invalidBytes = zipStored({
  'document.md': enc.encode(doc),
  'includes/ch1.md': enc.encode('第一章 (c) --> 结束\n'),
  'assets/red.png': pngRed,
  'assets/blue.png': pngBlue,
  'manifest.json': enc.encode(JSON.stringify(tampered, null, 2) + '\n'),
});
writeFileSync(join(FIXTURES, 'invalid-manifest.mdpkg'), invalidBytes);

// ---------- 夹具 3：corrupted.zip（截断至 40%） ----------
const cut = Math.floor(validBytes.length * 0.4);
writeFileSync(join(FIXTURES, 'corrupted.zip'), validBytes.subarray(0, cut));

// ---------- 夹具 4：not-mdpkg.bin ----------
writeFileSync(join(FIXTURES, 'not-mdpkg.bin'), seededBytes(512, 0x2a5a));

// ---------- 报告 ----------
const sizes = ['valid.mdpkg', 'invalid-manifest.mdpkg', 'corrupted.zip', 'not-mdpkg.bin'].map(
  (f) => `${f}: ${statSync(join(FIXTURES, f)).size} bytes`,
);
console.log('fixtures written to', FIXTURES);
console.log(sizes.join('\n'));