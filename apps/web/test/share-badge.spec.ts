// 分享/徽章收口 e2e（任务 6.4）—— 真实 UI 全链路：
//   - 空态：分享按钮禁用（canShare false）
//   - 打开 hello.md → first-open 解锁 toast（解锁徽章：首次打开）→ reload 持久化 →
//     再次打开不重复弹（localStorage 状态断言 + 300ms 无 toast）
//   - 分享：剪贴板授权 → 已复制到剪贴板；剪贴板拒绝（确定性 stub）→ 下载兜底
//     share-card.png（PNG 魔数 + 尺寸 ≥ 600×300 + SVG byline ?ref=md-share）
//   - 保存 .mdpkg（带图）→ first-pack toast；导出 PNG → first-png toast
//   - 阶梯：addInitScript 预置 exportCount=2 → 一次导出 → export-master rare toast
// 证据：test-results/share-badge.json（afterAll 汇总，串行模式）。
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { parsePngSize } from '../src/lib/pngMeta';

test.describe.configure({ mode: 'serial' });

const here = dirname(fileURLToPath(import.meta.url));
const FIX = join(here, 'fixtures');
const IMGS = join(FIX, 'imgs');
const RES = join(here, '..', 'test-results');

const facts = {
  shareDisabledEmpty: false,
  shareCopied: false,
  shareFallbackDownload: false,
  badgeFirstPack: false,
  badgeFirstPng: false,
  badgeLadder: false,
  badgePersist: false,
  badgeNoRepeatToast: false,
  pngMagicByline: false,
};

const openMd = async (page: Page, name = 'hello.md') => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(join(FIX, name));
  await expect(page.locator('.cm-editor').first()).toBeVisible();
  await expect(page.locator('.cm-content').first()).toContainText('Hello');
};

const clickExport = async (page: Page, format: string) => {
  await page.getByTestId('export-btn').click();
  await page.getByTestId(`export-${format}`).click();
};

test('空态：无顶栏（Landing 全页），有文档后分享按钮可用', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('share-card-btn')).toHaveCount(0);
  await openMd(page);
  await expect(page.getByTestId('share-card-btn')).toBeVisible();
  facts.shareDisabledEmpty = true;
});

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
  await expect(page.locator('.cm-editor').first()).toBeVisible();
  await page.waitForTimeout(300);
  await expect(page.getByTestId('badge-toast')).toHaveCount(0);
  facts.badgeNoRepeatToast = true;
});

test('分享：剪贴板授权 → 已复制到剪贴板', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: 'http://localhost:4173',
  });
  await openMd(page);
  await page.getByTestId('share-card-btn').click();
  await expect(page.getByTestId('share-card-status')).toContainText('已复制到剪贴板');
  facts.shareCopied = true;
});

test('分享：剪贴板拒绝 → 下载兜底 share-card.png（PNG 魔数 + byline）', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { write: async () => { throw new Error('denied'); } },
      configurable: true,
    });
    delete (window as typeof window & { showSaveFilePicker?: unknown }).showSaveFilePicker;
    delete (window as typeof window & { showDirectoryPicker?: unknown }).showDirectoryPicker;
    delete (window as typeof window & { showOpenFilePicker?: unknown }).showOpenFilePicker;
  });
  await openMd(page);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('share-card-btn').click(),
  ]);
  expect(download.suggestedFilename()).toBe('share-card.png');
  const path = await download.path();
  expect(path).not.toBeNull();
  const bytes = readFileSync(path!);
  expect(Array.from(bytes.subarray(0, 8))).toEqual([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const size = parsePngSize(new Uint8Array(bytes));
  expect(size).not.toBeNull();
  expect(size!.width).toBeGreaterThanOrEqual(600);
  expect(size!.height).toBeGreaterThanOrEqual(300);
  facts.shareFallbackDownload = true;

  // byline 出现：SVG 字符串级断言（栅格内文本不可直接断言）
  const byline = await page.evaluate(async () => {
    const mod = await import('/src/lib/shareCard.ts');
    const svg = mod.shareCardSvg(
      mod.buildShareCardHtml({
        title: 'hello.md',
        markdown: '# Hello',
        stats: { chars: 7, images: 0 },
      }),
    );
    return svg.includes('?ref=md-share') && svg.includes('Made with MD-Bundle');
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
  await page.getByTestId('import-images-input').setInputFiles(join(IMGS, 'red.png'));
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