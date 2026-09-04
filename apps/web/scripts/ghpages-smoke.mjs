// GH Pages interim production smoke (ops script — evidence saved to test-results/).
// Verifies: 3 pages 200 + content, gallery example opens .mdpkg in the sandbox iframe, zero pageerrors.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://jianxi-dev.github.io/md-bundle';
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'test-results');
mkdirSync(OUT, { recursive: true });

const facts = { tasks: '7.1-ghpages', base: BASE, index200: false, spec200: false, about200: false, exampleOpens: false, pageerrors: 0, consoleErrors: [] };

const browser = await chromium.launch({ channel: 'chromium' });
const page = await browser.newPage();
page.on('pageerror', (e) => { facts.pageerrors++; console.error('PAGEERROR:', e.message); });

try {
  const res = await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 60000 });
  facts.index200 = res?.status() === 200;
  await page.getByText('分享 Markdown，不再裂图。').waitFor({ timeout: 15000 });
  await page.screenshot({ path: join(OUT, 'ghpages-01-home.png'), fullPage: false });

  // Gallery example -> .mdpkg sandbox iframe
  await page.getByTestId('example-mdpkg-demo').click();
  await page.getByTestId('mdpkg-frame').waitFor({ timeout: 20000 });
  await page.getByTestId('validation-pass').waitFor({ timeout: 20000 });
  facts.exampleOpens = true;
  await page.screenshot({ path: join(OUT, 'ghpages-02-mdpkg.png'), fullPage: false });

  const spec = await page.goto(BASE + '/spec.html', { waitUntil: 'networkidle', timeout: 60000 });
  facts.spec200 = spec?.status() === 200;
  await page.getByRole('heading', { name: /格式规范/ }).waitFor({ timeout: 15000 });
  await page.screenshot({ path: join(OUT, 'ghpages-03-spec.png'), fullPage: false });

  const about = await page.goto(BASE + '/about.html', { waitUntil: 'networkidle', timeout: 60000 });
  facts.about200 = about?.status() === 200;
  await page.getByRole('heading', { name: /关于/ }).waitFor({ timeout: 15000 });
  await page.screenshot({ path: join(OUT, 'ghpages-04-about.png'), fullPage: false });
} catch (e) {
  console.error('SMOKE FAILURE:', e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
  writeFileSync(join(OUT, 'ghpages-smoke.json'), JSON.stringify(facts, null, 2) + '\n');
  console.log(JSON.stringify(facts, null, 2));
}