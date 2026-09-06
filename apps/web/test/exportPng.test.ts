// PNG 导出单元测试 —— jsdom 环境（DOMPurify 需要 window）。
// 浏览器 API（canvas/Image/DOM 测量）全部注入 fake，
// 验证：XML 转义、foreignObject 结构、PNG 签名/尺寸解析、栅格化调用参数、
// 空文档拒绝、全流程（DI）产出有效 PNG。
import { describe, expect, it, vi } from 'vitest';
import {
  svgFromHtml,
  svgToPngBlob,
  exportPngFromMarkdown,
  withCornerByline,
} from '../src/lib/exportPng';
import { bylineCornerBadgeHtml } from '../src/lib/byline';
import { parsePngSize } from '../src/lib/pngMeta';

// 1x1 红色 PNG（与 exportHtml.test 同源 fixture，真实 PNG 字节）。
const PNG_1_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const PNG_1 = Buffer.from(PNG_1_B64, 'base64');

function makeTestBlob(): Blob {
  const blob = new Blob([PNG_1], { type: 'image/png' });
  if (!blob.arrayBuffer) {
    (blob as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer = async () =>
      PNG_1.buffer.slice(PNG_1.byteOffset, PNG_1.byteOffset + PNG_1.byteLength) as ArrayBuffer;
  }
  return blob;
}

/** fake Image：src 一赋值立即同步触发 onload（无真实图片加载）。 */
function makeFakeImage(): HTMLImageElement {
  return {
    _src: '',
    set src(v: string) {
      this._src = v;
      this.onload?.();
    },
    get src() {
      return this._src;
    },
    onload: null,
    onerror: null,
  } as unknown as HTMLImageElement;
}

/** fake Image（失败路径）：src 一赋值立即触发 onerror。 */
function makeFailingImage(): HTMLImageElement {
  return {
    _src: '',
    set src(v: string) {
      this._src = v;
      this.onerror?.(new Event('error'));
    },
    get src() {
      return this._src;
    },
    onload: null,
    onerror: null,
  } as unknown as HTMLImageElement;
}

/** fake canvas：记录创建尺寸 + 2D 上下文 spy；toBlob 立即回调 fake blob。 */
function makeFakeCanvas(blob: Blob) {
  const drawImage = vi.fn();
  const scale = vi.fn();
  const fillRect = vi.fn();
  const toBlob = vi.fn((cb: (b: Blob | null) => void) => cb(blob));
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ drawImage, scale, fillRect, fillStyle: '' }),
    toBlob,
  } as unknown as HTMLCanvasElement;
  return { canvas, drawImage, scale, fillRect, toBlob };
}

describe('svgFromHtml', () => {
  it('wraps HTML in <svg> with foreignObject and the XHTML xmlns on the inner div', () => {
    const svg = svgFromHtml('<p>hi</p>', { width: 800, height: 200 });
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="200"')).toBe(true);
    expect(svg).toContain('<foreignObject width="100%" height="100%">');
    expect(svg).toContain('<div xmlns="http://www.w3.org/1999/xhtml"');
    expect(svg.endsWith('</svg>')).toBe(true);
    expect(svg).toContain('</foreignObject>');
    expect(svg).toContain('</div>');
  });

  it('converts the doc to well-formed XHTML: doctype stripped, void elements self-closed, markup preserved', () => {
    const svg = svgFromHtml(
      '<!doctype html><html><head><meta charset="utf-8"><style>p{color:red}</style></head><body><p>hi</p><img src="data:image/png;base64,AAA"><hr></body></html>',
      { width: 10, height: 10 },
    );
    expect(svg).not.toContain('<!doctype');
    expect(svg).toContain('<meta charset="utf-8"/>');
    expect(svg).toContain('<img src="data:image/png;base64,AAA"/>');
    expect(svg).toContain('<hr/>');
    expect(svg).toContain('<p>hi</p>');
    expect(svg).toContain('<style>p{color:red}</style>');
    expect(svg).not.toContain('&lt;');
  });

  it('leaves already self-closed void elements untouched', () => {
    const svg = svgFromHtml('<img src="x.png"/>', { width: 10, height: 10 });
    expect(svg).toContain('<img src="x.png"/>');
  });

  it('adds =" to valueless attributes for XML well-formedness', () => {
    const svg = svgFromHtml(
      '<p>hi</p><img src="a.png" alt="pic" data-zoomable><details open><summary>s</summary></details>',
      { width: 10, height: 10 },
    );
    // valueless data-zoomable must become data-zoomable="" for XML
    expect(svg).toContain('data-zoomable=""');
    // already-valued attributes unchanged
    expect(svg).toContain('src="a.png"');
    expect(svg).toContain('alt="pic"');
    // self-closed img
    expect(svg).toContain('<img src="a.png" alt="pic" data-zoomable=""/>');
  });
});

describe('withCornerByline（PNG 右下角徽标注入）', () => {
  it('body 加 position:relative 锚点，徽标插在 </body> 前', () => {
    const doc = '<!doctype html><html><body><p>x</p></body></html>';
    const out = withCornerByline(doc);
    expect(out).toContain('<body style="position:relative">');
    expect(out).toContain(bylineCornerBadgeHtml());
    expect(out.indexOf(bylineCornerBadgeHtml())).toBeLessThan(out.indexOf('</body>'));
    expect(out).toContain('?ref=md-png');
  });

  it('幂等：重复注入不叠加（同一徽标只出现一次）', () => {
    const once = withCornerByline('<html><body><p>x</p></body></html>');
    const twice = withCornerByline(once);
    expect(twice.match(/Made with MD-Bundle/g)?.length).toBe(1);
  });
});

describe('parsePngSize', () => {
  it('parses width/height from a real 1x1 PNG fixture', () => {
    expect(parsePngSize(new Uint8Array(PNG_1))).toEqual({ width: 1, height: 1 });
  });

  it('returns null for non-PNG bytes and for truncated input', () => {
    expect(parsePngSize(new TextEncoder().encode('not a png at all'))).toBeNull();
    // 前 8 字节是签名但 IHDR 不完整
    expect(parsePngSize(new Uint8Array(PNG_1).slice(0, 16))).toBeNull();
    expect(parsePngSize(new Uint8Array(0))).toBeNull();
  });
});

describe('svgToPngBlob (DI rasterizer)', () => {
  it('rasterizes at scale-2 dims: scale(2,2) + drawImage + toBlob(image/png)', async () => {
    const { canvas, drawImage, scale, fillRect, toBlob } = makeFakeCanvas(
      makeTestBlob(),
    );
    const blob = await svgToPngBlob(svgFromHtml('<p>x</p>', { width: 100, height: 50 }), {
      createCanvas: (w, h) => {
        canvas.width = w;
        canvas.height = h;
        return canvas;
      },
      makeImage: makeFakeImage,
    });

    expect(canvas.width).toBe(200); // 100 * 2
    expect(canvas.height).toBe(100); // 50 * 2
    expect(scale).toHaveBeenCalledWith(2, 2);
    expect(drawImage).toHaveBeenCalledTimes(1);
    const [imgArg, x, y] = drawImage.mock.calls[0];
    expect(x).toBe(0);
    expect(y).toBe(0);
    expect(imgArg).toBeTruthy();
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png');
    expect(fillRect).not.toHaveBeenCalled(); // 未传 background
    // 产物是 fake 的 1x1 PNG —— 合法 PNG，非损坏
    expect(parsePngSize(new Uint8Array(await blob.arrayBuffer()))).toEqual({ width: 1, height: 1 });
  });

  it('fills the canvas with the theme background when provided', async () => {
    const { canvas, fillRect } = makeFakeCanvas(
      makeTestBlob(),
    );
    await svgToPngBlob(svgFromHtml('<p>x</p>', { width: 100, height: 50 }), {
      background: '#0d1117',
      createCanvas: (w, h) => {
        canvas.width = w;
        canvas.height = h;
        return canvas;
      },
      makeImage: makeFakeImage,
    });
    expect(fillRect).toHaveBeenCalledWith(0, 0, 100, 50);
  });

  it('rejects when canvas.toBlob returns null (no corrupt PNG)', async () => {
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: vi.fn(), scale: vi.fn() }),
      toBlob: (cb: (b: Blob | null) => void) => cb(null),
    } as unknown as HTMLCanvasElement;
    await expect(
      svgToPngBlob(svgFromHtml('<p>x</p>', { width: 10, height: 10 }), {
        createCanvas: () => canvas,
        makeImage: makeFakeImage,
      }),
    ).rejects.toThrow('toBlob');
  });

  it('rejects when the SVG image fails to load', async () => {
    await expect(
      svgToPngBlob(svgFromHtml('<p>x</p>', { width: 10, height: 10 }), {
        makeImage: makeFailingImage,
      }),
    ).rejects.toThrow('加载出错');
  });

  it('rejects when the SVG has no width/height attributes', async () => {
    await expect(svgToPngBlob('<svg></svg>', { makeImage: makeFakeImage })).rejects.toThrow(
      'width/height',
    );
  });
});

describe('exportPngFromMarkdown', () => {
  it('rejects empty/whitespace markdown with 文档为空 (no blob produced)', async () => {
    await expect(
      exportPngFromMarkdown({ markdown: '', assets: [] }),
    ).rejects.toThrow('文档为空');
    await expect(
      exportPngFromMarkdown({ markdown: '   \n\t ', assets: [] }),
    ).rejects.toThrow('文档为空');
  });

  it('rasterizes content via DI into a valid PNG blob (canvas = width * scale)', async () => {
    const { canvas, drawImage, scale } = makeFakeCanvas(
      makeTestBlob(),
    );
    const blob = await exportPngFromMarkdown({
      markdown: '# 标题\n\n正文内容',
      assets: [],
      theme: 'dark',
      width: 400,
      measureHeight: () => 120,
      createCanvas: (w, h) => {
        canvas.width = w;
        canvas.height = h;
        return canvas;
      },
      makeImage: makeFakeImage,
    });

    expect(canvas.width).toBe(800); // 400 * 2
    expect(canvas.height).toBe(240); // 120 * 2
    expect(scale).toHaveBeenCalledWith(2, 2);
    expect(drawImage).toHaveBeenCalledTimes(1);
    // 全流程产物是合法 PNG（fake 1x1），不是损坏字节
    expect(parsePngSize(new Uint8Array(await blob.arrayBuffer()))).toEqual({ width: 1, height: 1 });
  });

  it('rasterized SVG contains the corner byline badge (string-level seam)', async () => {
    let capturedSvg = '';
    const capturingImage = {
      _src: '',
      set src(v: string) {
        this._src = v;
        const prefix = 'data:image/svg+xml;charset=utf-8,';
        if (v.startsWith(prefix)) capturedSvg = decodeURIComponent(v.slice(prefix.length));
        this.onload?.();
      },
      get src() {
        return this._src;
      },
      onload: null,
      onerror: null,
    } as unknown as HTMLImageElement;
    const { canvas } = makeFakeCanvas(makeTestBlob());

    await exportPngFromMarkdown({
      markdown: '# 标题\n\n正文内容',
      assets: [],
      width: 400,
      measureHeight: () => 120,
      createCanvas: (w, h) => {
        canvas.width = w;
        canvas.height = h;
        return canvas;
      },
      makeImage: () => capturingImage,
    });

    expect(capturedSvg).toContain(bylineCornerBadgeHtml());
    expect(capturedSvg).toContain('<body style="position:relative">');
    expect(capturedSvg).toContain('?ref=md-png');
    expect(capturedSvg).toContain('Made with MD-Bundle');
  });
});
