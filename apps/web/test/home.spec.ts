// 首页 e2e（任务 5.1）：hero（宣传语/Logo/宣传图）+ 官方示例 gallery 一键载入 + 宣传图 fallback。
// 证据：test-results/home.png（hero 截图）+ home.json（任务验收字段）。
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const RES = join(here, '..', 'test-results');

test.use({ viewport: { width: 1280, height: 800 } });

// 串行：证据聚合依赖前序测试结果（同 export-png.e2e.spec.ts 模式）。
test.describe.configure({ mode: 'serial' });

const evidence = {
  tasks: '5.1',
  taglines: false,
  logo: false,
  promo: false,
  fallbackWorks: false,
  galleryLoads: false,
};

test('hero renders taglines, logo and promo graphic', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '分享 Markdown，不再裂图。' })).toBeVisible();
  await expect(page.getByText('一个文件，带走全部图文。')).toBeVisible();
  await expect(page.getByTestId('logo')).toBeVisible();
  await expect(page.getByTestId('promo')).toBeVisible();
  await expect(page.getByRole('link', { name: '立即开始' })).toHaveAttribute('href', '#workspace');
  evidence.taglines = true;
  evidence.logo = true;
  evidence.promo = true;

  await page.screenshot({ path: join(RES, 'home.png'), clip: { x: 0, y: 0, width: 1280, height: 800 } });
});

test('gallery loads official examples into the workspace in one click', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  await page.goto('/');
  await expect(page.getByTestId('gallery')).toBeVisible();
  await expect(page.getByRole('heading', { name: '官方示例' })).toBeVisible();

  // .mdpkg 示例 → sandbox iframe 完整预览
  await page.getByTestId('example-mdpkg-demo').click();
  await expect(page.getByTestId('mdpkg-frame')).toBeVisible();
  await expect(page.getByTestId('validation-pass')).toBeVisible();

  // .md 示例 → 编辑器 + 实时预览
  await page.getByTestId('example-hello-md').click();
  await expect(page.locator('.cm-editor')).toBeVisible();
  await expect(page.locator('.markdown-body h1').first()).toHaveText('Hello，MD-Bundle');
  await expect(page.getByTestId('mdpkg-frame')).toHaveCount(0);

  expect(pageErrors).toEqual([]);
  evidence.galleryLoads = true;
});

test('promo fallback: missing src keeps hero text and layout intact', async ({ page }) => {
  await page.goto('/');
  const h1 = page.getByRole('heading', { name: '分享 Markdown，不再裂图。' });
  await expect(h1).toBeVisible();

  await page.locator('img[data-testid="promo"]').evaluate((el) => el.removeAttribute('src'));

  await expect(h1).toBeVisible();
  const h1Box = await h1.boundingBox();
  expect(h1Box).not.toBeNull();
  expect(h1Box!.height).toBeGreaterThan(0);

  // 宣传图容器高度不塌陷（布局保持）
  const wrapBox = await page.getByTestId('promo-wrap').boundingBox();
  expect(wrapBox).not.toBeNull();
  expect(wrapBox!.height).toBeGreaterThan(100);
  evidence.fallbackWorks = true;
});

test.afterAll(async () => {
  writeFileSync(join(RES, 'home.json'), JSON.stringify(evidence, null, 2));
});