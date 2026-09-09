// 保存/导出 e2e（任务 4.1）：内容驱动保存 + 导出下拉四格式，真实下载事件断言。
//   - hello.md + 拖入图片 → 保存 → .mdpkg（PK 魔数），落盘 test-results/save-e2e-ok.mdpkg
//   - 无图 .md → 保存 → .md（内容一致）
//   - invalid-manifest.mdpkg → 保存 → 重打包 .mdpkg（PK 魔数）
//   - 导出下拉：HTML → .html 含 Made with 本兜 bundle.jianxi.me；PNG → .png 魔数 + 尺寸
//   - 空文档导出 PNG → 内联错误提示（role=status），无下载
// 证据：test-results/save-e2e.json（afterAll 汇总）。
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { parsePngSize } from '../src/lib/pngMeta';
import { dropImages } from './dropImage';

// 跨测试共享证据状态 + afterAll 汇总 —— 必须串行（fullyParallel 会拆 worker，模块状态不可见）。
test.describe.configure({ mode: 'serial' });

const here = dirname(fileURLToPath(import.meta.url));
const FIX = join(here, 'fixtures');
const IMGS = join(FIX, 'imgs');
const RES = join(here, '..', 'test-results');

const facts = {
  mdpkgDownloaded: false,
  mdDownloaded: false,
  repackDownloaded: false,
  htmlExported: false,
  pngExported: false,
};

const openMd = async (page: Page, name = 'hello.md') => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(join(FIX, name));
  // Product defaults to preview mode; switch to edit mode to access editor
  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible();
};

const openAssetsPanel = async (page: Page) => {
  const rail = page.getByTestId('left-rail');
  if ((await rail.count()) === 0 || (await rail.isHidden())) {
    await page.getByTestId('left-rail-toggle').click();
  }
  await expect(rail).toBeVisible();
  await page.getByTestId('left-rail-tab-assets').click();
};

const clickExport = async (page: Page, format: string) => {
  await page.getByTestId('export-btn').click();
  await page.getByTestId(`export-${format}`).click();
};

test('hello.md + 拖入图片 → 保存 → .mdpkg 下载（PK 魔数）', async ({ page }) => {
  // Mock FSA unavailable to force download fallback (save-as path triggers native picker, not download)
  await page.addInitScript(() => {
    // @ts-expect-error - remove FSA APIs to force download path
    delete (window as typeof window & { showSaveFilePicker?: unknown }).showSaveFilePicker;
    delete (window as typeof window & { showDirectoryPicker?: unknown }).showDirectoryPicker;
    delete (window as typeof window & { showOpenFilePicker?: unknown }).showOpenFilePicker;
  });
  await openMd(page);
  await openAssetsPanel(page);
  await dropImages(page, [{ name: 'red.png', mimeType: 'image/png', data: readFileSync(join(IMGS, 'red.png')) }]);
  await expect(page.getByTestId('asset-list')).toContainText('red.png');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('save-btn').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.mdpkg$/);
  const path = await download.path();
  expect(path).not.toBeNull();
  const bytes = readFileSync(path!);
  expect(Array.from(bytes.subarray(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
  writeFileSync(join(RES, 'save-e2e-ok.mdpkg'), bytes);
  facts.mdpkgDownloaded = true;
});

test('无图 .md → 保存 → .md 下载（内容一致）', async ({ page }) => {
  await page.addInitScript(() => {
    delete (window as typeof window & { showSaveFilePicker?: unknown }).showSaveFilePicker;
    delete (window as typeof window & { showDirectoryPicker?: unknown }).showDirectoryPicker;
    delete (window as typeof window & { showOpenFilePicker?: unknown }).showOpenFilePicker;
  });
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles({
    name: 'plain.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# Plain\n\nNo images here.\n'),
  });
  // Product defaults to preview mode; switch to edit mode to access editor
  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('save-btn').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.md$/);
  const path = await download.path();
  expect(path).not.toBeNull();
  const content = readFileSync(path!, 'utf-8');
  expect(content).toContain('# Plain');
  facts.mdDownloaded = true;
});

test('invalid-manifest.mdpkg → 保存 → 重打包 .mdpkg（PK 魔数）', async ({ page }) => {
  await page.addInitScript(() => {
    delete (window as typeof window & { showSaveFilePicker?: unknown }).showSaveFilePicker;
    delete (window as typeof window & { showDirectoryPicker?: unknown }).showDirectoryPicker;
    delete (window as typeof window & { showOpenFilePicker?: unknown }).showOpenFilePicker;
  });
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(join(FIX, 'invalid-manifest.mdpkg'));
  // Product defaults to preview mode; switch to edit mode to access editor
  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('save-btn').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.mdpkg$/);
  const path = await download.path();
  expect(path).not.toBeNull();
  const bytes = readFileSync(path!);
  expect(Array.from(bytes.subarray(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
  facts.repackDownloaded = true;
});

test('导出下拉：HTML → .html 含 Made with 本兜 bundle.jianxi.me', async ({ page }) => {
  await openMd(page);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    clickExport(page, 'html'),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.html$/);
  const path = await download.path();
  expect(path).not.toBeNull();
  const content = readFileSync(path!, 'utf-8');
  expect(content).toContain('Made with 本兜 bundle.jianxi.me');
  facts.htmlExported = true;
});

test('导出下拉：PNG → .png 魔数 + 尺寸', async ({ page }) => {
  await openMd(page);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    clickExport(page, 'png'),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.png$/);
  const path = await download.path();
  expect(path).not.toBeNull();
  const bytes = readFileSync(path!);
  expect(Array.from(bytes.subarray(0, 8))).toEqual([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const size = parsePngSize(new Uint8Array(bytes));
  expect(size).not.toBeNull();
  expect(size!.width).toBeGreaterThanOrEqual(400);
  expect(size!.height).toBeGreaterThanOrEqual(100);
  facts.pngExported = true;
});

test('空文档导出 PNG → 内联错误提示（role=status），无下载', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles({
    name: 'empty.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(''),
  });
  // Product defaults to preview mode; switch to edit mode to access editor
  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible();

  let downloads = 0;
  page.on('download', () => {
    downloads++;
  });
  await clickExport(page, 'png');
  await expect(page.getByTestId('export-error')).toContainText('文档为空');
  await page.waitForTimeout(500);
  expect(downloads).toBe(0);
});

test.afterAll(() => {
  mkdirSync(RES, { recursive: true });
  writeFileSync(
    join(RES, 'save-e2e.json'),
    JSON.stringify({ tasks: '4.1', ...facts }, null, 2) + '\n',
  );
});