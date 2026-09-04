// .md 导出逻辑单测（任务 3.3）。
// 依赖注入使整函数可测：download 捕获 (text, filename) 断言字节一致/文件名；
// confirm 控制含图警告分支。jsdom 无 URL.createObjectURL —— downloadBlob 走注入 seam，
// downloadText 走「静默跳过」守卫路径。
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_MD_FILENAME,
  WARNING_EXPORT_MD,
  exportMd,
} from '../src/lib/export';
import { downloadBlob, downloadText } from '../src/lib/download';

const SAMPLE = '## 标题\n\n中文👍内容\n';

/** 捕获 (text, filename) 的下载 spy。 */
function captureDownload() {
  const calls: { text: string; filename: string }[] = [];
  const download = vi.fn((text: string, filename: string) => {
    calls.push({ text, filename });
  });
  return { calls, download };
}

afterEach(() => {
  vi.restoreAllMocks();
  // 还原可能被测试临时赋值的 URL 静态方法，保持 jsdom 原生状态（均未实现）。
  Reflect.deleteProperty(URL, 'createObjectURL');
  Reflect.deleteProperty(URL, 'revokeObjectURL');
});

describe('exportMd', () => {
  it('无图：直接下载，文本与输入字节级一致（中文/emoji/换行）', () => {
    const { calls, download } = captureDownload();
    const ok = exportMd(SAMPLE, { hasImages: false, download });
    expect(ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].text).toBe(SAMPLE);
    // 字节级一致：UTF-8 编码后逐字节相同（下载链路不允许任何改写）。
    const enc = new TextEncoder();
    expect([...enc.encode(calls[0].text)]).toEqual([...enc.encode(SAMPLE)]);
    expect(calls[0].filename).toBe(DEFAULT_MD_FILENAME);
  });

  it('无图：不询问确认', () => {
    const confirm = vi.fn(() => true);
    const { calls, download } = captureDownload();
    exportMd(SAMPLE, { hasImages: false, confirm, download });
    expect(confirm).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
  });

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

  it('空文本：下载空串、无异常', () => {
    const { calls, download } = captureDownload();
    const ok = exportMd('', { hasImages: false, download });
    expect(ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].text).toBe('');
  });

  it('filename 可参数化（测试/文档名覆盖默认）', () => {
    const { calls, download } = captureDownload();
    exportMd(SAMPLE, { hasImages: false, filename: 'notes.md', download });
    expect(calls[0].filename).toBe('notes.md');
  });

  it('默认 confirm = window.confirm：确认 → 下载', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { calls, download } = captureDownload();
    const ok = exportMd(SAMPLE, { hasImages: true, download });
    expect(ok).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it('默认 confirm = window.confirm：取消 → 不下载', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { calls, download } = captureDownload();
    const ok = exportMd(SAMPLE, { hasImages: true, download });
    expect(ok).toBe(false);
    expect(calls).toHaveLength(0);
  });
});

describe('download 助手', () => {
  it('downloadText：jsdom 无 URL.createObjectURL → 静默跳过、不抛错', () => {
    expect(typeof URL.createObjectURL).toBe('undefined');
    expect(() => downloadText(SAMPLE, DEFAULT_MD_FILENAME)).not.toThrow();
  });

  it('downloadBlob：注入 createObjectUrl seam → a[download] 点击 + revoke 全链路', () => {
    const createObjectUrl = vi.fn((blob: Blob) => {
      expect(blob).toBeInstanceOf(Blob);
      return 'blob:mock-1';
    });
    const revoke = vi.fn();
    // jsdom 缺省无 revokeObjectURL —— 临时补上以断言 finally 撤销（afterEach 清理）。
    URL.revokeObjectURL = revoke as unknown as typeof URL.revokeObjectURL;
    let clicked: HTMLAnchorElement | null = null;
    const click = vi
      .spyOn(HTMLElement.prototype, 'click')
      .mockImplementation(function (this: HTMLElement) {
        clicked = this as HTMLAnchorElement;
      });

    downloadBlob(new Blob([SAMPLE], { type: 'text/markdown' }), 'doc.md', createObjectUrl);

    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(clicked?.href).toBe('blob:mock-1');
    expect(clicked?.download).toBe('doc.md');
    expect(revoke).toHaveBeenCalledWith('blob:mock-1');
  });
});
