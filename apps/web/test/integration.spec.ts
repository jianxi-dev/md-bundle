// mdpkg 打开集成 e2e（任务 2.4）：ValidationPanel 接线 + 四类 fixture 覆盖。
//   - valid.mdpkg → edit 模式 + validation-pass（通过态）
//   - invalid-manifest.mdpkg → validation-fail + validation-errors ≥1 li（E302），editor 仍渲染
//   - corrupted.zip → error alert，无 validation panel，无白屏
//   - not-mdpkg.bin（改名 .mdpkg）→ error alert
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const FIX = join(here, 'fixtures');
const RES = join(here, '..', 'test-results');
const read = (name: string) => readFileSync(join(FIX, name));

const fileInput = (page: Page) => page.getByTestId('file-input');
const errorAlert = (page: Page) => page.getByRole('alert');

test('valid.mdpkg → validation-pass panel + edit mode, no pageerror', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  await page.goto('/');
  await fileInput(page).setInputFiles(join(FIX, 'valid.mdpkg'));

  const panel = page.getByTestId('validation-pass');
  await panel.scrollIntoViewIfNeeded();
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('通过');

  await expect(page.locator('.cm-editor').first()).toBeVisible();
  expect(pageErrors).toEqual([]);

  await page.screenshot({ path: join(RES, 'integration-valid.png'), fullPage: false });
});

test('invalid-manifest.mdpkg → validation-fail + errors list, editor still renders, no pageerror', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  await page.goto('/');
  await fileInput(page).setInputFiles(join(FIX, 'invalid-manifest.mdpkg'));

  const panel = page.getByTestId('validation-fail');
  await panel.scrollIntoViewIfNeeded();
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('校验未通过');

  const errors = panel.getByTestId('validation-errors');
  await expect(errors.locator('li').first()).toBeVisible();
  await expect(errors.locator('li').first()).toContainText('MDPKG-E302');

  await expect(page.locator('.cm-editor').first()).toBeVisible();
  expect(pageErrors).toEqual([]);

  await page.screenshot({ path: join(RES, 'integration-invalid.png'), fullPage: false });
});

test('corrupted.zip → error alert, no validation panel, no white screen, no pageerror', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  await page.goto('/');
  await fileInput(page).setInputFiles(join(FIX, 'corrupted.zip'));

  await expect(errorAlert(page)).toBeVisible();
  await expect(errorAlert(page)).toContainText('MDPKG-E303');
  await expect(page.getByTestId('validation-pass')).toHaveCount(0);
  await expect(page.getByTestId('validation-fail')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'MD-Bundle' })).toBeVisible();
  await expect(page.getByRole('button', { name: '重新选择' })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('not-mdpkg.bin renamed .mdpkg → error alert, no white screen, no pageerror', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  await page.goto('/');
  await fileInput(page).setInputFiles({
    name: 'fake.mdpkg',
    mimeType: 'application/octet-stream',
    buffer: read('not-mdpkg.bin'),
  });

  await expect(errorAlert(page)).toBeVisible();
  await expect(errorAlert(page)).toContainText('不是有效的 .mdpkg 文件');
  await expect(errorAlert(page)).toContainText('MDPKG-E101');
  await expect(page.getByRole('heading', { name: 'MD-Bundle' })).toBeVisible();
  expect(pageErrors).toEqual([]);
});