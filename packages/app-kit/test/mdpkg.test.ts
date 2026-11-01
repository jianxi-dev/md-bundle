// #508：mdpkg 打开路径迁入 app-kit。任何硬错误都必须收敛成 { error }，绝不抛出。
// 运行于 node 环境：vendored bundle 顶层引用 document，须先装 stub 再动态 import。
// @vitest-environment node
import { describe, expect, it } from 'vitest';

installDocumentStub();

const { openPackage } = await import('../src/mdpkg');

describe('app-kit mdpkg', () => {
  it('rejects non-zip bytes with a localized message instead of throwing', async () => {
    const result = await openPackage(new Uint8Array([1, 2, 3, 4]));
    expect('error' in result).toBe(true);
    if ('error' in result) {
      const message = result.error ?? '';
      expect(message).not.toMatch(/MDPKG-E\d+/);
      expect(message.length).toBeGreaterThan(0);
    }
  });
});

/** Minimal `document` so the vendored bundle can initialise under node. */
function installDocumentStub(): void {
  if (typeof globalThis.document !== 'undefined') return;
  const encode = (s: string): string =>
    s.replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_m, e: string) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' })[e] ?? _m);
  globalThis.document = {
    createElement: () => ({ style: {}, innerHTML: '', textContent: '', setAttribute: () => {}, appendChild: () => {} }),
    createTextNode: (text: string) => ({ textContent: text }),
    implementation: { createHTMLDocument: () => ({ body: { innerHTML: '' } }) },
    body: { innerHTML: '' },
  } as unknown as Document;
  void encode;
}
