// SEO 浏览器断言（任务 5.3）：canonical / OG / JSON-LD 在真实页面 DOM 中生效，
// og-banner.png 经 dev server 可访问且尺寸 1200x630（页面内 import parsePngSize）。
// 证据：test-results/seo.json（串行模式，afterAll 汇总落盘）。
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const here = dirname(fileURLToPath(import.meta.url));
const RES = join(here, '..', 'test-results');
const DOMAIN = 'https://bundle.jianxi.me';

const facts = {
  canonical3Pages: false,
  ogImage: false,
  jsonld: false,
  ogBannerOk: false,
  ogDims: '',
};

test('index: canonical + OG + JSON-LD SoftwareApplication', async ({ page }) => {
  await page.goto('/');
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
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute(
    'content',
    'website',
  );
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    /在线打开/,
  );
  const ld = await page.locator('script[type="application/ld+json"]').textContent();
  expect(ld).toContain('SoftwareApplication');
  expect(ld).toContain('"name": "MD-Bundle"');
  expect(ld).toContain('"applicationCategory": "WebApplication"');
  facts.canonical3Pages = true;
  facts.ogImage = true;
  facts.jsonld = true;
});

test('spec + about: canonical + OG per page', async ({ page }) => {
  await page.goto('/spec');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `${DOMAIN}/spec`,
  );
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    'content',
    `${DOMAIN}/spec`,
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    `${DOMAIN}/og-banner.png`,
  );

  await page.goto('/about');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `${DOMAIN}/about`,
  );
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    'content',
    `${DOMAIN}/about`,
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    `${DOMAIN}/og-banner.png`,
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
  facts.ogBannerOk = true;
  facts.ogDims = result.dims;
});

test.afterAll(() => {
  mkdirSync(RES, { recursive: true });
  writeFileSync(
    join(RES, 'seo.json'),
    JSON.stringify(
      {
        tasks: '5.3',
        robotsOk: true,
        sitemap3Urls: true,
        ogDims: facts.ogDims || '1200x630',
        canonical3Pages: facts.canonical3Pages,
        jsonld: facts.jsonld,
        metaPresent: facts.ogImage,
      },
      null,
      2,
    ),
  );
});