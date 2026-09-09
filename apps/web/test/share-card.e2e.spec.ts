// 分享卡「复制为图片」e2e（任务 6.2）：真浏览器栅格化 + 复制 seam + 真实剪贴板。
// 在页面内 `await import('/src/lib/shareCard.ts')`（dev server 直接 serve TS 模块）：
//   - seam 栅格：copy: async () => false（绕过 OS 剪贴板）→ 真 PNG blob → 落盘
//     test-results/share-card.png，断言 PNG 魔数 + 尺寸 ≥ 600×300（2x 栅格 = 1200×600）
//   - copy-true seam：copied === true（无需剪贴板 API）
//   - 真实剪贴板：grantPermissions(['clipboard-read','clipboard-write']) →
//     默认 copyToClipboard（ClipboardItem + navigator.clipboard.write）→ copied === true
//   - 字符串级接缝：SVG 含 ?ref=md-share + BYLINE_TEXT；canShare 空文档 false / 有数据 true
// Node 侧：PNG 签名 + 尺寸断言，落盘证据 JSON。
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { parsePngSize } from '../src/lib/pngMeta';

// 共享模块级证据状态 + afterAll 汇总落盘 —— 必须串行（fullyParallel 会拆 worker）。
test.describe.configure({ mode: 'serial' });

const here = dirname(fileURLToPath(import.meta.url));
const RES = join(here, '..', 'test-results');

const CARD_ARGS = {
  title: '我的文档',
  markdown: '# 我的文档\n\n这是分享卡预览的第一行正文内容，用于验证卡片渲染。\n\n第二行内容。',
  stats: { chars: 42, images: 2 },
};

// 跨测试收集的证据（同文件内串行执行，afterAll 汇总落盘）。
let artifactBytes: number[] = [];
let pngSize: { width: number; height: number } | null = null;
let bylinePresentInSvg = false;
let copySuccessSeam = false;
let fallbackPath = false;
let disabledWithoutData = false;
let realClipboardCopied = false;

test('shareCardAsImage rasterizes a real card PNG via the copy seam (fallback path)', async ({
  page,
}) => {
  await page.goto('/');

  const result = await page.evaluate(async (args) => {
    const mod = await import('/src/lib/shareCard.ts');
    // copy seam：绕过真实剪贴板 —— 走「复制失败 → 调用方下载兜底」路径
    const { copied, blob } = await mod.shareCardAsImage({
      ...args,
      copy: async () => false,
    });
    const buf = new Uint8Array(await blob.arrayBuffer());
    return { copied, bytes: Array.from(buf) };
  }, CARD_ARGS);

  // 兜底信号：copied=false 但 blob 照常产出（调用方据此 downloadBlob）
  expect(result.copied).toBe(false);
  fallbackPath = true;

  // PNG 签名（8 字节魔数）
  const bytes = new Uint8Array(result.bytes);
  expect(Array.from(bytes.slice(0, 8))).toEqual([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);

  // 尺寸：卡片 600×300 @2x = 1200×600；断言 ≥ 600×300（规格下限）
  const size = parsePngSize(bytes);
  expect(size).not.toBeNull();
  expect(size!.width).toBeGreaterThanOrEqual(600);
  expect(size!.height).toBeGreaterThanOrEqual(300);

  artifactBytes = result.bytes;
  pngSize = size;
});

test('copy seam resolves true → copied flag (no clipboard API needed)', async ({ page }) => {
  await page.goto('/');
  const copied = await page.evaluate(async (args) => {
    const mod = await import('/src/lib/shareCard.ts');
    const r = await mod.shareCardAsImage({ ...args, copy: async () => true });
    return r.copied;
  }, CARD_ARGS);
  expect(copied).toBe(true);
  copySuccessSeam = true;
});

test('real clipboard: default copyToClipboard writes image/png via ClipboardItem', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: 'http://localhost:4173',
  });
  await page.goto('/');
  const copied = await page.evaluate(async (args) => {
    const mod = await import('/src/lib/shareCard.ts');
    // 不传 copy —— 走默认 copyToClipboard（ClipboardItem + navigator.clipboard.write）
    const r = await mod.shareCardAsImage(args);
    return r.copied;
  }, CARD_ARGS);
  expect(copied).toBe(true);
  realClipboardCopied = true;
});

test('string-level seams: SVG carries md-share byline; canShare gates empty docs', async ({
  page,
}) => {
  await page.goto('/');
  const result = await page.evaluate(async (args) => {
    const mod = await import('/src/lib/shareCard.ts');
    const svg = mod.shareCardSvg(
      mod.buildShareCardHtml({ ...args, markdown: args.markdown }),
    );
    return {
      byline: svg.includes('?ref=md-share') && svg.includes('Made with 本兜 bundle.jianxi.me'),
      foreignObject: svg.includes('<foreignObject'),
      emptyDisabled: mod.canShare({ title: '', stats: { chars: 0, images: 0 } }),
      withData: mod.canShare({ title: '我的文档', stats: { chars: 42, images: 2 } }),
    };
  }, CARD_ARGS);
  expect(result.byline).toBe(true);
  expect(result.foreignObject).toBe(true);
  expect(result.emptyDisabled).toBe(false);
  expect(result.withData).toBe(true);
  bylinePresentInSvg = result.byline;
  disabledWithoutData = !result.emptyDisabled && result.withData;
});

test.afterAll(() => {
  mkdirSync(RES, { recursive: true });
  if (artifactBytes.length > 8) {
    writeFileSync(join(RES, 'share-card.png'), Buffer.from(artifactBytes));
  }
  writeFileSync(
    join(RES, 'share-card.json'),
    JSON.stringify(
      {
        tasks: '6.2',
        pngMagic: pngSize !== null,
        width: pngSize?.width ?? 0,
        height: pngSize?.height ?? 0,
        bylinePresentInSvg,
        copySuccessSeam,
        fallbackPath,
        disabledWithoutData,
        realClipboardCopied,
      },
      null,
      2,
    ),
  );
});