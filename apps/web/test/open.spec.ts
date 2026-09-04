// 文件打开 e2e：选择 + 拖拽的 UI 路径。覆盖：
//   - valid.mdpkg → sandbox iframe 完整预览（内联图片 data URI）
//   - corrupted.zip → 确定性错误告警，无白屏，无未捕获异常
//   - 非 ZIP 但改名 .mdpkg → 错误告警（包装层 { error }）
//   - .md → 编辑器 + 实时预览分栏
//   - 打开新文件替换当前文档
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const FIX = join(here, 'fixtures');
const RES = join(here, '..', 'test-results');
const read = (name: string) => readFileSync(join(FIX, name));

const fileInput = (page: Page) => page.getByTestId('file-input');
const dropzone = (page: Page) => page.getByTestId('dropzone');
const errorAlert = (page: Page) => page.getByRole('alert');

test('dropzone renders on load', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'MD-Bundle' })).toBeVisible();
  await expect(dropzone(page)).toBeVisible();
});

test('valid .mdpkg → sandbox iframe preview, no pageerror', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  await page.goto('/');
  await fileInput(page).setInputFiles(join(FIX, 'valid.mdpkg'));

  const frame = page.frameLocator('iframe[data-testid="mdpkg-frame"]');
  await expect(frame.locator('h1').first()).toBeVisible();

  const srcDoc = await page.getByTestId('mdpkg-frame').getAttribute('srcdoc');
  expect(srcDoc).toContain('data:image/png;base64,');
  await expect(page.getByTestId('validation-pass')).toBeVisible();
  await expect(page.getByTestId('validation-pass')).toContainText('通过');
  expect(pageErrors).toEqual([]);

  await page.screenshot({ path: join(RES, 'open-ok.png'), fullPage: false });
});

test('corrupted .mdpkg → error alert, no white screen, no pageerror', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  await page.goto('/');
  await fileInput(page).setInputFiles(join(FIX, 'corrupted.zip'));

  await expect(errorAlert(page)).toBeVisible();
  await expect(errorAlert(page)).toContainText('MDPKG-E303');
  await expect(page.getByRole('heading', { name: 'MD-Bundle' })).toBeVisible();
  await expect(page.getByRole('button', { name: '重新选择' })).toBeVisible();
  expect(pageErrors).toEqual([]);

  await page.screenshot({ path: join(RES, 'open-fail-corrupt.png'), fullPage: false });
});

test('non-ZIP bytes renamed .mdpkg → error alert (deterministic wrapper), no white screen', async ({ page }) => {
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

  await page.screenshot({ path: join(RES, 'open-fail-nonzip.png'), fullPage: false });
});

test('.md → editor + live preview split view', async ({ page }) => {
  await page.goto('/');
  await fileInput(page).setInputFiles({
    name: 'notes.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# Hello World\n\nBody text\n'),
  });

  await expect(page.locator('.cm-editor')).toBeVisible();
  const preview = page.locator('.markdown-body');
  await expect(preview.locator('h1').first()).toHaveText('Hello World');
  await expect(page.getByText('Markdown', { exact: true })).toBeVisible();
});

test('opening a second file replaces the current document', async ({ page }) => {
  await page.goto('/');
  await fileInput(page).setInputFiles(join(FIX, 'valid.mdpkg'));
  await expect(page.getByTestId('mdpkg-frame')).toBeVisible();

  await fileInput(page).setInputFiles({
    name: 'second.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# Second\n'),
  });
  await expect(page.locator('.cm-editor')).toBeVisible();
  await expect(page.locator('.markdown-body h1').first()).toHaveText('Second');
  await expect(page.getByTestId('mdpkg-frame')).toHaveCount(0);
});
