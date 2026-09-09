// 视觉缺陷回归（Task）：行内图圆角黑边 + 资源面板「替换」按钮浅色主题低对比。
// 断言基于真实的 computed style（token 解析结果），不依赖像素采样：
//   - 行内图 widget 的 <img> 用 clip-path 圆角（修复 overflow 剪裁黑晕），容器用
//     主题 token 背景 --mdb-surface（深/浅主题各自解析为 surface 色，而非 near-black 画布）。
//   -「替换」按钮文字在浅/深主题分别跟随 --muted / --fg，hover 提亮为 --fg。
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { dropImages } from './dropImage';

const here = dirname(fileURLToPath(import.meta.url));
const FIX = join(here, 'fixtures');
const IMGS = join(FIX, 'imgs');
const RES = join(here, '..', 'test-results');

const setTheme = async (page: Page, theme: 'dark' | 'light'): Promise<void> => {
  await page.evaluate((t) => {
    document.documentElement.dataset.theme = t;
  }, theme);
};

const openMdInEdit = async (page: Page): Promise<void> => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(join(FIX, 'hello.md'));
  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible();
};

// 追加一行用红图素材的引用，让最后那个 widget 处于光标之外、可见。
const appendImage = async (page: Page, ref: string): Promise<void> => {
  const editor = page.getByTestId('mode-pane-editor').locator('.cm-content');
  await editor.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  await page.keyboard.insertText(ref);
};

test('行内图 widget 用 clip-path 圆角 + 主题 token 背景（修复圆角黑边）', async ({ page }) => {
  await openMdInEdit(page);
  await dropImages(page, [
    { name: 'red.png', mimeType: 'image/png', data: readFileSync(join(IMGS, 'red.png')) },
  ]);
  await appendImage(page, '![rounded](red.png)');

  const widget = page.getByTestId('mode-pane-editor').locator('.cm-image-widget').last();
  await expect(widget).toHaveCount(1);
  const img = widget.locator('img');
  await expect(img).toHaveAttribute('src', /^data:image\//);

  // 圆角在 <img> 自身（clip-path），容器不做 overflow 剪裁 —— 这是黑晕的根源。
  const clipPath = await img.evaluate((el) => getComputedStyle(el).clipPath);
  expect(clipPath).toContain('inset(0');
  expect(clipPath).toContain('round 4px');
  await expect(widget).toHaveCSS('overflow', 'visible');

  // 深/浅主题下容器背景解析为各自 surface 色（非 near-black 画布）。
  await setTheme(page, 'dark');
  await expect(widget).toHaveCSS('background-color', 'rgb(26, 27, 32)');
  await setTheme(page, 'light');
  await expect(widget).toHaveCSS('background-color', 'rgb(233, 233, 238)');

  await page.screenshot({ path: join(RES, 'visual-fix-image-light.png'), fullPage: false });
});

test('资源面板「替换」按钮文字跟随主题 token（浅色主题可读）', async ({ page }) => {
  await openMdInEdit(page);
  await dropImages(page, [
    { name: 'red.png', mimeType: 'image/png', data: readFileSync(join(IMGS, 'red.png')) },
  ]);

  // 展开左栏并切到资源页签，让 AssetPanel（含替换按钮）进入 DOM。
  await page.getByTestId('left-rail-toggle').click();
  await page.getByTestId('left-rail-tab-assets').click();
  const replace = page.getByTestId('replace-btn-red.png');
  await expect(replace).toHaveCount(1);
  await expect(replace).toBeVisible();

  // 浅色主题：rest --muted #6b6f78 → rgb(107,111,120)；hover --fg #191a1e → rgb(25,26,30)。
  await setTheme(page, 'light');
  await expect(replace).toHaveCSS('color', 'rgb(107, 111, 120)');
  await replace.hover();
  await expect(replace).toHaveCSS('color', 'rgb(25, 26, 30)');

  // 深色主题：hover --fg #f5f6f8 → rgb(245,246,248)。
  await setTheme(page, 'dark');
  await page.mouse.move(10, 10); // 移出按钮，确保 hover 重新触发
  await replace.hover();
  await expect(replace).toHaveCSS('color', 'rgb(245, 246, 248)');

  await page.screenshot({ path: join(RES, 'visual-fix-asset-light.png'), fullPage: false });
});
