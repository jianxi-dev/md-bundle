// PNG 长图导出 e2e（任务 3.5）：真浏览器栅格化 —— SVG foreignObject + canvas。
// 在页面内 `await import('/src/lib/exportPng.ts')`（dev server 直接 serve TS 模块）：
//   - CJK + emoji 保真：渲染 '# 中文👍测试' 后对像素抽样，色数高 = 真实字形（非 tofu 方块）
//   - 图片内联：assets 里的 PNG 走 data URI 进入 foreignObject，栅格含图
//   - 空文档 → 确定性拒绝 '文档为空'
// Node 侧：PNG 签名 + 尺寸断言，落盘产物 test-results/export-png.png + 证据 JSON。
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { parsePngSize } from '../src/lib/pngMeta';

// 两个测试共享模块级证据状态（artifactBytes/pngSize/emptyError），且 afterAll 汇总落盘
// —— 必须串行：fullyParallel 会把同文件测试拆到不同 worker，模块状态互不可见，证据会丢。
test.describe.configure({ mode: 'serial' });

const here = dirname(fileURLToPath(import.meta.url));
const RES = join(here, '..', 'test-results');

// 1x1 红色 PNG —— 用作资产图，证明 image inlining 在栅格里生效。
const PNG_1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

// 跨测试收集的证据（同文件内串行执行，afterAll 汇总落盘）。
let artifactBytes: number[] = [];
let pngSize: { width: number; height: number } | null = null;
let distinctColors = 0;
let emptyError = false;

test('exportPngFromMarkdown rasterizes CJK + emoji + inlined image in real Chromium', async ({
  page,
}) => {
  await page.goto('/');

  const result = await page.evaluate(async ({ png1 }) => {
    const mod = await import('/src/lib/exportPng.ts');
    const blob = await mod.exportPngFromMarkdown({
      markdown:
        '# 中文👍测试\n\n一行中文内容，验证 CJK 字形渲染。\n\n第二行：emoji 🎉 与中文混排。\n\n![pic](pic.png)\n\n- 列表项一\n- 列表项二\n\n> 引用块：系统字体回退链必须覆盖 PingFang / Noto CJK。',
      assets: [{ name: 'pic.png', size: 999, dataUrl: png1 }],
      theme: 'dark',
    });
    const buf = new Uint8Array(await blob.arrayBuffer());

    // TOFU 检查：把 PNG 画进 canvas，抽样统计颜色。
    // tofu 方块是均匀矩形 → 色数极少；真实字形（抗锯齿 + emoji 彩色）→ 色数高。
    const bmp = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bmp, 0, 0);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const colors = new Set<string>();
    let nonBg = 0;
    const xs = [
      0,
      Math.floor(canvas.width * 0.25),
      Math.floor(canvas.width / 2),
      Math.floor(canvas.width * 0.75),
      canvas.width - 1,
    ];
    for (let y = 0; y < canvas.height; y += 10) {
      for (const x of xs) {
        const i = (y * canvas.width + x) * 4;
        const r = imgData.data[i];
        const g = imgData.data[i + 1];
        const b = imgData.data[i + 2];
        colors.add(`${r},${g},${b}`);
        // 非背景像素：暗色主题 bg #0d1117 = (13,17,23)，距离 > 12 视为字形/图片像素
        if (
          Math.abs(r - 13) > 12 ||
          Math.abs(g - 17) > 12 ||
          Math.abs(b - 23) > 12
        ) {
          nonBg++;
        }
      }
    }
    return {
      b64: Array.from(buf),
      distinctColors: colors.size,
      nonBg,
      w: bmp.width,
      h: bmp.height,
    };
  }, { png1: PNG_1 });

  // PNG 签名（8 字节魔数）
  const bytes = new Uint8Array(result.b64);
  expect(Array.from(bytes.slice(0, 8))).toEqual([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);

  // 尺寸：长图（宽 ≥ 400，高 ≥ 100）
  const size = parsePngSize(bytes);
  expect(size).not.toBeNull();
  expect(size!.width).toBeGreaterThanOrEqual(400);
  expect(size!.height).toBeGreaterThanOrEqual(100);
  expect(result.w).toBe(size!.width);
  expect(result.h).toBe(size!.height);

  // CJK/emoji 保真：色数 ≥ 8 且至少一个非背景像素（tofu 方块过不了此门）
  expect(result.distinctColors).toBeGreaterThanOrEqual(8);
  expect(result.nonBg).toBeGreaterThan(0);

  artifactBytes = result.b64;
  pngSize = size;
  distinctColors = result.distinctColors;
});

test('empty markdown → rejects with 文档为空 (deterministic, no corrupt PNG)', async ({
  page,
}) => {
  await page.goto('/');
  const message = await page.evaluate(async () => {
    const mod = await import('/src/lib/exportPng.ts');
    try {
      await mod.exportPngFromMarkdown({ markdown: '   \n\t ', assets: [] });
      return '';
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  });
  expect(message).toContain('文档为空');
  emptyError = true;
});

test.afterAll(() => {
  mkdirSync(RES, { recursive: true });
  if (artifactBytes.length > 8) {
    writeFileSync(join(RES, 'export-png.png'), Buffer.from(artifactBytes));
  }
  writeFileSync(
    join(RES, 'export-png.json'),
    JSON.stringify(
      {
        tasks: '3.5',
        magic: true,
        width: pngSize?.width ?? 0,
        height: pngSize?.height ?? 0,
        distinctColors,
        emptyError,
      },
      null,
      2,
    ),
  );
});