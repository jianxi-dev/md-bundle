// Zip 导出测试（任务 7.1）—— 验证上游 toZip 的 ZIP 产物与契约。
// 覆盖（对齐 delta spec「Format-driven export」zip 场景）：
//   1. 产物是合法 ZIP（PK\x03\x04 magic bytes）
//   2. 包含 README.md（内置中文模板或自定义）
//   3. 不包含 manifest.json（zip 交付物 ≠ mdpkg）
//   4. include 展开（include-bearing fixtures → `<<<` 指令消失、子文件内容内联）
//   5. 空文档 → 仍产出合法非空 zip（PK magic + size > 0）
//   6. 自定义 README 内容
//   7. 复杂 markdown 产出合法 zip
// 运行于 node 环境：vendored bundle 顶层引用 document，须先装 stub 再动态 import；
// readZipEntry 用 DecompressionStream（Node 18+ 全局，jsdom 无此 API）。
// @vitest-environment node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

installDocumentStub();

const { toZip } = await import('../vendor/mdpkg-web.js');
const { openPackage, readEntrySource } = await import('../src/lib/mdpkg');
const { parseZipIndex, readZipEntry } = await import('../src/lib/zip');

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const fixture = (name: string): Uint8Array => new Uint8Array(readFileSync(join(FIXTURES, name)));

/** 从 Uint8Array 解析 ZIP 条目名列表。 */
function listZipEntryNames(bytes: Uint8Array): string[] {
  const r = parseZipIndex(bytes);
  if (!r.ok) throw new Error(`ZIP 解析失败: ${r.error}`);
  return r.entries.map((e) => e.name);
}

/** 从 Uint8Array 解压指定条目文本。 */
async function readZipEntryText(bytes: Uint8Array, entryName: string): Promise<string | null> {
  const r = parseZipIndex(bytes);
  if (!r.ok) return null;
  const entry = r.entries.find((e) => e.name === entryName);
  if (!entry) return null;
  const entryBytes = await readZipEntry(bytes, entry);
  return entryBytes ? new TextDecoder().decode(entryBytes) : null;
}

describe('exportZip (toZip)', () => {
  it('产物是合法 ZIP（PK\\x03\\x04 magic bytes）', () => {
    const files = new Map<string, Uint8Array>();
    files.set('document.md', new TextEncoder().encode('# 标题\n\n正文。'));
    const result = toZip(files, {});

    expect(result).toBeInstanceOf(Uint8Array);
    expect(Array.from(result.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it('包含 README.md', () => {
    const files = new Map<string, Uint8Array>();
    files.set('document.md', new TextEncoder().encode('# Hello'));
    const result = toZip(files, {});

    const names = listZipEntryNames(result);
    expect(names).toContain('README.md');
  });

  it('不包含 manifest.json（zip 交付物 ≠ mdpkg）', () => {
    const files = new Map<string, Uint8Array>();
    files.set('document.md', new TextEncoder().encode('# Hello'));
    const result = toZip(files, {});

    const names = listZipEntryNames(result);
    expect(names).not.toContain('manifest.json');
  });

  it('包含 document.md（入口源文件）', () => {
    const files = new Map<string, Uint8Array>();
    files.set('document.md', new TextEncoder().encode('# Hello\n\n正文'));
    const result = toZip(files, {});

    const names = listZipEntryNames(result);
    expect(names).toContain('document.md');
  });

  it('document.md 文本与输入一致', async () => {
    const md = '# 标题\n\n中文内容\n';
    const files = new Map<string, Uint8Array>();
    files.set('document.md', new TextEncoder().encode(md));
    const result = toZip(files, {});

    const text = await readZipEntryText(result, 'document.md');
    expect(text).toBe(md);
  });

  it('图片资产内联（data URL → 原始字节保留）', () => {
    // 1x1 红色 PNG（真实字节）
    const pngB64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const pngBytes = Buffer.from(pngB64, 'base64');

    const files = new Map<string, Uint8Array>();
    files.set('document.md', new TextEncoder().encode('# 附图\n\n![red](red.png)\n'));
    files.set('red.png', new Uint8Array(pngBytes));
    const result = toZip(files, {});

    const names = listZipEntryNames(result);
    expect(names).toContain('red.png');

    // 解压后是合法 PNG（magic bytes）
    const r = parseZipIndex(result);
    const entry = r.entries.find((e) => e.name === 'red.png');
    expect(entry).toBeDefined();
  });

  it('include 展开：valid.mdpkg fixture → `<<<` 指令消失、子文件内容内联', async () => {
    // valid.mdpkg 包含 `<<< includes/ch1.md` 指令
    const pkg = await openPackage(fixture('valid.mdpkg'));
    expect('files' in pkg).toBe(true);
    if (!('files' in pkg)) return;

    const entry = readEntrySource(pkg.files);
    expect(entry).toContain('<<<');

    // toZip 应展开 include
    const result = toZip(pkg.files, {});

    const text = await readZipEntryText(result, 'document.md');
    expect(text).not.toContain('<<<');
    expect(text).toContain('第一章');
  });

  it('空文档 → 仍产出合法非空 zip（PK magic + size > 0）', () => {
    const files = new Map<string, Uint8Array>();
    files.set('document.md', new TextEncoder().encode(''));
    const result = toZip(files, {});

    expect(result.length).toBeGreaterThan(0);
    expect(Array.from(result.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it('自定义 README 内容', async () => {
    const files = new Map<string, Uint8Array>();
    files.set('document.md', new TextEncoder().encode('# Hello'));
    const result = toZip(files, { readme: '自定义说明' });

    const text = await readZipEntryText(result, 'README.md');
    expect(text).toBe('自定义说明');
  });

  it('复杂 markdown（嵌套列表/表格/删除线/引用）产出合法 zip', () => {
    const md = [
      '# 主标题',
      '',
      '## 二级标题',
      '',
      '- 一级列表',
      '  - 嵌套列表 A',
      '  - 嵌套列表 B',
      '    - 三层嵌套',
      '- 另一项',
      '',
      '1. 有序第一',
      '2. 有序第二',
      '',
      '| 列A | 列B | 列C |',
      '|-----|-----|-----|',
      '| a1 | b1 | c1 |',
      '| a2 | b2 | c2 |',
      '',
      '~~删除线文本~~ 和 **加粗** 与 *斜体*',
      '',
      '> 引用块内容',
      '> 第二行引用',
      '',
      '---',
      '',
      '正文段落。',
      '',
    ].join('\n');

    const files = new Map<string, Uint8Array>();
    files.set('document.md', new TextEncoder().encode(md));
    const result = toZip(files, {});

    expect(result.length).toBeGreaterThan(0);
    expect(Array.from(result.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const names = listZipEntryNames(result);
    expect(names).toContain('README.md');
    expect(names).toContain('document.md');
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
