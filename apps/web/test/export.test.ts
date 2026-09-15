// .md 导出测试（任务 7.1）—— 验证新导出行为（App.tsx case 'md'）：
//   1. toMarkdown 产出单 UTF-8 文本文件（非 ZIP 字节）
//   2. include 展开（include-bearing fixtures → `<<<` 指令消失、子文件内容内联）
//   3. 图片丢失警告仍然触发且取消后不下载（exportMd 薄封装，save.ts 仍在用）
// 运行于 node 环境：vendored bundle 顶层引用 document，须先装 stub 再动态 import。
// @vitest-environment node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

installDocumentStub();

const { toMarkdown } = await import('../vendor/mdpkg-web.js');
const { openPackage, readEntrySource } = await import('../src/lib/mdpkg');
const { parseZipIndex } = await import('../src/lib/zip');
const { exportMd, WARNING_EXPORT_MD, DEFAULT_MD_FILENAME } = await import('../src/lib/export');

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const fixture = (name: string): Uint8Array => new Uint8Array(readFileSync(join(FIXTURES, name)));

const SAMPLE = '## 标题\n\n中文👍内容\n';

describe('toMarkdown（新 md 导出）', () => {
  it('产出单 UTF-8 文本文件（非 ZIP）', () => {
    const files = new Map<string, Uint8Array>();
    files.set('document.md', new TextEncoder().encode(SAMPLE));
    const result = toMarkdown(files, { include: true });

    expect(typeof result).toBe('string');
    expect(result).toBe(SAMPLE);
    // 不是 ZIP magic bytes
    const bytes = new TextEncoder().encode(result);
    expect(Array.from(bytes.slice(0, 4))).not.toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it('空文档 → 空字符串', () => {
    const files = new Map<string, Uint8Array>();
    files.set('document.md', new TextEncoder().encode(''));
    const result = toMarkdown(files, { include: true });
    expect(result).toBe('');
  });

  it('中文/emoji/换行字节级一致', () => {
    const md = '# 标题\n\n正文段落\n\n- 列表项\n';
    const files = new Map<string, Uint8Array>();
    files.set('document.md', new TextEncoder().encode(md));
    const result = toMarkdown(files, { include: true });
    expect(result).toBe(md);
    // UTF-8 编码后逐字节相同
    const enc = new TextEncoder();
    expect([...enc.encode(result)]).toEqual([...enc.encode(md)]);
  });

  it('include 展开：valid.mdpkg fixture → `<<<` 指令消失、子文件内容内联', async () => {
    const pkg = await openPackage(fixture('valid.mdpkg'));
    expect('files' in pkg).toBe(true);
    if (!('files' in pkg)) return;

    // 原文含 include 指令
    const entry = readEntrySource(pkg.files);
    expect(entry).toContain('<<<');

    // toMarkdown 展开 include
    const result = toMarkdown(pkg.files, { include: true });
    expect(typeof result).toBe('string');
    expect(result).toContain('第一章');
  });

  it('include=false 时保留 `<<<` 指令原文', async () => {
    const pkg = await openPackage(fixture('valid.mdpkg'));
    expect('files' in pkg).toBe(true);
    if (!('files' in pkg)) return;

    const result = toMarkdown(pkg.files, { include: false });
    expect(result).toContain('<<<');
  });

  it('ZIP 字节验证：toMarkdown 结果不是 ZIP', () => {
    const files = new Map<string, Uint8Array>();
    files.set('document.md', new TextEncoder().encode('# Hello'));
    const result = toMarkdown(files, { include: true });
    const bytes = new TextEncoder().encode(result);
    const r = parseZipIndex(bytes);
    expect(r.ok).toBe(false);
  });
});

describe('exportMd（图片丢失警告，save.ts 仍在用）', () => {
  /** 捕获 (text, filename) 的下载 spy。 */
  function captureDownload() {
    const calls: { text: string; filename: string }[] = [];
    const download = vi.fn((text: string, filename: string) => {
      calls.push({ text, filename });
    });
    return { calls, download };
  }

  it('含图 + 取消 → 警告原文确认、不下载、返回 false', () => {
    const confirm = vi.fn(() => false);
    const { calls, download } = captureDownload();
    const ok = exportMd(SAMPLE, { hasImages: true, confirm, download });
    expect(ok).toBe(false);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalledWith(WARNING_EXPORT_MD);
    expect(calls).toHaveLength(0);
  });

  it('含图 + 确认 → 下载同一文本、返回 true', () => {
    const confirm = vi.fn(() => true);
    const { calls, download } = captureDownload();
    const ok = exportMd(SAMPLE, { hasImages: true, confirm, download });
    expect(ok).toBe(true);
    expect(confirm).toHaveBeenCalledWith(WARNING_EXPORT_MD);
    expect(calls).toHaveLength(1);
    expect(calls[0].text).toBe(SAMPLE);
    expect(calls[0].filename).toBe(DEFAULT_MD_FILENAME);
  });

  it('无图：直接下载，不询问确认', () => {
    const confirm = vi.fn(() => true);
    const { calls, download } = captureDownload();
    const ok = exportMd(SAMPLE, { hasImages: false, confirm, download });
    expect(ok).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
    expect(calls[0].text).toBe(SAMPLE);
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
