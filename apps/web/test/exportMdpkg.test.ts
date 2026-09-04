// .mdpkg 导出单测（任务 4.1）：exportMdpkg 复用上游 packMdpkg 的字节级验证。
// 覆盖：
//   - markdown + 2 资产 → 字节 → openPackage 往返：文件齐全、校验通过、内容/字节一致
//   - manifest 条目：sha256 与 node crypto 重算一致（hex）、media_type 与扩展名一致
//   - prevManifest 透传：打开 valid.mdpkg → 重打包 → entrypoint/spec_version 继承
//   - 无 prevManifest → entrypoint 默认 document.md
//   - dataUrlToBytes：charset 前缀接受、畸形输入确定性抛错
// 运行于 node 环境：vendored bundle 顶层引用 document，必须先装 stub 再动态 import。
// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Asset } from '../src/lib/assets';

installDocumentStub();

const { exportMdpkg } = await import('../src/lib/exportMdpkg');
const { openPackage, readEntrySource } = await import('../src/lib/mdpkg');
const { dataUrlToBytes, bytesToDataUrl } = await import('../src/lib/dataUrl');

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const fixture = (name: string): Uint8Array => new Uint8Array(readFileSync(join(FIXTURES, name)));

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

/** 1x1 红色 PNG（真实字节，与 exportPng.test 同源）。 */
const PNG_1_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
/** 1x1 蓝色 PNG。 */
const PNG_2_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const asset = (name: string, b64: string): Asset => ({
  name,
  size: Buffer.from(b64, 'base64').length,
  dataUrl: `data:image/png;base64,${b64}`,
});

const MARKDOWN = '# 打包测试\n\n![红图](assets/red.png)\n\n正文内容。\n';

describe('exportMdpkg（复用上游 packMdpkg）', () => {
  it('markdown + 2 资产 → ZIP 字节 → openPackage 往返：文件齐全、校验通过、内容一致', async () => {
    const bytes = exportMdpkg({
      markdown: MARKDOWN,
      assets: [asset('assets/red.png', PNG_1_B64), asset('assets/blue.png', PNG_2_B64)],
    });

    // ZIP 魔数（上游 pack 产物）。
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);

    const r = await openPackage(bytes);
    expect('files' in r).toBe(true);
    if (!('files' in r)) return;
    expect(r.validation.ok).toBe(true);
    expect(r.validation.errors).toEqual([]);

    const keys = [...r.files.keys()].sort();
    expect(keys).toEqual(['assets/blue.png', 'assets/red.png', 'document.md', 'manifest.json']);

    // document.md 内容一致（UTF-8 往返无损）。
    expect(readEntrySource(r.files)).toBe(MARKDOWN);
    // 资产字节一致（dataUrl → 原始字节 → 解包字节）。
    expect(Buffer.from(r.files.get('assets/red.png')!)).toEqual(Buffer.from(PNG_1_B64, 'base64'));
    expect(Buffer.from(r.files.get('assets/blue.png')!)).toEqual(Buffer.from(PNG_2_B64, 'base64'));
  });

  it('manifest 条目：sha256 与 node crypto 重算一致（hex）、media_type/size 与扩展名一致', async () => {
    const bytes = exportMdpkg({
      markdown: MARKDOWN,
      assets: [asset('assets/red.png', PNG_1_B64)],
    });
    const r = await openPackage(bytes);
    expect('files' in r).toBe(true);
    if (!('files' in r)) return;
    const manifest = r.manifest!;
    expect(manifest.format).toBe('mdpkg');

    const red = manifest.resources.find((x) => x.path === 'assets/red.png')!;
    expect(red).toBeDefined();
    expect(red.media_type).toBe('image/png');
    expect(red.size).toBe(Buffer.from(PNG_1_B64, 'base64').length);
    expect(red.sha256).toBe(
      createHash('sha256').update(Buffer.from(PNG_1_B64, 'base64')).digest('hex'),
    );

    const doc = manifest.resources.find((x) => x.path === 'document.md')!;
    expect(doc.media_type).toBe('text/markdown');
    expect(doc.sha256).toBe(createHash('sha256').update(MARKDOWN).digest('hex'));
  });

  it('prevManifest 透传：打开 valid.mdpkg → 重打包 → entrypoint/spec_version 继承、校验通过', async () => {
    const r = await openPackage(fixture('valid.mdpkg'));
    expect('files' in r).toBe(true);
    if (!('files' in r)) return;
    expect(r.manifest?.entrypoint).toBe('document.md');

    // 从包内重建资产清单（图片条目 → Asset，与 App 的自动导入同构）。
    const imagePaths = [...r.files.keys()].filter((p) => /\.(png|jpe?g|gif|webp)$/i.test(p));
    const assets: Asset[] = imagePaths.map((path) => {
      const fileBytes = r.files.get(path)!;
      const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
      return {
        name: path,
        size: fileBytes.length,
        dataUrl: bytesToDataUrl(fileBytes, MIME[ext] ?? 'image/png'),
      };
    });

    // 包内非入口、非图片文件（includes/ch1.md）原样保留 —— 无缝重打包。
    const extraFiles = new Map(
      [...r.files].filter(
        ([name]) =>
          name !== 'manifest.json' &&
          name !== (r.manifest?.entrypoint ?? 'document.md') &&
          !/\.(png|jpe?g|gif|webp)$/i.test(name),
      ),
    );

    const repacked = exportMdpkg({
      markdown: readEntrySource(r.files),
      assets,
      prevManifest: r.manifest ?? undefined,
      extraFiles,
    });
    const r2 = await openPackage(repacked);
    expect('files' in r2).toBe(true);
    if (!('files' in r2)) return;
    expect(r2.validation.ok).toBe(true);
    expect(r2.manifest?.entrypoint).toBe('document.md');
    expect(r2.manifest?.spec_version).toBe(r.manifest?.spec_version);
    expect(r2.files.has('includes/ch1.md')).toBe(true);
  });

  it('无 prevManifest → entrypoint 默认 document.md', async () => {
    const bytes = exportMdpkg({ markdown: '# x', assets: [] });
    const r = await openPackage(bytes);
    expect('files' in r).toBe(true);
    if (!('files' in r)) return;
    expect(r.manifest?.entrypoint).toBe('document.md');
    expect(r.validation.ok).toBe(true);
  });
});

describe('dataUrlToBytes / bytesToDataUrl', () => {
  it('charset 前缀 data URL 同样解码（data:image/png;charset=utf-8;base64,）', () => {
    const bytes = dataUrlToBytes(`data:image/png;charset=utf-8;base64,${PNG_1_B64}`);
    expect(Buffer.from(bytes)).toEqual(Buffer.from(PNG_1_B64, 'base64'));
  });

  it('bytesToDataUrl → dataUrlToBytes 往返一致', () => {
    const original = Buffer.from(PNG_1_B64, 'base64');
    const url = bytesToDataUrl(new Uint8Array(original), 'image/png');
    expect(url).toBe(`data:image/png;base64,${PNG_1_B64}`);
    expect(Buffer.from(dataUrlToBytes(url))).toEqual(original);
  });

  it('畸形输入确定性抛错（无逗号 / 非 base64 / 非法字符）', () => {
    expect(() => dataUrlToBytes('not-a-data-url')).toThrow('缺少逗号');
    expect(() => dataUrlToBytes('data:image/png,raw')).toThrow('仅支持 base64');
    expect(() => dataUrlToBytes('data:image/png;base64,!!!')).toThrow('非法字符');
  });
});

/** 最小 document stub：仅满足 bundle 顶层 decodeNamedCharacterReference 的 createElement 调用 */
function installDocumentStub(): void {
  if (typeof globalThis.document !== 'undefined') return;
  const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };
  globalThis.document = {
    createElement: () => {
      let html = '';
      return {
        set innerHTML(v: string) {
          html = String(v);
        },
        get innerHTML() {
          return html;
        },
        get textContent() {
          return html.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, name: string) => {
            if (name[0] === '#') {
              const code =
                name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
              return Number.isFinite(code) ? String.fromCodePoint(code) : m;
            }
            return ENT[name] ?? m;
          });
        },
      };
    },
  } as unknown as Document;
}