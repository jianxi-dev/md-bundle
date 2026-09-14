// mdpkg 打开集成 e2e（任务 2.4）：四类 fixture 覆盖。
//   - valid.mdpkg → edit 模式可编辑
//   - invalid-manifest.mdpkg → 校验失败面板可见（错误展示），仍进入 edit 模式
//   - corrupted.zip → error alert，无白屏
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

test('valid.mdpkg → edit mode, no pageerror', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  await page.goto('/');
  await fileInput(page).setInputFiles(join(FIX, 'valid.mdpkg'));

  // Product defaults to preview mode; switch to edit mode to access editor
  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible();
  // 缺陷 #82 回归锁：校验通过 → 不渲染任何校验面板（正常打开静默）
  await expect(page.getByTestId('validation-pass')).toHaveCount(0);
  await expect(page.getByTestId('validation-fail')).toHaveCount(0);
  expect(pageErrors).toEqual([]);

  await page.screenshot({ path: join(RES, 'integration-valid.png'), fullPage: false });
});

test('invalid-manifest.mdpkg → edit mode (校验失败面板可见，无错误页签), no pageerror', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  await page.goto('/');
  await fileInput(page).setInputFiles(join(FIX, 'invalid-manifest.mdpkg'));

  // Product defaults to preview mode; switch to edit mode to access editor
  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  // 缺陷 #82 契约：校验失败 → 错误面板必须可见（有错误才提示）
  await expect(page.getByTestId('validation-fail')).toBeVisible();
  await expect(page.getByTestId('validation-fail')).toContainText('校验未通过');
  expect(pageErrors).toEqual([]);

  await page.screenshot({ path: join(RES, 'integration-invalid.png'), fullPage: false });
});

test('corrupted.zip → error alert, no white screen, no pageerror', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  await page.goto('/');
  await fileInput(page).setInputFiles(join(FIX, 'corrupted.zip'));

  await expect(errorAlert(page)).toBeVisible();
  // 上游 mdpkg v0.3.0.0 对损坏 zip 改抛 "invalid zip data"（旧版为部分解包 + "无文档内容"）
  await expect(errorAlert(page)).toContainText('invalid zip');
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
  await expect(page.getByRole('heading', { name: 'MD-Bundle' })).toBeVisible();
  expect(pageErrors).toEqual([]);
});