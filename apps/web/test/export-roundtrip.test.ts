// 导出收口测试（Task 3.6）—— round-trip「不再裂图」幕布。
// 核心（A）：真实 valid.mdpkg 夹具（K=2 图）→ openPackage → readEntrySource →
//   buildHtmlDocument → 恰好 K 个 <img>、全部 data:image/、零相对路径 / file:// / 外链。
// 缺图（B）：markdown 引用 missing.png 且资产清单为空 → HTML 导出零 <img>（确定性移除，
//   不崩溃）；PNG 管线（DI fakes）同样到达栅格化不崩溃。
// 空文档（C）：PNG 导出确定性 reject '文档为空'（绝不产出损坏 PNG）；.md 导出空串字节一致。
// 聚合（D）：3.5 已提交的 export-png.png 证据 → parsePngSize 得 {1600, 840}（魔数 + IHDR）。
// 真实浏览器栅格化由 3.5 的 e2e 证明，此处不重复实现 canvas。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { buildHtmlDocument } from '../src/lib/exportHtml';
import { exportPngFromMarkdown } from '../src/lib/exportPng';
import { exportMd } from '../src/lib/export';
import { parsePngSize } from '../src/lib/pngMeta';
import type { Asset } from '../src/lib/assets';

const { openPackage, readEntrySource } = await import('../src/lib/mdpkg');

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, 'fixtures');
const TEST_RESULTS = join(HERE, '..', 'test-results');
const EVIDENCE_PATH = join(TEST_RESULTS, 'roundtrip-v2.json');

const IMAGE_PATH_RE = /\.(png|jpe?g|gif|webp)$/i;
const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

/** 证据事实（测试内收集，afterAll 落盘）。 */
const facts = {
  kImages: 0,
  kDataUris: 0,
  zeroBroken: false,
  missingImageRemoved: false,
  emptyPngRejects: false,
  emptyMdExports: false,
  pngArtifactValid: false,
};

/** 1x1 红色 PNG（真实字节，与 exportPng.test 同源）。 */
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

/** fake canvas：记录创建尺寸 + 2D 上下文 spy；toBlob 立即回调 fake 1x1 PNG。 */
function makeFakeCanvas() {
  const drawImage = vi.fn();
  const scale = vi.fn();
  const fillRect = vi.fn();
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ drawImage, scale, fillRect, fillStyle: '' }),
    toBlob: (cb: (b: Blob | null) => void) => cb(makeTestBlob()),
  } as unknown as HTMLCanvasElement;
  return { canvas, drawImage, scale, fillRect };
}

describe('round-trip：valid.mdpkg → HTML 导出（THE MOAT）', () => {
  it('K=2 图 → 恰好 K 个 <img>、全部 data:image/、零相对路径 / file:// / 外链、byline 在', async () => {
    const bytes = new Uint8Array(readFileSync(join(FIXTURES, 'valid.mdpkg')));
    const r = await openPackage(bytes);
    expect('files' in r).toBe(true);
    if (!('files' in r)) return;
    expect(r.validation.ok).toBe(true);

    // 从包内实际条目发现图片路径（不硬编码文件名）。
    const imagePaths = [...r.files.keys()].filter((p) => IMAGE_PATH_RE.test(p));
    expect(imagePaths.length).toBe(2);

    // 入口 Markdown 原文（include 未展开），含 2 个图片引用。
    const entry = readEntrySource(r.files);
    const refs = entry.match(/!\[[^\]]*\]\([^)]+\)/g) ?? [];
    expect(refs.length).toBe(2);
    // 每个图片路径都被入口引用（round-trip 完整性：引用 ↔ 资产一一对应）。
    for (const p of imagePaths) expect(entry).toContain(`](${p})`);

    // 资产清单：图片条目 → Asset（data URL 由原始字节生成）。
    const assets: Asset[] = imagePaths.map((path) => {
      const fileBytes = r.files.get(path)!;
      const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
      return {
        name: path,
        size: fileBytes.length,
        dataUrl: `data:${MIME[ext] ?? 'image/png'};base64,${Buffer.from(fileBytes).toString('base64')}`,
      };
    });

    const html = await buildHtmlDocument({ markdown: entry, assets, title: 'roundtrip' });

    // 恰好 K 个 <img>。
    const imgs = html.match(/<img\b/g) ?? [];
    expect(imgs.length).toBe(2);
    // 每个 <img> 的 src 都是 data:image/。
    const srcs = html.match(/<img\b[^>]*\bsrc\s*=\s*"([^"]+)"/g) ?? [];
    expect(srcs.length).toBe(2);
    for (const s of srcs) expect(s).toMatch(/src="data:image\//);
    // data URI 计数 = K。
    const dataUris = html.match(/data:image\/png;base64,/g) ?? [];
    expect(dataUris.length).toBe(2);
    // 零残留：无 file://、无 src="http、无裸图片路径。
    expect(html).not.toContain('file://');
    expect(html).not.toContain('src="http');
    for (const p of imagePaths) expect(html).not.toContain(p);
    // byline 品牌链接在。
    expect(html).toContain('?ref=md-png');
    expect(html).toContain('Made with 本兜 bundle.jianxi.me');

    facts.kImages = imgs.length;
    facts.kDataUris = dataUris.length;
    facts.zeroBroken = true;
  });
});

describe('缺图确定性（B）', () => {
  it('markdown 引用 missing.png + 空资产清单 → HTML 导出零 <img>（整段移除，不崩溃）', async () => {
    const html = await buildHtmlDocument({
      markdown: '# x\n\n![missing](missing.png)',
      assets: [],
    });
    expect(html.match(/<img\b/g)).toBeNull();
    // 文档其余部分完好（良构）。
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<h1>x</h1>');
    expect(html).not.toContain('missing.png');
    facts.missingImageRemoved = true;
  });

  it('缺图文档走 PNG 管线（DI fakes）→ 到达栅格化、产出合法 PNG、不崩溃', async () => {
    const { canvas, drawImage, scale } = makeFakeCanvas();
    const blob = await exportPngFromMarkdown({
      markdown: '# x\n\n![missing](missing.png)',
      assets: [],
      width: 400,
      measureHeight: () => 120,
      createCanvas: (w, h) => {
        canvas.width = w;
        canvas.height = h;
        return canvas;
      },
      makeImage: makeFakeImage,
    });
    expect(scale).toHaveBeenCalledWith(2, 2);
    expect(drawImage).toHaveBeenCalledTimes(1); // 到达栅格化
    expect(parsePngSize(new Uint8Array(await blob.arrayBuffer()))).toEqual({ width: 1, height: 1 });
  });
});

describe('空文档确定性（C）', () => {
  it('全空白 → PNG 导出 reject 文档为空（绝不产出损坏 PNG）', async () => {
    await expect(
      exportPngFromMarkdown({ markdown: '  \n  ', assets: [] }),
    ).rejects.toThrow('文档为空');
    facts.emptyPngRejects = true;
  });

  it('空文本 → .md 导出成功且字节级一致（空串，无异常）', () => {
    const download = vi.fn();
    const ok = exportMd('', { hasImages: false, download });
    expect(ok).toBe(true);
    expect(download).toHaveBeenCalledTimes(1);
    const text = download.mock.calls[0][0] as string;
    expect(text).toBe('');
    const enc = new TextEncoder();
    expect([...enc.encode(text)]).toEqual([]); // 0 字节
    facts.emptyMdExports = true;
  });
});

describe('聚合（D）：3.5 已提交 PNG 证据可解析', () => {
  it('export-png.png → parsePngSize {1600, 922}（魔数 + IHDR 尺寸）', () => {
    const bytes = new Uint8Array(readFileSync(join(TEST_RESULTS, 'export-png.png')));
    const size = parsePngSize(bytes);
    expect(size).toEqual({ width: 1600, height: 922 });
    facts.pngArtifactValid = true;
  });
});

afterAll(() => {
  const evidence = {
    tasks: '1.5',
    kImages: facts.kImages,
    kDataUris: facts.kDataUris,
    zeroBroken: facts.zeroBroken,
    missingImageRemoved: facts.missingImageRemoved,
    emptyPngRejects: facts.emptyPngRejects,
    emptyMdExports: facts.emptyMdExports,
    pngArtifactValid: facts.pngArtifactValid,
    tests: 6, // keep in sync — real it() count
  };
  mkdirSync(TEST_RESULTS, { recursive: true });
  writeFileSync(EVIDENCE_PATH, JSON.stringify(evidence, null, 2) + '\n');
});