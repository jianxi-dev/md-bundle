// #511：图片剪贴板 seam。公开契约只有一条：永不抛错，失败返回 false，
// 调用方据此走「兜底下载 + toast」。
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

const clipboard = await import('../src/clipboard/index');

const PNG = () => new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });

class FakeClipboardItem {
  items: Record<string, unknown>;
  constructor(items: Record<string, unknown>) {
    this.items = items;
  }
}

afterEach(() => {
  vi.restoreAllMocks();
  delete (globalThis as { ClipboardItem?: unknown }).ClipboardItem;
  delete (navigator as { clipboard?: unknown }).clipboard;
});

describe('app-kit clipboard surface', () => {
  it('注入 writer 时走 writer，并把 blob 原样交给它', async () => {
    const writer = vi.fn(async (_png: Blob) => true);
    const png = PNG();
    await expect(clipboard.copyImageToClipboard(png, writer)).resolves.toBe(true);
    expect(writer).toHaveBeenCalledTimes(1);
    expect(writer.mock.calls[0]![0]).toBe(png);
  });

  it('writer 抛错也收敛为 false，绝不抛出', async () => {
    const writer = vi.fn(async (_png: Blob) => {
      throw new Error('clipboard denied');
    });
    await expect(clipboard.copyImageToClipboard(PNG(), writer)).resolves.toBe(false);
  });

  it('缺 ClipboardItem / clipboard.write 的默认实现返回 false', async () => {
    await expect(clipboard.copyImageToClipboard(PNG())).resolves.toBe(false);
  });

  it('默认实现以 image/png 写入剪贴板', async () => {
    const write = vi.fn(async (_items: FakeClipboardItem[]) => undefined);
    (globalThis as { ClipboardItem?: unknown }).ClipboardItem = FakeClipboardItem;
    Object.defineProperty(navigator, 'clipboard', { value: { write }, configurable: true });

    await expect(clipboard.copyImageToClipboard(PNG())).resolves.toBe(true);
    expect(write).toHaveBeenCalledTimes(1);
    const arg = write.mock.calls[0]![0]![0]!;
    expect(Object.keys(arg.items)).toEqual(['image/png']);
  });
});
