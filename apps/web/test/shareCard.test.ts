// 分享卡单元测试（任务 6.2）—— jsdom 环境（DOMPurify 需要 window）。
// 浏览器 API（canvas/Image/剪贴板）全部注入 fake / stub，验证：卡片 HTML
// 结构（标题/预览/统计/byline）、XML 安全转义、SVG foreignObject 结构、
// PNG 栅格化委托参数、复制 seam 的 true/false 分支、无 ClipboardItem 守卫、
// canShare 禁用判定。
import { describe, expect, it, vi } from 'vitest';
import {
  buildShareCardHtml,
  canShare,
  cardToPngBlob,
  cardColors,
  copyToClipboard,
  markdownToPlainText,
  shareCardAsImage,
  shareCardSvg,
  CARD_WIDTH,
  CARD_HEIGHT,
} from '../src/lib/shareCard';
import { bylineCornerBadgeHtml, BYLINE_TEXT } from '../src/lib/byline';
import { parsePngSize } from '../src/lib/pngMeta';

// 1x1 红色 PNG（与 exportPng.test 同源 fixture，真实 PNG 字节）。
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

const SAMPLE_MD = '# 标题\n\n第一行正文内容，用于预览。\n\n第二行。';

describe('markdownToPlainText', () => {
  it('strips tags, collapses whitespace, decodes entities', () => {
    expect(markdownToPlainText('# 标题\n\n**加粗** 与 `代码` 混排。')).toBe(
      '标题 加粗 与 代码 混排。',
    );
  });

  it('slices to the preview cap (default 120 chars)', () => {
    const long = '字'.repeat(200);
    expect(markdownToPlainText(long)).toHaveLength(120);
    expect(markdownToPlainText(long, 10)).toHaveLength(10);
  });

  it('strips script tags (renderer hardening reused)', () => {
    expect(markdownToPlainText('<script>alert(1)</script>正文')).toBe('正文');
  });
});

describe('buildShareCardHtml', () => {
  it('contains title, preview text, stats row and the md-share corner byline', () => {
    const html = buildShareCardHtml({
      title: '我的文档',
      markdown: SAMPLE_MD,
      stats: { chars: 42, images: 2 },
    });
    expect(html).toContain('我的文档');
    expect(html).toContain('第一行正文内容，用于预览。');
    expect(html).toContain('42 字 · 2 图');
    expect(html).toContain(bylineCornerBadgeHtml('md-share'));
    expect(html).toContain('?ref=md-share');
    expect(html).toContain(BYLINE_TEXT);
  });

  it('wrapper is position:relative (anchor for the absolute byline badge)', () => {
    const html = buildShareCardHtml({
      title: 't',
      markdown: 'x',
      stats: { chars: 1, images: 0 },
    });
    expect(html).toContain('position:relative');
  });

  it('uses the dark card palette (bg/border/title/text)', () => {
    const html = buildShareCardHtml({
      title: 't',
      markdown: 'x',
      stats: { chars: 1, images: 0 },
    });
    expect(html).toContain('background:#0e0f12');
    expect(html).toContain('border:1px solid rgba(255,255,255,0.08)');
    expect(html).toContain('color:#f5f6f8');
    expect(html).toContain('color:#858b96');
  });

  it('uses light card palette when theme is light', () => {
    const html = buildShareCardHtml({
      title: 't',
      markdown: 'x',
      stats: { chars: 1, images: 0 },
      theme: 'light',
    });
    expect(html).toContain('background:#ffffff');
    expect(html).toContain('border:1px solid rgba(0,0,0,0.10)');
    expect(html).toContain('color:#191a1e');
    expect(html).toContain('color:#6b6f78');
  });

  it('cardColors resolves theme tokens for both themes', () => {
    expect(cardColors('dark').bg).toBe('#0e0f12');
    expect(cardColors('light').bg).toBe('#ffffff');
    expect(cardColors('dark').border).toBe('rgba(255,255,255,0.08)');
    expect(cardColors('light').border).toBe('rgba(0,0,0,0.10)');
  });

  it('XML-escapes user content (title/preview) so the SVG stays well-formed', () => {
    const html = buildShareCardHtml({
      title: 'a<b>&"c',
      markdown: '<img src=x> 正文',
      stats: { chars: 1, images: 0 },
    });
    expect(html).toContain('a&lt;b&gt;&amp;&quot;c');
    expect(html).not.toContain('a<b>');
  });
});

describe('shareCardSvg', () => {
  it('wraps card HTML in a 600x300 SVG with foreignObject (defaults)', () => {
    const svg = shareCardSvg('<div>card</div>');
    expect(svg.startsWith(`<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}"`)).toBe(true);
    expect(svg).toContain('<foreignObject width="100%" height="100%">');
    expect(svg).toContain('<div xmlns="http://www.w3.org/1999/xhtml"');
    expect(svg).toContain('</svg>');
  });

  it('honors explicit width/height', () => {
    const svg = shareCardSvg('<div>x</div>', { width: 400, height: 200 });
    expect(svg).toContain('width="400" height="200"');
  });

  it('card HTML passes through well-formed (no doctype, no escaped markup)', () => {
    const html = buildShareCardHtml({
      title: 't',
      markdown: 'x',
      stats: { chars: 1, images: 0 },
    });
    const svg = shareCardSvg(html);
    expect(svg).not.toContain('<!doctype');
    expect(svg).not.toContain('&lt;div');
    expect(svg).toContain(bylineCornerBadgeHtml('md-share'));
  });
});

describe('cardToPngBlob (delegates to svgToPngBlob)', () => {
  it('rasterizes at scale-2 dims with theme background fill', async () => {
    const { canvas, drawImage, scale, fillRect, toBlob } = makeFakeCanvas(
      makeTestBlob(),
    );
    const svg = shareCardSvg('<div>x</div>');
    const blob = await cardToPngBlob(svg, {
      background: '#08090b',
      createCanvas: (w, h) => {
        canvas.width = w;
        canvas.height = h;
        return canvas;
      },
      makeImage: makeFakeImage,
    });

    expect(canvas.width).toBe(CARD_WIDTH * 2);
    expect(canvas.height).toBe(CARD_HEIGHT * 2);
    expect(scale).toHaveBeenCalledWith(2, 2);
    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(fillRect).toHaveBeenCalledWith(0, 0, CARD_WIDTH, CARD_HEIGHT);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png');
    // 产物是 fake 的 1x1 PNG —— 合法 PNG，非损坏
    expect(parsePngSize(new Uint8Array(await blob.arrayBuffer()))).toEqual({ width: 1, height: 1 });
  });
});

describe('copyToClipboard (seam)', () => {
  it('returns false immediately when ClipboardItem API is absent (node env, no throw)', async () => {
    expect(await copyToClipboard(new Blob([PNG_1]))).toBe(false);
  });

  it('returns true when navigator.clipboard.write succeeds', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    // Node ≥21 的 globalThis.navigator 是只读 getter —— 用 defineProperty 覆盖
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { write } },
      configurable: true,
    });
    (globalThis as Record<string, unknown>).ClipboardItem = class ClipboardItem {
      constructor(public items: Record<string, Blob>) {}
    };
    try {
      const blob = new Blob([PNG_1], { type: 'image/png' });
      expect(await copyToClipboard(blob)).toBe(true);
      expect(write).toHaveBeenCalledTimes(1);
      const [items] = write.mock.calls[0] as [unknown[]];
      expect(items).toHaveLength(1);
      expect((items[0] as { items: Record<string, Blob> }).items['image/png']).toBe(blob);
    } finally {
      Reflect.deleteProperty(globalThis, 'navigator');
      delete (globalThis as Record<string, unknown>).ClipboardItem;
    }
  });

  it('returns false when clipboard.write rejects (no throw)', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { write: vi.fn().mockRejectedValue(new Error('denied')) } },
      configurable: true,
    });
    (globalThis as Record<string, unknown>).ClipboardItem = class ClipboardItem {
      constructor(public items: Record<string, Blob>) {}
    };
    try {
      expect(await copyToClipboard(new Blob([PNG_1]))).toBe(false);
    } finally {
      Reflect.deleteProperty(globalThis, 'navigator');
      delete (globalThis as Record<string, unknown>).ClipboardItem;
    }
  });
});

describe('shareCardAsImage', () => {
  it('copy seam resolves true → { copied: true, blob }', async () => {
    const copy = vi.fn().mockResolvedValue(true);
    const { canvas } = makeFakeCanvas(makeTestBlob());
    const result = await shareCardAsImage({
      title: '我的文档',
      markdown: SAMPLE_MD,
      stats: { chars: 42, images: 2 },
      copy,
      createCanvas: (w, h) => {
        canvas.width = w;
        canvas.height = h;
        return canvas;
      },
      makeImage: makeFakeImage,
    });
    expect(result.copied).toBe(true);
    expect(copy).toHaveBeenCalledTimes(1);
    expect(parsePngSize(new Uint8Array(await result.blob.arrayBuffer()))).toEqual({
      width: 1,
      height: 1,
    });
  });

  it('copy seam resolves false → { copied: false, blob } (fallback signal for download)', async () => {
    const copy = vi.fn().mockResolvedValue(false);
    const { canvas } = makeFakeCanvas(makeTestBlob());
    const result = await shareCardAsImage({
      title: '我的文档',
      markdown: SAMPLE_MD,
      stats: { chars: 42, images: 2 },
      copy,
      createCanvas: (w, h) => {
        canvas.width = w;
        canvas.height = h;
        return canvas;
      },
      makeImage: makeFakeImage,
    });
    expect(result.copied).toBe(false);
    // blob 仍然产出 —— 调用方据此走 downloadBlob 兜底
    expect(result.blob).toBeInstanceOf(Blob);
    expect(parsePngSize(new Uint8Array(await result.blob.arrayBuffer()))).toEqual({
      width: 1,
      height: 1,
    });
  });

  it('rasterized SVG contains the md-share byline (string-level seam)', async () => {
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

    await shareCardAsImage({
      title: '我的文档',
      markdown: SAMPLE_MD,
      stats: { chars: 42, images: 2 },
      copy: async () => true,
      createCanvas: (w, h) => {
        canvas.width = w;
        canvas.height = h;
        return canvas;
      },
      makeImage: () => capturingImage,
    });

    expect(capturedSvg).toContain(bylineCornerBadgeHtml('md-share'));
    expect(capturedSvg).toContain('?ref=md-share');
    expect(capturedSvg).toContain(BYLINE_TEXT);
    expect(capturedSvg).toContain('<foreignObject');
  });
});

describe('canShare (disabled-state helper)', () => {
  it('false for empty document (no title, no chars)', () => {
    expect(canShare({ title: '', stats: { chars: 0, images: 0 } })).toBe(false);
    expect(canShare({ title: '   ', stats: { chars: 0, images: 0 } })).toBe(false);
  });

  it('true when title or chars carry document data', () => {
    expect(canShare({ title: '我的文档', stats: { chars: 0, images: 0 } })).toBe(true);
    expect(canShare({ title: '', stats: { chars: 42, images: 2 } })).toBe(true);
    expect(canShare({ title: 't', stats: { chars: 42, images: 2 } })).toBe(true);
  });
});