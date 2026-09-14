// DOCX 导出测试（任务 4.1 + 4.2）—— 验证上游 toDocx 薄封装的字节级产物与契约。
// 覆盖（对齐 delta spec「Format-driven export」docx 场景）：
//   1. 产物是合法 ZIP（PK\x03\x04 magic）
//   2. OOXML 部件存在（[Content_Types].xml + word/document.xml）
//   3. 图片嵌入（有图 → word/media/ 条目；无图 → 无 media）
//   4. 空文档 → 仍产出合法非空 docx
//   5. frontmatter 剥离（document.xml 文本不含 frontmatter 残留）
//   6. 文件名默认 document.docx + filename 覆盖
//   7. 确定性结果契约（成功 { ok:true }；异常路径 { ok:false, error } 且不抛出）
// 运行于 node 环境：vendored bundle 顶层引用 document，须先装 stub 再动态 import；
// readZipEntry 用 DecompressionStream（Node 18+ 全局，jsdom 无此 API）。
// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { Asset } from '../src/lib/assets';

installDocumentStub();

const { exportDocx, DEFAULT_DOCX_FILENAME } = await import('../src/lib/exportDocx');
const { parseZipIndex, readZipEntry } = await import('../src/lib/zip');

/** 1x1 红色 PNG（真实字节，与 exportMdpkg.test 同源）。 */
const PNG_1_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const asset = (name: string, b64: string): Asset => ({
  name,
  size: Buffer.from(b64, 'base64').length,
  dataUrl: `data:image/png;base64,${b64}`,
});

/** 捕获 download 注入的 blob 与 filename。 */
function captureDownload() {
  const calls: { blob: Blob; filename: string }[] = [];
  const download = vi.fn((blob: Blob, filename: string) => {
    calls.push({ blob, filename });
  });
  return { calls, download };
}

/** 从 blob 字节解析 ZIP 条目名列表（复用项目既有 parseZipIndex）。 */
async function listZipEntryNames(blob: Blob): Promise<string[]> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  const r = parseZipIndex(buf);
  if (!r.ok) throw new Error(`ZIP 解析失败: ${r.error}`);
  return r.entries.map((e) => e.name);
}

/** 从 blob 字节解压指定条目文本（deflate/stored 自动处理）。 */
async function readZipEntryText(blob: Blob, entryName: string): Promise<string | null> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  const r = parseZipIndex(buf);
  if (!r.ok) return null;
  const entry = r.entries.find((e) => e.name === entryName);
  if (!entry) return null;
  const bytes = await readZipEntry(buf, entry);
  return bytes ? new TextDecoder().decode(bytes) : null;
}

describe('exportDocx', () => {
  it('产物是合法 ZIP（PK\\x03\\x04 magic）', async () => {
    const { calls, download } = captureDownload();
    await exportDocx({ markdown: '# 标题\n\n正文。', download });

    expect(calls).toHaveLength(1);
    const buf = new Uint8Array(await calls[0].blob.arrayBuffer());
    expect(Array.from(buf.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it('OOXML 部件存在：[Content_Types].xml + word/document.xml', async () => {
    const { calls, download } = captureDownload();
    await exportDocx({ markdown: '# Hello', download });

    const names = await listZipEntryNames(calls[0].blob);
    expect(names).toContain('[Content_Types].xml');
    expect(names).toContain('word/document.xml');
  });

  it('图片嵌入：有图 → word/media/ 条目存在', async () => {
    const { calls, download } = captureDownload();
    await exportDocx({
      markdown: '# 附图\n\n![red](red.png)\n',
      assets: [asset('red.png', PNG_1_B64)],
      download,
    });

    const names = await listZipEntryNames(calls[0].blob);
    const media = names.filter((n) => n.startsWith('word/media/'));
    expect(media.length).toBeGreaterThan(0);
  });

  it('无图文档 → 无 word/media/ 条目', async () => {
    const { calls, download } = captureDownload();
    await exportDocx({ markdown: '# 纯文本文档', download });

    const names = await listZipEntryNames(calls[0].blob);
    const media = names.filter((n) => n.startsWith('word/media/'));
    expect(media).toEqual([]);
  });

  it('空文档 → 仍产出合法非空 docx（PK magic + size > 0）', async () => {
    const { calls, download } = captureDownload();
    const result = await exportDocx({ markdown: '', download });

    expect(result).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    const blob = calls[0].blob;
    expect(blob.size).toBeGreaterThan(0);
    const buf = new Uint8Array(await blob.arrayBuffer());
    expect(Array.from(buf.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it('frontmatter 剥离：document.xml 文本不含 frontmatter 残留', async () => {
    const { calls, download } = captureDownload();
    const md = '---\ntitle: 我的文档\ndate: 2026-09-12\n---\n\n正文内容。\n';
    await exportDocx({ markdown: md, download });

    const xml = await readZipEntryText(calls[0].blob, 'word/document.xml');
    expect(xml).not.toBeNull();
    expect(xml).not.toContain('title: 我的文档');
    expect(xml).not.toContain('date: 2026-09-12');
    // 正文保留
    expect(xml).toContain('正文内容');
  });

  it('默认文件名为 document.docx', async () => {
    const { calls, download } = captureDownload();
    await exportDocx({ markdown: '# 标题', download });

    expect(calls).toHaveLength(1);
    expect(calls[0].filename).toBe(DEFAULT_DOCX_FILENAME);
    expect(calls[0].filename).toBe('document.docx');
  });

  it('filename 可参数化覆盖默认', async () => {
    const { calls, download } = captureDownload();
    await exportDocx({ markdown: '# 标题', filename: 'report.docx', download });

    expect(calls).toHaveLength(1);
    expect(calls[0].filename).toBe('report.docx');
  });

  it('确定性结果契约：成功 → { ok: true }', async () => {
    const { download } = captureDownload();
    const result = await exportDocx({ markdown: '内容', download });
    expect(result).toEqual({ ok: true });
  });

  it('确定性结果契约：异常路径 → { ok: false, error } 且不抛出', async () => {
    const { calls, download } = captureDownload();
    // 传入畸形 dataUrl（无逗号）→ dataUrlToBytes 抛错 → 薄封装 catch 收敛为 { ok:false }
    const badAsset: Asset = { name: 'bad.png', size: 0, dataUrl: 'not-a-data-url' };
    const result = await exportDocx({
      markdown: '# 测试',
      assets: [badAsset],
      download,
    });

    expect(result).toHaveProperty('ok', false);
    if ('ok' in result && !result.ok) {
      expect(result.error).toContain('不是有效的 data URL');
    }
    // 不抛出：Promise 已 resolve（非 reject）
    expect(calls).toHaveLength(0);
  });

  it('SVG 图片降级：导出成功且 onWarning 触发', async () => {
    const { calls, download } = captureDownload();
    const warnings: string[] = [];
    // 最小有效 SVG（base64 编码）
    const svgB64 = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>',
    ).toString('base64');
    const svgAsset: Asset = {
      name: 'diag.svg',
      size: svgB64.length,
      dataUrl: `data:image/svg+xml;base64,${svgB64}`,
    };
    const result = await exportDocx({
      markdown: '# 附图\n\n![svg](diag.svg)\n',
      assets: [svgAsset],
      download,
      onWarning: (m) => warnings.push(m),
    });

    // 导出成功（不因 SVG 失败）
    expect(result).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    const blob = calls[0].blob;
    expect(blob.size).toBeGreaterThan(0);
    const buf = new Uint8Array(await blob.arrayBuffer());
    expect(Array.from(buf.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);

    // onWarning 收到至少一条含 svg/图片 相关信息的警告
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some((w) => /svg|图片|image|位图/i.test(w))).toBe(true);
  });

  it('复杂 markdown（嵌套列表/表格/删除线/引用）产出合法 docx', async () => {
    const { calls, download } = captureDownload();
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

    const result = await exportDocx({ markdown: md, download });

    expect(result).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    const blob = calls[0].blob;
    expect(blob.size).toBeGreaterThan(0);

    // 合法 ZIP + OOXML 部件
    const buf = new Uint8Array(await blob.arrayBuffer());
    expect(Array.from(buf.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const names = await listZipEntryNames(blob);
    expect(names).toContain('[Content_Types].xml');
    expect(names).toContain('word/document.xml');
  });
});

  it('docx 结构断言：表格满宽 + 固定布局 + callout 色 + styles 行距 + 无 callout 标记残留', async () => {
  const { calls, download } = captureDownload();
  // 输入含表格（触发 w:tblW）和 tip callout（触发 ECF7EC 色）
  const md = [
    '# 结构断言测试',
    '',
    '| 列A | 列B |',
    '|-----|-----|',
    '| a1  | b1  |',
    '',
    '> [!tip] 提示标题',
    '> 提示正文内容',
    '',
  ].join('\n');
  const result = await exportDocx({ markdown: md, download });

  expect(result).toEqual({ ok: true });
  expect(calls).toHaveLength(1);

  const docXml = await readZipEntryText(calls[0].blob, 'word/document.xml');
  const stylesXml = await readZipEntryText(calls[0].blob, 'word/styles.xml');
  expect(docXml).not.toBeNull();
  expect(stylesXml).not.toBeNull();

  // 1. 表格存在
  expect(docXml).toContain('<w:tbl>');
  // 2. 表格列宽满宽 9026（twips = 100% A4 页面宽度）
  expect(docXml).toContain('w:tblW w:w="9026"');
  // 3. 表格固定布局
  expect(docXml).toContain('<w:tblLayout w:type="fixed"/>');
  // 4. callout tip 类型色 ECF7EC（浅绿色背景）
  expect(docXml).toContain('w:fill="ECF7EC"');
  // 5. styles.xml 含标准行距 240 twips（单倍行距）
  expect(stylesXml).toContain('w:line="240"');
  // 6. document.xml 不含 callout 标记残留（[!tip] 应被渲染为视觉样式而非文本）
  expect(docXml).not.toContain('[!');
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
