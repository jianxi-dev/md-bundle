// 图片导入 e2e（任务 3.1）：批量选择（含自动接线 + 去重）+ 粘贴 + 文本粘贴 noop + 侧栏。
// 打开 hello.md（内含 `![red](red.png)` 既有引用）后：
//   - 批量导入 red.png + green.png → red 自动接线（不重复插入），green 光标处插入，侧栏 2 项
//   - 再次导入 red.png → 去重为 red_1.png，原引用不重复
//   - 粘贴图片（构造 ClipboardEvent + DataTransfer）→ 光标处插入引用 + 侧栏条目
//   - 粘贴文本 → 编辑器内容原样不动
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const FIX = join(here, 'fixtures');
const IMGS = join(FIX, 'imgs');
const RES = join(here, '..', 'test-results');

const openMd = async (page: Page) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(join(FIX, 'hello.md'));
  await expect(page.locator('.cm-editor').first()).toBeVisible();
  // Editor mounts empty; the value prop syncs in a later effect — wait for content
  // so `before` snapshots aren't captured mid-load (race surfaced by hero banner).
  await expect(page.locator('.cm-content').first()).toContainText('Hello');
};

// 展开左栏 + 切到资源页签（asset-list 仅在 LeftRail 展开且资源 tab 激活时可见）
const openAssetsPanel = async (page: Page) => {
  const rail = page.getByTestId('left-rail');
  if ((await rail.count()) === 0 || (await rail.isHidden())) {
    await page.getByTestId('left-rail-toggle').click();
  }
  await expect(rail).toBeVisible();
  await page.getByTestId('left-rail-tab-assets').click();
};

// Switch to source mode (decorations off) to read raw markdown text,
// since edit mode now renders widget decorations that replace raw text.
const docText = async (page: Page): Promise<string> => {
  const modeSourceBtn = page.getByTestId('mode-source-btn');
  if (await modeSourceBtn.isVisible()) {
    await modeSourceBtn.click();
    await expect(page.locator('.cm-content').first()).toBeVisible();
  }
  const text = await page.locator('.cm-content').first().innerText();
  // Switch back to edit mode for subsequent operations
  const modeEditBtn = page.getByTestId('mode-edit-btn');
  if (await modeEditBtn.isVisible()) {
    await modeEditBtn.click();
    await expect(page.locator('.cm-content').first()).toBeVisible();
  }
  return text;
};

const count = (text: string, needle: string): number =>
  (text.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length;

test('batch select: import + auto-wire + dedupe + sidebar', async ({ page }) => {
  await openMd(page);
  await openAssetsPanel(page);

  // 批量选择 red.png + green.png
  await page.getByTestId('import-images-input').setInputFiles([
    join(IMGS, 'red.png'),
    join(IMGS, 'green.png'),
  ]);

  // 侧栏：2 个资源，含路径名与大小
  const list = page.getByTestId('asset-list');
  await expect(list).toContainText('资源清单 (2)');
  await expect(list).toContainText('red.png');
  await expect(list).toContainText('green.png');
  await expect(list.getByTestId('asset-red.png')).toContainText('KB');

  // 自动接线：red.png 已有引用 → 不重复插入；green.png → 光标处插入 `![green.png](green.png)`
  const text = await docText(page);
  expect(count(text, '![red](red.png)')).toBe(1);
  expect(count(text, '![green.png](green.png)')).toBe(1);

  // 去重：再次导入 red.png → red_1.png，原资源不被覆盖、引用不重复
  await page.getByTestId('import-images-input').setInputFiles(join(IMGS, 'red.png'));
  await expect(list).toContainText('资源清单 (3)');
  await expect(list).toContainText('red_1.png');
  expect(count(await docText(page), '![red](red.png)')).toBe(1);

  await page.screenshot({ path: join(RES, 'import-batch.png'), fullPage: false });
});

test('paste image onto editor → reference at cursor + sidebar entry', async ({ page }) => {
  await openMd(page);
  await openAssetsPanel(page);
  const b64 = readFileSync(join(IMGS, 'shot.png')).toString('base64');

  await page.evaluate((base64) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], 'shot.png', { type: 'image/png' }));
    const el = document.querySelector('[data-testid="workspace-modes"]');
    if (!el) throw new Error('editor area not found');
    el.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
    );
  }, b64);

  await expect(page.getByTestId('asset-list')).toContainText('shot.png');
  expect(count(await docText(page), '![shot.png](shot.png)')).toBe(1);

  await page.screenshot({ path: join(RES, 'import-paste.png'), fullPage: false });
});

test('text paste → editor untouched, no asset added', async ({ page }) => {
  await openMd(page);
  await openAssetsPanel(page);
  const before = await docText(page);

  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(['plain text'], 'note.txt', { type: 'text/plain' }));
    const el = document.querySelector('[data-testid="workspace-modes"]');
    if (!el) throw new Error('editor area not found');
    el.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
    );
  });

  expect(await docText(page)).toBe(before);
  await expect(page.getByTestId('asset-list')).toContainText('资源清单 (0)');
});