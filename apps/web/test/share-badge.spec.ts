// 徽章收口 e2e（任务 6.4）—— 真实 UI 全链路：
//   - 打开 hello.md → first-open 解锁 toast（解锁徽章：首次打开）→ reload 持久化 →
//     再次打开不重复弹（localStorage 状态断言 + 300ms 无 toast）
//   - 保存 .mdpkg（带图）→ first-pack toast；导出 PNG → first-png toast
//   - 阶梯：addInitScript 预置 exportCount=2 → 一次导出 → export-master rare toast
//   - 分享卡 SVG byline：?ref=md-share + Made with 本兜 bundle.jianxi.me（lib 级断言）
// 证据：test-results/share-badge.json（afterAll 汇总，串行模式）。
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { parsePngSize } from '../src/lib/pngMeta';
import { dropImages } from './dropImage';

test.describe.configure({ mode: 'serial' });

const here = dirname(fileURLToPath(import.meta.url));
const FIX = join(here, 'fixtures');
const IMGS = join(FIX, 'imgs');
const RES = join(here, '..', 'test-results');

const facts = {
  badgeFirstPack: false,
  badgeFirstPng: false,
  badgeLadder: false,
  badgePersist: false,
  badgeNoRepeatToast: false,
  pngMagicByline: false,
  zipDownloaded: false,
};

const openMd = async (page: Page, name = 'hello.md') => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(join(FIX, name));
  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible();
  await expect(page.locator('.cm-content').first()).toContainText('Hello');
};

const clickExport = async (page: Page, format: string) => {
  await page.getByTestId('export-btn').click();
  await page.getByTestId(`export-${format}`).click();
};

test('打开 hello.md → first-open toast；reload 持久化；再次打开不重复弹', async ({ page }) => {
  await openMd(page);

  const toast = page.getByTestId('badge-toast');
  await expect(toast).toBeVisible();
  await expect(toast).toContainText('解锁徽章');
  await expect(toast).toContainText('首次打开');
  await page.screenshot({ path: join(RES, 'share-badge-toast.png') });
  await toast.click(); // 手动关闭（不等 3.5s 自动消失）
  await expect(toast).toHaveCount(0);

  // 持久化：reload 后 localStorage 仍在（badges lib 经注入的 localStorage 落盘）
  await page.reload();
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('md-bundle.badges') ?? 'null'),
  );
  expect(stored).not.toBeNull();
  expect(stored.unlocked).toContain('first-open');
  expect(stored.exportCount).toBe(0);
  facts.badgePersist = true;

  // 再次打开同一文件 → first-open 已解锁 → 空结果 → 无新 toast
  await page.getByTestId('file-input').setInputFiles(join(FIX, 'hello.md'));
  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible();
  await page.waitForTimeout(300);
  await expect(page.getByTestId('badge-toast')).toHaveCount(0);
  facts.badgeNoRepeatToast = true;
});

test('分享卡 SVG byline：?ref=md-share + Made with 本兜 bundle.jianxi.me', async ({ page }) => {
  await page.goto('/');
  const byline = await page.evaluate(async () => {
    const mod = await import('/src/lib/shareCard.ts');
    const svg = mod.shareCardSvg(
      mod.buildShareCardHtml({
        title: 'hello.md',
        markdown: '# Hello',
        stats: { chars: 7, images: 0 },
      }),
    );
    return svg.includes('?ref=md-share') && svg.includes('Made with 本兜 bundle.jianxi.me');
  });
  expect(byline).toBe(true);
  facts.pngMagicByline = true;
});

test('保存 .mdpkg（带图）→ first-pack toast', async ({ page }) => {
  await page.addInitScript(() => {
    delete (window as typeof window & { showSaveFilePicker?: unknown }).showSaveFilePicker;
    delete (window as typeof window & { showDirectoryPicker?: unknown }).showDirectoryPicker;
    delete (window as typeof window & { showOpenFilePicker?: unknown }).showOpenFilePicker;
  });
  await openMd(page);
  const rail = page.getByTestId('left-rail');
  if ((await rail.count()) === 0 || (await rail.isHidden())) {
    await page.getByTestId('left-rail-toggle').click();
  }
  await expect(rail).toBeVisible();
  await page.getByTestId('left-rail-tab-assets').click();
  await dropImages(page, [
    { name: 'red.png', mimeType: 'image/png', data: readFileSync(join(IMGS, 'red.png')) },
  ]);
  await expect(page.getByTestId('asset-list')).toContainText('red.png');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('save-btn').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.mdpkg$/);

  const toast = page.getByTestId('badge-toast');
  await expect(toast).toBeVisible();
  await expect(toast).toContainText('解锁徽章');
  await expect(toast).toContainText('首次打包');
  facts.badgeFirstPack = true;
});

test('导出 PNG → first-png toast', async ({ page }) => {
  await page.addInitScript(() => {
    delete (window as typeof window & { showSaveFilePicker?: unknown }).showSaveFilePicker;
    delete (window as typeof window & { showDirectoryPicker?: unknown }).showDirectoryPicker;
    delete (window as typeof window & { showOpenFilePicker?: unknown }).showOpenFilePicker;
  });
  await openMd(page);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    clickExport(page, 'png'),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.png$/);

  const toast = page.getByTestId('badge-toast');
  await expect(toast).toBeVisible();
  await expect(toast).toContainText('解锁徽章');
  await expect(toast).toContainText('首次长图');
  facts.badgeFirstPng = true;
});

test('导出 .zip → 下载 .zip 文件（复用 mdpkg 打包字节）', async ({ page }) => {
  await page.addInitScript(() => {
    delete (window as typeof window & { showSaveFilePicker?: unknown }).showSaveFilePicker;
    delete (window as typeof window & { showDirectoryPicker?: unknown }).showDirectoryPicker;
    delete (window as typeof window & { showOpenFilePicker?: unknown }).showOpenFilePicker;
  });
  await openMd(page);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    clickExport(page, 'zip'),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.zip$/);
  facts.zipDownloaded = true;
});

test('阶梯：预置 exportCount=2 → 一次导出 → export-master rare', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'md-bundle.badges',
      JSON.stringify({
        version: 1,
        unlocked: ['first-open', 'first-pack', 'first-png'],
        tiers: { 'first-open': 'common', 'first-pack': 'common', 'first-png': 'common' },
        exportCount: 2,
      }),
    );
  });
  await openMd(page);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    clickExport(page, 'md'),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.md$/);

  const toast = page.getByTestId('badge-toast');
  await expect(toast).toBeVisible();
  await expect(toast).toContainText('解锁徽章');
  await expect(toast).toContainText('导出大师');
  await expect(toast).toContainText('rare');
  facts.badgeLadder = true;
});

test.afterAll(() => {
  mkdirSync(RES, { recursive: true });
  writeFileSync(
    join(RES, 'share-badge.json'),
    JSON.stringify({ tasks: '6.4', ...facts }, null, 2) + '\n',
  );
});