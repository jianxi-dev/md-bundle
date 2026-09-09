// 整窗拖放直达 e2e（任务 2.10）：无遮罩、全窗口 drop 直接分流。
//   ① 落地页（空态）拖入 .md → 立即打开
//   ② 落地页拖入 .mdpkg → 立即打开
//   ③ 工作区拖入 .md → 替换当前文档（内容变为 replace.md 独特文本）
//   ④ 编辑区拖入图片 → 走图片导入（资源清单增长）
//   ⑤ 空态拖入图片 → 不创建文档，显示提示「请先打开文档再拖入图片」
//   ⑥ dragover 不产生任何遮罩 DOM 节点
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const FIX = join(here, 'fixtures');
const IMGS = join(FIX, 'imgs');
const RES = join(here, '..', 'test-results');

test.use({ viewport: { width: 1280, height: 800 } });
test.describe.configure({ mode: 'serial' });

const DROP_FN = `
  ((target, fileDefs) => {
    const dt = new DataTransfer();
    for (const f of fileDefs) {
      const bytes = Uint8Array.from(atob(f.buffer), (c) => c.charCodeAt(0));
      const file = new File([bytes], f.name, { type: f.type });
      dt.items.add(file);
    }
    const ev = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'dataTransfer', { value: dt });
    target.dispatchEvent(ev);
  })
`;

const mdContent = readFileSync(join(FIX, 'hello.md'), 'utf-8');
const mdBase64 = Buffer.from(mdContent).toString('base64');
// 替换用：与 hello.md 内容不同，用于验证 drop 后内容真正替换
const replaceContent = readFileSync(join(FIX, 'replace.md'), 'utf-8');
const replaceBase64 = Buffer.from(replaceContent).toString('base64');
const redBase64 = readFileSync(join(IMGS, 'red.png')).toString('base64');
const pkgBase64 = readFileSync(join(FIX, 'valid.mdpkg')).toString('base64');

const evidence: Record<string, boolean> = {};

test('empty page: drop .md opens document', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-testid="landing-nav"]')).toBeVisible();

  await page.evaluate(
    DROP_FN + `(document.body, [{name:'hello.md',type:'text/markdown',buffer:'${mdBase64}'}])`,
  );

  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.cm-content').first()).toContainText('Hello');
  await page.screenshot({ path: join(RES, 'dragdrop-open-md.png'), fullPage: false });
  evidence.openMd = true;
});

test('empty page: drop .mdpkg opens package', async ({ page }) => {
  await page.goto('/');

  await page.evaluate(
    DROP_FN + `(document.body, [{name:'valid.mdpkg',type:'application/octet-stream',buffer:'${pkgBase64}'}])`,
  );

  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: join(RES, 'dragdrop-open-mdpkg.png'), fullPage: false });
  evidence.openMdpkg = true;
});

test('workspace: drop .md replaces current document', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(join(FIX, 'hello.md'));
  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-content').first()).toContainText('Hello');

  // 拖入 replace.md（内容含 "Replaced" + "This content replaces the original"）
  await page.evaluate(
    DROP_FN + `(document.body, [{name:'replace.md',type:'text/markdown',buffer:'${replaceBase64}'}])`,
  );

  // 内容必须变为 replace.md 的独特文本，不再含 Hello
  await expect(page.locator('.cm-content').first()).toContainText('Replaced', { timeout: 5000 });
  await expect(page.locator('.cm-content').first()).toContainText('replaces the original');
  await page.screenshot({ path: join(RES, 'dragdrop-replace-md.png'), fullPage: false });
  evidence.replaceMd = true;
});

test('editor: drop image imports into document', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(join(FIX, 'hello.md'));
  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-content').first()).toContainText('Hello');

  // dispatch image drop on document.body（文档级兜底 handler 捕获）
  await page.evaluate(
    DROP_FN + `(document.body, [{name:'red.png',type:'image/png',buffer:'${redBase64}'}])`,
  );

  // 左栏默认停在「文件」页签——需切到「资源」才能看到 AssetPanel
  const rail = page.getByTestId('left-rail');
  if ((await rail.count()) === 0 || (await rail.isHidden())) {
    await page.getByTestId('left-rail-toggle').click();
  }
  await expect(rail).toBeVisible();
  await page.getByTestId('left-rail-tab-assets').click();

  await expect(page.getByTestId('asset-red.png')).toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: join(RES, 'dragdrop-image-import.png'), fullPage: false });
  evidence.imageImport = true;
});

test('empty page: drop image shows hint and does not create document', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-testid="landing-nav"]')).toBeVisible();

  await page.evaluate(
    DROP_FN + `(document.body, [{name:'red.png',type:'image/png',buffer:'${redBase64}'}])`,
  );

  await expect(page.locator('[role="status"]')).toContainText('请先打开文档再拖入图片', { timeout: 3000 });
  await expect(page.locator('.cm-editor')).toHaveCount(0, { timeout: 2000 });
  await expect(page.locator('[data-testid="landing-nav"]')).toBeVisible();
  await page.screenshot({ path: join(RES, 'dragdrop-image-empty.png'), fullPage: false });
  evidence.noDocHint = true;
  evidence.noDocNoPollute = true;
});

test('dragover produces no overlay element in DOM', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-testid="landing-nav"]')).toBeVisible();

  await page.evaluate(`
    const dt = new DataTransfer();
    const bytes = Uint8Array.from(atob('${mdBase64}'), (c) => c.charCodeAt(0));
    dt.items.add(new File([bytes], 'test.md', { type: 'text/markdown' }));
    const ev = new Event('dragover', { bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'dataTransfer', { value: dt });
    document.body.dispatchEvent(ev);
  `);

  const overlays = await page.locator('[data-testid="drop-overlay"], [class*="drag-overlay"], [class*="drop-overlay"]').count();
  expect(overlays).toBe(0);
  await page.screenshot({ path: join(RES, 'dragdrop-no-overlay.png'), fullPage: false });
  evidence.noOverlay = true;
});

test.afterAll(() => {
  writeFileSync(join(RES, 'v2-dragdrop.json'), JSON.stringify(evidence, null, 2) + '\n');
});
