# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: export-png.e2e.spec.ts >> exportPngFromMarkdown rasterizes CJK + emoji + inlined image in real Chromium
- Location: test/export-png.e2e.spec.ts:30:1

# Error details

```
Error: expect(received).toBeGreaterThanOrEqual(expected)

Expected: >= 8
Received:    5
```

# Test source

```ts
  5   | //   - 空文档 → 确定性拒绝 '文档为空'
  6   | // Node 侧：PNG 签名 + 尺寸断言，落盘产物 test-results/export-png.png + 证据 JSON。
  7   | import { mkdirSync, writeFileSync } from 'node:fs';
  8   | import { dirname, join } from 'node:path';
  9   | import { fileURLToPath } from 'node:url';
  10  | import { expect, test } from '@playwright/test';
  11  | import { parsePngSize } from '../src/lib/pngMeta';
  12  | 
  13  | // 两个测试共享模块级证据状态（artifactBytes/pngSize/emptyError），且 afterAll 汇总落盘
  14  | // —— 必须串行：fullyParallel 会把同文件测试拆到不同 worker，模块状态互不可见，证据会丢。
  15  | test.describe.configure({ mode: 'serial' });
  16  | 
  17  | const here = dirname(fileURLToPath(import.meta.url));
  18  | const RES = join(here, '..', 'test-results');
  19  | 
  20  | // 1x1 红色 PNG —— 用作资产图，证明 image inlining 在栅格里生效。
  21  | const PNG_1 =
  22  |   'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  23  | 
  24  | // 跨测试收集的证据（同文件内串行执行，afterAll 汇总落盘）。
  25  | let artifactBytes: number[] = [];
  26  | let pngSize: { width: number; height: number } | null = null;
  27  | let distinctColors = 0;
  28  | let emptyError = false;
  29  | 
  30  | test('exportPngFromMarkdown rasterizes CJK + emoji + inlined image in real Chromium', async ({
  31  |   page,
  32  | }) => {
  33  |   await page.goto('/');
  34  | 
  35  |   const result = await page.evaluate(async ({ png1 }) => {
  36  |     const mod = await import('/src/lib/exportPng.ts');
  37  |     const blob = await mod.exportPngFromMarkdown({
  38  |       markdown:
  39  |         '# 中文👍测试\n\n一行中文内容，验证 CJK 字形渲染。\n\n第二行：emoji 🎉 与中文混排。\n\n![pic](pic.png)\n\n- 列表项一\n- 列表项二\n\n> 引用块：系统字体回退链必须覆盖 PingFang / Noto CJK。',
  40  |       assets: [{ name: 'pic.png', size: 999, dataUrl: png1 }],
  41  |       theme: 'dark',
  42  |     });
  43  |     const buf = new Uint8Array(await blob.arrayBuffer());
  44  | 
  45  |     // TOFU 检查：把 PNG 画进 canvas，抽样统计颜色。
  46  |     // tofu 方块是均匀矩形 → 色数极少；真实字形（抗锯齿 + emoji 彩色）→ 色数高。
  47  |     const bmp = await createImageBitmap(blob);
  48  |     const canvas = document.createElement('canvas');
  49  |     canvas.width = bmp.width;
  50  |     canvas.height = bmp.height;
  51  |     const ctx = canvas.getContext('2d')!;
  52  |     ctx.drawImage(bmp, 0, 0);
  53  |     const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  54  | 
  55  |     const colors = new Set<string>();
  56  |     let nonBg = 0;
  57  |     const xs = [
  58  |       0,
  59  |       Math.floor(canvas.width * 0.25),
  60  |       Math.floor(canvas.width / 2),
  61  |       Math.floor(canvas.width * 0.75),
  62  |       canvas.width - 1,
  63  |     ];
  64  |     for (let y = 0; y < canvas.height; y += 10) {
  65  |       for (const x of xs) {
  66  |         const i = (y * canvas.width + x) * 4;
  67  |         const r = imgData.data[i];
  68  |         const g = imgData.data[i + 1];
  69  |         const b = imgData.data[i + 2];
  70  |         colors.add(`${r},${g},${b}`);
  71  |         // 非背景像素：暗色主题 bg #0d1117 = (13,17,23)，距离 > 12 视为字形/图片像素
  72  |         if (
  73  |           Math.abs(r - 13) > 12 ||
  74  |           Math.abs(g - 17) > 12 ||
  75  |           Math.abs(b - 23) > 12
  76  |         ) {
  77  |           nonBg++;
  78  |         }
  79  |       }
  80  |     }
  81  |     return {
  82  |       b64: Array.from(buf),
  83  |       distinctColors: colors.size,
  84  |       nonBg,
  85  |       w: bmp.width,
  86  |       h: bmp.height,
  87  |     };
  88  |   }, { png1: PNG_1 });
  89  | 
  90  |   // PNG 签名（8 字节魔数）
  91  |   const bytes = new Uint8Array(result.b64);
  92  |   expect(Array.from(bytes.slice(0, 8))).toEqual([
  93  |     0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  94  |   ]);
  95  | 
  96  |   // 尺寸：长图（宽 ≥ 400，高 ≥ 100）
  97  |   const size = parsePngSize(bytes);
  98  |   expect(size).not.toBeNull();
  99  |   expect(size!.width).toBeGreaterThanOrEqual(400);
  100 |   expect(size!.height).toBeGreaterThanOrEqual(100);
  101 |   expect(result.w).toBe(size!.width);
  102 |   expect(result.h).toBe(size!.height);
  103 | 
  104 |   // CJK/emoji 保真：色数 ≥ 8 且至少一个非背景像素（tofu 方块过不了此门）
> 105 |   expect(result.distinctColors).toBeGreaterThanOrEqual(8);
      |                                 ^ Error: expect(received).toBeGreaterThanOrEqual(expected)
  106 |   expect(result.nonBg).toBeGreaterThan(0);
  107 | 
  108 |   artifactBytes = result.b64;
  109 |   pngSize = size;
  110 |   distinctColors = result.distinctColors;
  111 | });
  112 | 
  113 | test('empty markdown → rejects with 文档为空 (deterministic, no corrupt PNG)', async ({
  114 |   page,
  115 | }) => {
  116 |   await page.goto('/');
  117 |   const message = await page.evaluate(async () => {
  118 |     const mod = await import('/src/lib/exportPng.ts');
  119 |     try {
  120 |       await mod.exportPngFromMarkdown({ markdown: '   \n\t ', assets: [] });
  121 |       return '';
  122 |     } catch (e) {
  123 |       return e instanceof Error ? e.message : String(e);
  124 |     }
  125 |   });
  126 |   expect(message).toContain('文档为空');
  127 |   emptyError = true;
  128 | });
  129 | 
  130 | test.afterAll(() => {
  131 |   mkdirSync(RES, { recursive: true });
  132 |   if (artifactBytes.length > 8) {
  133 |     writeFileSync(join(RES, 'export-png.png'), Buffer.from(artifactBytes));
  134 |   }
  135 |   writeFileSync(
  136 |     join(RES, 'export-png.json'),
  137 |     JSON.stringify(
  138 |       {
  139 |         tasks: '3.5',
  140 |         magic: true,
  141 |         width: pngSize?.width ?? 0,
  142 |         height: pngSize?.height ?? 0,
  143 |         distinctColors,
  144 |         emptyError,
  145 |       },
  146 |       null,
  147 |       2,
  148 |     ),
  149 |   );
  150 | });
```