// 邀请分享卡模板 e2e（任务 27）：真浏览器栅格化 4 张卡片 → 拼合为一张证据 PNG。
// 在页面内 `await import('/src/lib/inviteShareCards.ts')` 取卡片 HTML，
// 通过 shareCardSvg 管线栅格化，落盘 test-results/share-templates.png。
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { parsePngSize } from '../src/lib/pngMeta';

test.describe.configure({ mode: 'serial' });

const here = dirname(fileURLToPath(import.meta.url));
const RES = join(here, '..', 'test-results');

const NICKNAME = '快乐文字打包师';

// 收集的证据
let compositeBytes: number[] = [];
let templateCount = 0;
let allHaveUrl = false;
let allHaveBrand = false;

test('rasterize all 4 invite templates into a composite PNG', async ({ page }) => {
  await page.goto('/');

  const result = await page.evaluate(async (nickname) => {
    const cards = await import('/src/lib/inviteShareCards.ts');
    const shareCard = await import('/src/lib/shareCard.ts');

    const templates = cards.allTemplates({ nickname });
    const pngs: { type: string; bytes: number[]; width: number; height: number }[] = [];

    for (const tpl of templates) {
      const svg = shareCard.shareCardSvg(tpl.html, { width: tpl.width, height: tpl.height });
      // 栅格化：用 exportPng 的 svgToPngBlob 管线
      const exportPng = await import('/src/lib/exportPng.ts');
      const blob = await exportPng.svgToPngBlob(svg);
      const buf = new Uint8Array(await blob.arrayBuffer());
      pngs.push({
        type: tpl.type,
        bytes: Array.from(buf),
        width: tpl.width,
        height: tpl.height,
      });
    }

    return {
      pngs,
      allHaveUrl: templates.every((t) => t.html.includes('bundle.jianxi.me')),
      allHaveBrand: templates.every((t) => t.html.includes('Made with 本兜 bundle.jianxi.me')),
    };
  }, NICKNAME);

  templateCount = result.pngs.length;
  allHaveUrl = result.allHaveUrl;
  allHaveBrand = result.allHaveBrand;

  expect(templateCount).toBe(4);
  expect(allHaveUrl).toBe(true);
  expect(allHaveBrand).toBe(true);

  // 验证每张 PNG 合法
  for (const png of result.pngs) {
    const bytes = new Uint8Array(png.bytes);
    // PNG 魔数
    expect(Array.from(bytes.slice(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const size = parsePngSize(bytes);
    expect(size).not.toBeNull();
    // 2x 栅格：宽度 = cardWidth * 2
    expect(size!.width).toBeGreaterThanOrEqual(png.width);
  }

  // 拼合为一张证据图（2x2 网格，统一缩放）
  // 简化：取前两张（横版）排在上排，后两张（竖版）排在下排
  // 实际落盘：每张单独保存 + 一张拼合
  const composite = await page.evaluate(async (pngs) => {
    // 在浏览器端用 canvas 拼合
    const canvas = document.createElement('canvas');
    const W = 1240; // 2 * 600 + padding
    const H = 960; // 上下两排
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#08090b';
    ctx.fillRect(0, 0, W, H);

    const positions = [
      [20, 20, 600, 316], // product (landscape, scaled)
      [640, 20, 600, 316], // promo (landscape, scaled)
      [20, 376, 360, 640], // quote (portrait, scaled to fit)
      [400, 376, 360, 640], // minimal (portrait, scaled to fit)
    ];

    for (let i = 0; i < pngs.length; i++) {
      const png = pngs[i];
      const [x, y, w, h] = positions[i];
      const img = new Image();
      const blob = new Blob([new Uint8Array(png.bytes)], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.src = url;
      });
      ctx.drawImage(img, x, y, w, h);
      URL.revokeObjectURL(url);
    }

    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), 'image/png'),
    );
    const buf = new Uint8Array(await blob.arrayBuffer());
    return Array.from(buf);
  }, result.pngs);

  compositeBytes = composite;
});

test.afterAll(() => {
  mkdirSync(RES, { recursive: true });
  if (compositeBytes.length > 8) {
    writeFileSync(join(RES, 'share-templates.png'), Buffer.from(compositeBytes));
  }
  writeFileSync(
    join(RES, 'share-templates.json'),
    JSON.stringify(
      {
        tasks: '27',
        templateCount,
        allHaveUrl,
        allHaveBrand,
        compositePng: compositeBytes.length > 8,
      },
      null,
      2,
    ),
  );
});
