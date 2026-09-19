// 导出流水线 e2e：把 4 个重下载操作从 final-walkthrough 的串行旅程中拆出（P2 #187）。
// 根因：4 个串行 waitForEvent(30s) 的最坏情况和 = 120s = 整个旅程测试预算，
// 任意一个在 CI 负载下变慢即耗尽共享预算 → 必然踩线。
// 拆分后每个 test() 拥有独立预算，互不争夺，且可被 fullyParallel 并行调度。
// 证据：test-results/export-pipeline.json。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { parsePngSize } from '../src/lib/pngMeta';
import { dropImages } from './dropImage';

const here = dirname(fileURLToPath(import.meta.url));
const FIX = join(here, 'fixtures');
const IMGS = join(FIX, 'imgs');
const RES = join(here, '..', 'test-results');

// 单次下载预算：实测导出 1-3s，20s 已留 6× 余量；不再用 30s 以免最坏情况和逼近预算。
const DOWNLOAD_TIMEOUT = 20_000;

const evidence: Record<string, { pass: boolean; note: string }> = {};

const record = async (name: string, fn: () => Promise<void>) => {
  try {
    await fn();
    evidence[name] = { pass: true, note: 'ok' };
  } catch (e) {
    evidence[name] = {
      pass: false,
      note: e instanceof Error ? e.message.split('\n')[0] : String(e),
    };
  }
};

/** 打开 hello.md 并拖入 red.png —— 使文档含图片资源，导出走「内容驱动」分支。 */
const openDocWithAsset = async (page: Page) => {
  await page.addInitScript(() => {
    delete (window as typeof window & { showSaveFilePicker?: unknown }).showSaveFilePicker;
    delete (window as typeof window & { showDirectoryPicker?: unknown }).showDirectoryPicker;
    delete (window as typeof window & { showOpenFilePicker?: unknown }).showOpenFilePicker;
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  page.on('dialog', (d) => void d.accept());
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(join(FIX, 'hello.md'));
  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible();
  // 左栏收起时整体不渲染，asset-list 仅在展开且资源 tab 激活时存在。
  const rail = page.getByTestId('left-rail');
  if ((await rail.count()) === 0 || (await rail.isHidden())) {
    await page.getByTestId('left-rail-toggle').click();
  }
  await page.getByTestId('left-rail-tab-assets').click();
  await dropImages(page, [
    { name: 'red.png', mimeType: 'image/png', data: readFileSync(join(IMGS, 'red.png')) },
  ]);
  await expect(page.getByTestId('asset-list')).toContainText('资源清单 (1)');
};

test.describe('导出流水线', () => {
  test('保存 .mdpkg：内容驱动打包 + first-pack 徽章', async ({ page }) => {
    await openDocWithAsset(page);

    await record('save-mdpkg', async () => {
      const [dl] = await Promise.all([
        page.waitForEvent('download', { timeout: DOWNLOAD_TIMEOUT }),
        page.getByTestId('save-btn').click(),
      ]);
      expect(dl.suggestedFilename()).toMatch(/\.mdpkg$/);
      const p = await dl.path();
      expect(p).not.toBeNull();
      expect(Array.from(readFileSync(p!).subarray(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
      const toast = page.getByTestId('badge-toast');
      await expect(toast).toBeVisible();
      await expect(toast).toContainText('首次打包');
      await toast.click();
      await expect(toast).toHaveCount(0);
      await page.screenshot({ path: join(RES, 'export-01-mdpkg.png') });
    });
  });

  test('导出 HTML / PNG / .md：三种产物 + 导出徽章', async ({ page }) => {
    await openDocWithAsset(page);

    await record('export-html', async () => {
      await page.getByTestId('export-btn').click();
      const [dl] = await Promise.all([
        page.waitForEvent('download', { timeout: DOWNLOAD_TIMEOUT }),
        page.getByTestId('export-html').click(),
      ]);
      expect(dl.suggestedFilename()).toMatch(/\.html$/);
      const p = await dl.path();
      expect(p).not.toBeNull();
      const html = readFileSync(p!, 'utf-8');
      expect(html).toContain('Made with 本兜 bundle.jianxi.me');
      expect(html).toContain('data:image');
    });

    await record('export-png', async () => {
      await page.getByTestId('export-btn').click();
      const [dl] = await Promise.all([
        page.waitForEvent('download', { timeout: DOWNLOAD_TIMEOUT }),
        page.getByTestId('export-png').click(),
      ]);
      expect(dl.suggestedFilename()).toMatch(/\.png$/);
      const p = await dl.path();
      expect(p).not.toBeNull();
      const bytes = readFileSync(p!);
      expect(Array.from(bytes.subarray(0, 8))).toEqual([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);
      const size = parsePngSize(new Uint8Array(bytes));
      expect(size).not.toBeNull();
      expect(size!.width).toBeGreaterThanOrEqual(400);
      // PNG 导出触发 png-exported（首次长图）；latest-wins 下同时可能解锁导出大师。
      const toast = page.getByTestId('badge-toast');
      await expect(toast).toBeVisible();
      await expect(toast).toContainText('解锁徽章');
      expect(await toast.innerText()).toMatch(/首次长图|导出大师/);
      await toast.click();
      await expect(toast).toHaveCount(0);
    });

    await record('export-md', async () => {
      await page.getByTestId('export-btn').click();
      const [dl] = await Promise.all([
        page.waitForEvent('download', { timeout: DOWNLOAD_TIMEOUT }),
        page.getByTestId('export-md').click(),
      ]);
      expect(dl.suggestedFilename()).toMatch(/\.md$/);
      const p = await dl.path();
      expect(p).not.toBeNull();
      expect(readFileSync(p!, 'utf-8')).toContain('# Hello');
      await page.screenshot({ path: join(RES, 'export-02-triple.png') });
    });
  });
});

test.afterAll(() => {
  mkdirSync(RES, { recursive: true });
  const allPass = Object.values(evidence).every((s) => s.pass);
  writeFileSync(
    join(RES, 'export-pipeline.json'),
    JSON.stringify(
      { tasks: 'P2 #187', verdict: allPass ? 'APPROVE' : 'REJECT', steps: evidence },
      null,
      2,
    ) + '\n',
  );
});
