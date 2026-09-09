import { test, expect, type Page } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const FIX = join(here, 'fixtures');

const openMd = async (page: Page) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(join(FIX, 'hello.md'));
  // Product defaults to preview mode; switch to edit mode to access editor
  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible();
};

test('diag: html export — throw vs hang', async ({ page }) => {
  const logs: string[] = [];
  page.on('console', (msg) => logs.push(`[console.${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`));

  await openMd(page);
  await page.getByTestId('export-btn').click();

  // Register the download listener BEFORE triggering the export. The export
  // handler awaits buildHtmlDocument, so the download can fire while the
  // click action is still being processed — a listener registered after the
  // click misses the event (observed as a false "download-timeout").
  const downloadArm = page
    .waitForEvent('download', { timeout: 8000 })
    .then(() => 'download')
    .catch(() => 'download-timeout');
  const errorArm = page
    .getByTestId('export-error')
    .waitFor({ state: 'visible', timeout: 8000 })
    .then(() => 'export-error')
    .catch(() => 'no-error');

  await page.getByTestId('export-html').click();

  // Wait up to 8s for either a download or the error status.
  // Each arm resolves (never rejects) so a timeout is logged, not thrown —
  // this is a diagnostic, not an assertion.
  const outcome = await Promise.race([
    downloadArm,
    errorArm,
    new Promise((r) => setTimeout(() => r('neither'), 8000)),
  ]);

  console.log('OUTCOME:', outcome);
  console.log('LOGS:', JSON.stringify(logs, null, 2));

  if (outcome === 'export-error') {
    console.log('ERROR TEXT:', await page.getByTestId('export-error').textContent());
  }
  // Always pass — this is a diagnostic, not an assertion
  expect(true).toBe(true);
});