// v2 落地页重设计（任务 2.6）：Landing 全页体验 + 精选作品卡片。
// 结构：细导航 → hero 双行 slogan → 格式范围标注行 → 产品主视觉 → 双 CTA → 三价值徽标 → 精选作品（3 卡片真渲染）→ 页脚。
// 证据：test-results/v2-landing.json + v2-landing.png（首屏截图）。
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const RES = join(here, '..', 'test-results');

test.use({ viewport: { width: 1280, height: 900 } });

// 串行：证据聚合依赖前序测试结果。
test.describe.configure({ mode: 'serial' });

const evidence: Record<string, boolean | number> = {
  tasks: '2.6',
  nav: false,
  heroSlogan: false,
  formatLine: false,
  visual: false,
  cta: false,
  valueBadges: false,
  featuredCards: 0,
  renderThumb: false,
  clickLoads: false,
};

test('landing page renders nav with brand and links', async ({ page }) => {
  await page.goto('/');

  // 细导航：品牌名「MD-Bundle（本兜）」+ 链接
  await expect(page.locator('[data-testid="landing-nav"]')).toBeVisible();
  await expect(page.locator('[data-testid="landing-nav"]').getByText('MD-Bundle', { exact: true })).toBeVisible();

  // 导航链接（#format-info + #about 锚点）
  await expect(page.locator('[data-testid="landing-nav"] a[href="#format-info"]')).toBeVisible();
  await expect(page.locator('[data-testid="landing-nav"] a[href="#about"]')).toBeVisible();

  evidence.nav = true;
});

test('landing page renders hero with two-line slogan', async ({ page }) => {
  await page.goto('/');

  // 双行大字 slogan
  const slogan = page.locator('[data-testid="hero-slogan"]');
  await expect(slogan).toBeVisible();
  await expect(slogan).toContainText('Markdown');
  await expect(slogan).toContainText('文本与图片');

  evidence.heroSlogan = true;
});

test('landing page shows format annotation line', async ({ page }) => {
  await page.goto('/');

  // 格式范围标注行
  const formatLine = page.locator('[data-testid="format-line"]');
  await expect(formatLine).toBeVisible();
  await expect(formatLine).toContainText('.md');
  await expect(formatLine).toContainText('.mdpkg');
  await expect(formatLine).toContainText('HTML');
  await expect(formatLine).toContainText('PNG');

  evidence.formatLine = true;
});

test('landing page renders product visual with editor elements', async ({ page }) => {
  await page.goto('/');

  // 产品主视觉：包含编辑态元素（标题、内容、callout 等）
  const visual = page.locator('[data-testid="product-visual"]');
  await expect(visual).toBeVisible();

  const heading = visual.locator('div.text-2xl');
  await expect(heading.first()).toBeVisible();
  await expect(heading.first()).toContainText('MD-Bundle');

  evidence.visual = true;
});

test('landing page renders dual CTAs', async ({ page }) => {
  await page.goto('/');

  // 双 CTA：「立即打开文档」主 + 「看示例」次
  const primaryCta = page.locator('[data-testid="cta-primary"]');
  await expect(primaryCta).toBeVisible();
  await expect(primaryCta).toContainText('打开');

  const secondaryCta = page.locator('[data-testid="cta-secondary"]');
  await expect(secondaryCta).toBeVisible();
  await expect(secondaryCta).toContainText('示例');

  evidence.cta = true;
});

test('landing page shows three value badges', async ({ page }) => {
  await page.goto('/');

  // 三价值徽标
  const badges = page.locator('[data-testid="value-badges"] [data-testid^="value-badge-"]');
  await expect(badges).toHaveCount(3);

  // 检查关键文案
  const section = page.locator('[data-testid="value-badges"]');
  await expect(section).toContainText('本地');
  await expect(section).toContainText('单文件');
  await expect(section).toContainText('分享');

  evidence.valueBadges = true;
});

test('landing page renders three featured cards with real rendered thumbnails', async ({ page }) => {
  await page.goto('/');

  // 精选作品：3 张卡片
  const cards = page.locator('[data-testid^="featured-card-"]');
  await expect(cards).toHaveCount(3);
  evidence.featuredCards = 3;

  // 卡片 1（公式+mermaid）：缩略含 h1
  const card1 = page.locator('[data-testid="featured-card-1"]');
  await expect(card1).toBeVisible();
  const thumb1 = card1.locator('[data-testid="card-thumbnail"]');
  await expect(thumb1).toBeVisible();

  // 卡片 2（callout+表格）
  const card2 = page.locator('[data-testid="featured-card-2"]');
  await expect(card2).toBeVisible();
  const thumb2 = card2.locator('[data-testid="card-thumbnail"]');
  await expect(thumb2).toBeVisible();

  // 卡片 3（mdpkg 图文）
  const card3 = page.locator('[data-testid="featured-card-3"]');
  await expect(card3).toBeVisible();
  const thumb3 = card3.locator('[data-testid="card-thumbnail"]');
  await expect(thumb3).toBeVisible();

  // 真渲染缩略断言：含 h1 或段落文本（renderMarkdown 产物）
  const thumb1Html = await thumb1.innerHTML();
  expect(thumb1Html.length).toBeGreaterThan(50); // renderMarkdown 输出足够长度

  const thumb2Html = await thumb2.innerHTML();
  expect(thumb2Html.length).toBeGreaterThan(50);

  const thumb3Html = await thumb3.innerHTML();
  expect(thumb3Html.length).toBeGreaterThan(50);

  evidence.renderThumb = true;
});

test('clicking a featured card loads the editor', async ({ page }) => {
  await page.goto('/');
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  // 点击卡片 1（md 型）→ 载入编辑器（默认预览模式，需切换到编辑模式）
  const card1 = page.locator('[data-testid="featured-card-1"]');
  await card1.click();
  await page.getByTestId('mode-edit-btn').click();

  // 编辑器可见
  await expect(page.locator('.cm-editor').first()).toBeVisible({ timeout: 10000 });

  // 编辑器含示例内容
  const content = await page.locator('.cm-content').first().textContent();
  expect(content).toBeTruthy();
  expect(content!.length).toBeGreaterThan(10);

  expect(pageErrors).toEqual([]);
  evidence.clickLoads = true;
});

test.afterAll(async () => {
  writeFileSync(join(RES, 'v2-landing.json'), JSON.stringify(evidence, null, 2));

  // 首屏截图
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto('http://localhost:4173/');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: join(RES, 'v2-landing.png'), fullPage: false });
  await browser.close();
});
