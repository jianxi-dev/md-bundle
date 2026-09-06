// 首页 e2e（任务 5.1 更新）：Landing 落地页全页体验 + 精选作品卡片一键载入。
// 证据：test-results/home.png（Landing 首屏截图）+ home.json（任务验收字段）。
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const RES = join(here, '..', 'test-results');

test.use({ viewport: { width: 1280, height: 900 } });

test.describe.configure({ mode: 'serial' });

const evidence = {
  tasks: '5.1/2.6',
  nav: false,
  heroSlogan: false,
  formatLine: false,
  featuredCards: false,
  clickLoadsEditor: false,
};

test('landing renders nav, hero slogan and format line', async ({ page }) => {
  await page.goto('/');

  // 细导航
  await expect(page.locator('[data-testid="landing-nav"]')).toBeVisible();
  await expect(page.locator('[data-testid="landing-nav"]').getByText('MD-Bundle（本兜）')).toBeVisible();
  evidence.nav = true;

  // 双行 slogan
  const slogan = page.locator('[data-testid="hero-slogan"]');
  await expect(slogan).toBeVisible();
  await expect(slogan).toContainText('Markdown');
  await expect(slogan).toContainText('不再裂图');
  evidence.heroSlogan = true;

  // 格式范围标注行
  const formatLine = page.locator('[data-testid="format-line"]');
  await expect(formatLine).toBeVisible();
  await expect(formatLine).toContainText('.md');
  await expect(formatLine).toContainText('.mdpkg');
  evidence.formatLine = true;

  await page.screenshot({ path: join(RES, 'home.png'), clip: { x: 0, y: 0, width: 1280, height: 900 } });
});

test('landing shows three featured cards and clicking loads editor', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  await page.goto('/');

  // 精选作品：3 张卡片
  const cards = page.locator('[data-testid^="featured-card-"]');
  await expect(cards).toHaveCount(3);
  evidence.featuredCards = true;

  // 点击卡片 1 → 载入编辑器
  await page.locator('[data-testid="featured-card-1"]').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible({ timeout: 10000 });

  expect(pageErrors).toEqual([]);
  evidence.clickLoadsEditor = true;
});

test.afterAll(async () => {
  writeFileSync(join(RES, 'home.json'), JSON.stringify(evidence, null, 2));
});
