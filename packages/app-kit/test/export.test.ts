// #509：导出管线迁入 app-kit。新入口 `@md-bundle/app-kit/export` 的行为契约。
// 运行于 jsdom：导出 barrel 会经 `@md-bundle/editor` 的设计令牌拉入 CM6（模块顶层读 DOM），
// 需要真实 DOM 才能加载；这与 apps/web 侧同名单测的环境一致。
// 只覆盖无布局依赖的部分（纯字符串 / 字节 / 打包）；HTML 水合仍由
// apps/web/test/exportHtml.test.ts 经旧位置垫片回归。
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

const kit = await import('../src/export/index');

/** 1x1 红色 PNG（真实字节，与 web 侧 exportMdpkg.test 同源）。 */
const PNG_1_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('app-kit export surface', () => {
  it('dataUrl ↔ bytes 往返，且拒绝非 base64 载荷', () => {
    const bytes = new Uint8Array([1, 2, 3, 250]);
    const url = kit.bytesToDataUrl(bytes, 'image/png');
    expect(url.startsWith('data:image/png;base64,')).toBe(true);
    expect(Array.from(kit.dataUrlToBytes(url))).toEqual([1, 2, 3, 250]);
    expect(() => kit.dataUrlToBytes('data:image/png,raw')).toThrow();
  });

  it('resolveAssetDataUrl 剥离 ./ 后精确匹配，flat 资产按 basename 匹配，绝对 URL 返回 null', () => {
    const assets = [
      { name: 'images/logo.png', size: 1, dataUrl: 'data:exact' },
      { name: 'flat.png', size: 1, dataUrl: 'data:flat' },
    ];
    expect(kit.resolveAssetDataUrl(assets, './images/logo.png')).toBe('data:exact');
    expect(kit.resolveAssetDataUrl(assets, 'images/logo.png')).toBe('data:exact');
    expect(kit.resolveAssetDataUrl(assets, 'sub/dir/flat.png')).toBe('data:flat');
    expect(kit.resolveAssetDataUrl(assets, 'logo.png')).toBeNull();
    expect(kit.resolveAssetDataUrl(assets, 'https://x.com/flat.png')).toBeNull();
  });

  it('inlineImages 内联已解析资产，整段移除外链与未解析引用', () => {
    const assets = [{ name: 'one.png', size: 1, dataUrl: 'data:image/png;base64,AAA' }];
    expect(kit.inlineImages('<img src="one.png" alt="a">', assets)).toBe(
      '<img src="data:image/png;base64,AAA" alt="a">',
    );
    expect(kit.inlineImages('<img src="https://x.com/y.png">', assets)).toBe('');
  });

  it('byline 文案与品牌链接保持既有字节', () => {
    expect(kit.BYLINE_TEXT).toBe('Made with 本兜 bundle.jianxi.me');
    expect(kit.BYLINE_BASE_URL).toBe('https://bundle.jianxi.me');
    expect(kit.bylineFooterHtml()).toBe(
      `<footer><a href="https://bundle.jianxi.me/?ref=md-html">${kit.BYLINE_TEXT}</a></footer>`,
    );
    expect(kit.bylineCenteredBadgeHtml()).toContain('ref=md-png');
  });

  it('hasKatex 只对含 katex 标记的 HTML 返回 true', () => {
    expect(kit.hasKatex('<span class="katex"></span>')).toBe(true);
    expect(kit.hasKatex('<p>plain</p>')).toBe(false);
  });

  it('exportMdpkg 产出 PK 头 ZIP，入口名固定 document.md', () => {
    expect(kit.ENTRY_FILENAME).toBe('document.md');
    const bytes = kit.exportMdpkg({
      markdown: '# hi',
      assets: [{ name: 'one.png', size: 3, dataUrl: `data:image/png;base64,${PNG_1_B64}` }],
    });
    expect(Array.from(bytes.subarray(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it('exportDocx 走注入 seam 下载，默认文件名 document.docx，不抛出', async () => {
    const calls: { blob: Blob; filename: string }[] = [];
    const download = vi.fn((blob: Blob, filename: string) => {
      calls.push({ blob, filename });
    });
    const result = await kit.exportDocx({ markdown: '# hi', download });
    expect(result).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.filename).toBe(kit.DEFAULT_DOCX_FILENAME);
    expect(calls[0]!.blob.type).toContain('wordprocessingml');
    // jsdom 的 Blob 没有 arrayBuffer()，用 FileReader 读字节（同样走浏览器 API）。
    const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(calls[0]!.blob);
    });
    expect(Array.from(new Uint8Array(bytes).subarray(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it('exportDocx 失败收敛为 { ok: false, error }', async () => {
    const download = vi.fn(() => {
      throw new Error('disk full');
    });
    const result = await kit.exportDocx({ markdown: '# hi', download });
    expect(result.ok).toBe(false);
  });
});
