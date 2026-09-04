// 生成 OG 分享图（任务 5.3）：1200x630 品牌卡 → public/og-banner.png。
// 依赖：仅 @playwright/test（已有 devDep）—— headless chromium 截图，无图片库。
// 运行：node apps/web/scripts/gen-og-banner.mjs
// 尺寸保证：viewport 1200x630 + deviceScaleFactor 1 + 全页截图（无 clip）== 图片尺寸。
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const htmlUrl = pathToFileURL(`${here}/og-banner.html`).href;
const outPath = `${here}/../public/og-banner.png`;

mkdirSync(dirname(outPath), { recursive: true });

// channel 'chromium' = 完整 Chromium 新 headless 模式（本机无 headless-shell 下载，见 learnings 1.1）。
const browser = await chromium.launch({ channel: 'chromium' });
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.goto(htmlUrl);
  await page.screenshot({ path: outPath }); // 无 clip —— 视口即横幅尺寸
} finally {
  await browser.close();
}
console.log(`og-banner.png written: ${outPath}`);