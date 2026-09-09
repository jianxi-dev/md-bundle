// 相对路径图片 e2e（Bug：`![alt](./image.png)` 不显示）：
// 导入 red.png 后，在编辑模式追加 `![dot](./red.png)`，断言：
//   - 编辑器行内图 widget 渲染为 <img src^=data:image/>（不再回退 [图片: ...] 文本）
//   - 预览窗格内两张图（`![red](red.png)` 与 `![dot](./red.png)`）均内联为 data URI
// 与 import.spec / v2-modes.spec 共享 dropImages 辅助与 dev server。
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { dropImages } from './dropImage';

const here = dirname(fileURLToPath(import.meta.url));
const FIX = join(here, 'fixtures');
const IMGS = join(FIX, 'imgs');
const RES = join(here, '..', 'test-results');

const openMdInEdit = async (page: Page) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(join(FIX, 'hello.md'));
  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible();
  await expect(page.locator('.cm-content').first()).toContainText('Hello');
};

test('相对路径 `![dot](./red.png)` 在编辑器 widget 与预览窗格均渲染', async ({ page }) => {
  await openMdInEdit(page);

  // 导入 red.png（hello.md 已有 `![red](red.png)` 引用 → 自动接线）
  await dropImages(page, [
    { name: 'red.png', mimeType: 'image/png', data: readFileSync(join(IMGS, 'red.png')) },
  ]);

  // 光标移到文末，追加 `./` 前缀引用（insertText 走 input 管线，不触发 slash keymap）
  const cmContent = page.getByTestId('mode-pane-editor').locator('.cm-content');
  await cmContent.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  await page.keyboard.insertText('![dot](./red.png)');
  // 光标落在插入文本末尾 → 两个 widget 都可见（无 selection-reveal 抑制）

  // 编辑器：两个行内图 widget，均渲染真实 <img src^=data:image/>
  const widgets = page.getByTestId('mode-pane-editor').locator('.cm-image-widget');
  await expect(widgets).toHaveCount(2);
  for (const w of await widgets.all()) {
    await expect(w.locator('img')).toHaveAttribute('src', /^data:image\//);
  }
  // 回归守卫：`./` 形式不得回退为占位文本
  await expect(page.getByTestId('mode-pane-editor').locator('.cm-image-fallback')).toHaveCount(0);

  // 预览窗格：两张图均内联为 data URI
  await page.getByTestId('mode-preview-btn').click();
  const previewImgs = page.locator('.preview-content img');
  await expect(previewImgs).toHaveCount(2);
  for (const img of await previewImgs.all()) {
    await expect(img).toHaveAttribute('src', /^data:image\//);
  }

  await page.screenshot({ path: join(RES, 'relative-image-preview.png'), fullPage: false });
});
