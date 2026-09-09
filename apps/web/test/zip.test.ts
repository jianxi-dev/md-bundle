// zip.ts 单元测试：最小 ZIP 读取器（EOCD 扫描 + 中央目录 + deflate/stored 解压）。
// 运行于 node 环境（DecompressionStream 为 Node 18+ 全局；jsdom 无此 API）。
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { makeZip } from './helpers/makeZip';
import { extractZipDoc, parseZipIndex, readZipEntry } from '../src/lib/zip';

const text = (b: Uint8Array): string => new TextDecoder().decode(b);

describe('parseZipIndex', () => {
  it('deflate 条目 → 中央目录条目齐全（名称/大小/偏移）', () => {
    const zip = makeZip([
      { name: 'a.txt', content: 'hello world' },
      { name: 'dir/b.md', content: '# B' },
    ]);
    const r = parseZipIndex(zip);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entries.map((e) => e.name)).toEqual(['a.txt', 'dir/b.md']);
    expect(r.entries[0].compressedSize).toBeGreaterThan(0);
    expect(r.entries[0].uncompressedSize).toBe(11);
    expect(r.entries[0].localOffset).toBe(0);
    expect(r.entries[1].localOffset).toBeGreaterThan(r.entries[0].localOffset);
  });

  it('stored 条目 → 同样可索引', () => {
    const zip = makeZip([{ name: 's.txt', content: 'stored', method: 0 }]);
    const r = parseZipIndex(zip);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0].name).toBe('s.txt');
  });

  it('非 ZIP 字节 → 确定性 { ok:false, error }，绝不抛出', () => {
    const junk = new Uint8Array([1, 2, 3, 4, 5]);
    const r = parseZipIndex(junk);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain('ZIP');
  });

  it('截断的 ZIP（无 EOCD）→ 确定性错误', () => {
    const zip = makeZip([{ name: 'a.txt', content: 'x' }]);
    const truncated = zip.slice(0, zip.length - 30);
    const r = parseZipIndex(truncated);
    expect(r.ok).toBe(false);
  });
});

describe('readZipEntry', () => {
  it('deflate 条目 → 解压出原文', async () => {
    const zip = makeZip([{ name: 'doc.md', content: '# 标题\n正文' }]);
    const r = parseZipIndex(zip);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const bytes = await readZipEntry(zip, r.entries[0]);
    expect(bytes).not.toBeNull();
    if (!bytes) return;
    expect(text(bytes)).toBe('# 标题\n正文');
  });

  it('stored 条目 → 原样返回', async () => {
    const zip = makeZip([{ name: 'raw.bin', content: new Uint8Array([0, 1, 2, 255]), method: 0 }]);
    const r = parseZipIndex(zip);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const bytes = await readZipEntry(zip, r.entries[0]);
    expect(bytes).not.toBeNull();
    if (!bytes) return;
    expect(Array.from(bytes)).toEqual([0, 1, 2, 255]);
  });

  it('越界偏移 → 返回 null（不抛出）', async () => {
    const zip = makeZip([{ name: 'a.txt', content: 'x' }]);
    const r = parseZipIndex(zip);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const bad = { ...r.entries[0], localOffset: zip.length + 100 };
    const bytes = await readZipEntry(zip, bad);
    expect(bytes).toBeNull();
  });
});

describe('extractZipDoc', () => {
  it('含 .md 的 zip → 返回首个 .md（目录前缀剥离）', async () => {
    const zip = makeZip([
      { name: 'assets/logo.png', content: 'png' },
      { name: 'notes/readme.md', content: '# 从 zip 打开' },
    ]);
    const doc = await extractZipDoc(zip);
    expect(doc).not.toBeNull();
    if (!doc) return;
    expect(doc.name).toBe('readme.md');
    expect(text(doc.bytes)).toBe('# 从 zip 打开');
  });

  it('含 .mdpkg 的 zip → 返回首个 .mdpkg', async () => {
    const zip = makeZip([{ name: 'pkg.mdpkg', content: 'PK' }]);
    const doc = await extractZipDoc(zip);
    expect(doc).not.toBeNull();
    if (!doc) return;
    expect(doc.name).toBe('pkg.mdpkg');
  });

  it('无 .md/.mdpkg → null', async () => {
    const zip = makeZip([{ name: 'a.txt', content: 'x' }]);
    const doc = await extractZipDoc(zip);
    expect(doc).toBeNull();
  });

  it('非 ZIP → null（不抛出）', async () => {
    const doc = await extractZipDoc(new Uint8Array([9, 9, 9]));
    expect(doc).toBeNull();
  });
});