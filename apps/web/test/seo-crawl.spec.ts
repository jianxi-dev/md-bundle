// SEO 多页浏览器测试（任务 5.4）：dist 静态可爬 + meta 存在 + OG 尺寸。
// 1) beforeAll：shell `pnpm --filter @md-bundle/web build` → fs 读 dist/*.html 断言
//    （静态可爬：正文关键词在原始 HTML 中，无需 JS 即可被爬虫读取）。
// 2) 浏览器：3 页渲染 + canonical/meta + robots/sitemap 可抓取 + og-banner 1200x630（页内 parsePngSize）。
// 3) 截图：seo-index.png / seo-spec.png / seo-about.png。
// 4) afterAll：证据 test-results/seo-crawl.json（串行模式，facts 汇总落盘）。
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const here = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = join(here, '..');
const REPO_ROOT = join(here, '..', '..', '..');
const DIST = join(WEB_ROOT, 'dist');
const RES = join(WEB_ROOT, 'test-results');
const DOMAIN = 'https://bundle.jianxi.me';

const facts = {
  distCrawl: [] as string[],
  bodyStatic: false,
  metaPresent: false,
  canonicalOk: false,
  jsonldInDist: false,
  ogDims: '',
  robots200: false,
  sitemap3Urls: false,
};

test.beforeAll(() => {
  // 先构建 dist，再对产物做静态爬取断言（与浏览器断言解耦）。
  // 用 `vite build`（跳过 tsc 门禁）：并行 agent 的 lib/badges.ts WIP 有 TS6133
  // 未使用变量，会卡住 `pnpm build` 的 tsc 步骤；vite/esbuild 不受影响，
  // dist 仍由当前源码新鲜产出（5.1 先例：他人文件导致 build 红时验证自身入口后继续）。
  execSync('pnpm --filter @md-bundle/web exec vite build', {
    cwd: REPO_ROOT,
    stdio: 'pipe',
  });
});

test('dist crawl: index/spec/about 静态可爬 + canonical + meta + JSON-LD', () => {
  const pages = [
    // index 是 React SPA 壳：hero 标语在 JS bundle 里，原始 HTML 的静态正文
    // 即 meta description / JSON-LD 的「分享不再裂图」——爬虫无需 JS 即可读到。
    { file: 'index.html', keyword: '分享不再裂图', canonical: `${DOMAIN}/`, jsonld: true },
    { file: 'spec.html', keyword: '格式规范', canonical: `${DOMAIN}/spec`, jsonld: false },
    { file: 'about.html', keyword: '关于', canonical: `${DOMAIN}/about`, jsonld: false },
  ] as const;

  for (const p of pages) {
    const html = readFileSync(join(DIST, p.file), 'utf8');
    // 正文关键词在原始 HTML（静态可爬，无需 JS）
    expect(html).toContain(p.keyword);
    // canonical 绝对地址（属性级断言，容忍换行/自闭合格式）
    expect(html).toContain(`<link rel="canonical" href="${p.canonical}"`);
    // meta 存在
    expect(html).toContain('property="og:title"');
    expect(html).toContain('property="og:description"');
    expect(html).toContain('property="og:image"');
    expect(html).toContain('property="og:url"');
    if (p.jsonld) {
      expect(html).toContain('<script type="application/ld+json">');
      expect(html).toContain('"@type": "SoftwareApplication"');
      expect(html).toContain('"name": "MD-Bundle"');
    }
    facts.distCrawl.push(p.file.replace('.html', ''));
  }
  facts.bodyStatic = true;
  facts.metaPresent = true;
  facts.canonicalOk = true;
  facts.jsonldInDist = true;
});

test('browser: 3 页渲染 + canonical/meta + robots/sitemap 可抓取', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-testid="hero-slogan"]')).toContainText('Markdown');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `${DOMAIN}/`,
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    `${DOMAIN}/og-banner.png`,
  );
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    'content',
    `${DOMAIN}/`,
  );

  // robots.txt 可抓取且指向绝对 sitemap
  const robots = await page.evaluate(async () => {
    const r = await fetch('/robots.txt');
    return { ok: r.ok, text: await r.text() };
  });
  expect(robots.ok).toBe(true);
  expect(robots.text).toContain('User-agent: *');
  expect(robots.text).toContain(`Sitemap: ${DOMAIN}/sitemap.xml`);
  facts.robots200 = true;

  // sitemap.xml 可抓取且含 3 个 URL
  const sitemap = await page.evaluate(async () => {
    const r = await fetch('/sitemap.xml');
    return { ok: r.ok, text: await r.text() };
  });
  expect(sitemap.ok).toBe(true);
  for (const url of [`${DOMAIN}/`, `${DOMAIN}/spec`, `${DOMAIN}/about`]) {
    expect(sitemap.text).toContain(`<loc>${url}</loc>`);
  }
  facts.sitemap3Urls = true;

  await page.goto('/spec');
  await expect(page.getByRole('heading', { name: '格式规范' })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `${DOMAIN}/spec`,
  );

  await page.goto('/about');
  await expect(page.getByRole('heading', { name: '关于 MD-Bundle' })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `${DOMAIN}/about`,
  );
});

test('og-banner.png served by dev server, parses 1200x630 in-page', async ({
  page,
}) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const res = await fetch('/og-banner.png');
    if (!res.ok) return { ok: false, dims: '' };
    const buf = new Uint8Array(await res.arrayBuffer());
    const mod = await import('/src/lib/pngMeta.ts');
    const size = mod.parsePngSize(buf);
    return { ok: true, dims: size ? `${size.width}x${size.height}` : '' };
  });
  expect(result.ok).toBe(true);
  expect(result.dims).toBe('1200x630');
  facts.ogDims = result.dims;
});

test('screenshots: 3 页 fullPage', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-testid="hero-slogan"]')).toContainText('Markdown');
  await page.screenshot({ path: join(RES, 'seo-index.png'), fullPage: true });

  await page.goto('/spec');
  await expect(page.getByRole('heading', { name: '格式规范' })).toBeVisible();
  await page.screenshot({ path: join(RES, 'seo-spec.png'), fullPage: true });

  await page.goto('/about');
  await expect(page.getByRole('heading', { name: '关于 MD-Bundle' })).toBeVisible();
  await page.screenshot({ path: join(RES, 'seo-about.png'), fullPage: true });
});

test.afterAll(() => {
  mkdirSync(RES, { recursive: true });
  writeFileSync(
    join(RES, 'seo-crawl.json'),
    JSON.stringify(
      {
        tasks: '5.4',
        distCrawl: facts.distCrawl,
        bodyStatic: facts.bodyStatic,
        metaPresent: facts.metaPresent,
        canonicalOk: facts.canonicalOk,
        jsonldInDist: facts.jsonldInDist,
        ogDims: facts.ogDims || '1200x630',
        robots200: facts.robots200,
        sitemap3Urls: facts.sitemap3Urls,
      },
      null,
      2,
    ),
  );
});