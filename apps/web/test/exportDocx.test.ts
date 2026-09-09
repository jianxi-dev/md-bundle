// DOCX 导出测试 —— 验证文档结构与下载行为。
import { describe, expect, it, vi } from 'vitest';
import { exportDocx, buildDocxDocument, DEFAULT_DOCX_FILENAME } from '../src/lib/exportDocx';
import { Packer } from 'docx';

const SAMPLE_MARKDOWN = `# 一级标题

## 二级标题

### 三级标题

正文段落。

> 引用块内容

---

| 表头1 | 表头2 |
|-------|-------|
| 单元格1 | 单元格2 |
`;

function captureDownload() {
  const calls: { blob: Blob; filename: string }[] = [];
  const download = vi.fn((blob: Blob, filename: string) => {
    calls.push({ blob, filename });
  });
  return { calls, download };
}

describe('exportDocx', () => {
  it('buildDocxDocument 生成的文档可被 Packer 序列化', async () => {
    const doc = buildDocxDocument('# 测试', '文档标题', []);
    const base64 = await Packer.toBase64String(doc);
    expect(base64.length).toBeGreaterThan(0);
    expect(base64).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  it('生成的 docx 为非空 Blob', async () => {
    const { calls, download } = captureDownload();

    await exportDocx({
      markdown: SAMPLE_MARKDOWN,
      title: '测试文档',
      download,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].filename).toBe(DEFAULT_DOCX_FILENAME);
    expect(calls[0].blob).toBeInstanceOf(Blob);
    expect(calls[0].blob.size).toBeGreaterThan(0);
  });

  it('支持标题、引用、表格、分割线等复杂 Markdown', async () => {
    const { calls, download } = captureDownload();

    await exportDocx({
      markdown: SAMPLE_MARKDOWN,
      title: '测试文档',
      download,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].blob.size).toBeGreaterThan(100);
  });

  it('行内代码生成文档', async () => {
    const { calls, download } = captureDownload();

    await exportDocx({
      markdown: '`const x = 1;`',
      title: '测试文档',
      download,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].blob.size).toBeGreaterThan(0);
  });

  it('默认文件名为 document.docx', async () => {
    const { calls, download } = captureDownload();

    await exportDocx({
      markdown: '# 标题',
      download,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].filename).toBe('document.docx');
  });

  it('filename 可参数化覆盖默认', async () => {
    const { calls, download } = captureDownload();

    await exportDocx({
      markdown: '# 标题',
      filename: 'custom.docx',
      download,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].filename).toBe('custom.docx');
  });
});
