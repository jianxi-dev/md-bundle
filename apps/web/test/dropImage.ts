// 共享图片拖入辅助（任务 3.1）：构造 DataTransfer + File，向工作区派发合成 drop 事件。
// 替代已删除的 import-images-input 文件选择器，供各 e2e 规格复用。
import type { Page } from '@playwright/test';

export interface DropImageSpec {
  name: string;
  mimeType: string;
  data: string | Buffer;
}

export const dropImages = async (page: Page, specs: DropImageSpec[]): Promise<void> => {
  const payload = specs.map((s) => ({
    name: s.name,
    mimeType: s.mimeType,
    base64: typeof s.data === 'string' ? s.data : s.data.toString('base64'),
  }));
  await page.evaluate((items) => {
    const dt = new DataTransfer();
    for (const it of items) {
      const bytes = Uint8Array.from(atob(it.base64), (c) => c.charCodeAt(0));
      dt.items.add(new File([bytes], it.name, { type: it.mimeType }));
    }
    const el = document.querySelector('[data-testid="workspace-modes"]');
    if (!el) throw new Error('editor area not found');
    el.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, payload);
};