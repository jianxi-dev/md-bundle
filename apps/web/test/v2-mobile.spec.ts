// 移动端适配验收 e2e（任务 2.7）：serial 模式 + evidence 落盘。
// 验收项：
//   ① 窄屏打开文档默认 preview 模式（mode-pane-preview 可见、mode-pane-editor 隐藏）
//   ② 左栏变底部抽屉（toggle 鸡蛋形钮存在，点击弹抽屉含 [文件|资源] 页签）
//   ③ 大纲按钮在工作区面板右上且不与页签条重叠（boundingBox 断言不交叉）
//   ④ more-btn 溢出菜单可达（含分享/主按钮/导出/复制正文）
//   ⑤ 无横向溢出（scrollWidth ≤ viewport）
//   ⑥ 1280 回归：桌面形态不变（左栏侧栏直接可见、动作区直接可见无 more 折叠）
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const FIX = join(here, 'fixtures');
const RES = join(here, '..', 'test-results');

const evidence = {
  tasks: '2.7',
  narrowPreviewDefault: false,
  railDrawer: false,
  outlineNoOverlap: false,
  moreMenu: false,
  noOverflow: false,
  desktopRegression: false,
};

test.describe.configure({ mode: 'serial' });

// ── 375×812 窄屏验收 ─────────────────────────────────────

test.describe('375×812 窄屏', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('窄屏打开文档默认 preview 模式', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('file-input').setInputFiles(join(FIX, 'hello.md'));

    // 窄屏默认 preview：preview 面板可见、editor 面板隐藏（不等 .cm-editor，避免矛盾）
    await expect(page.getByTestId('mode-pane-preview')).toBeVisible();
    await expect(page.getByTestId('mode-pane-editor')).toBeHidden();

    // preview 模式按钮已选中
    await expect(page.getByTestId('mode-preview-btn')).toHaveAttribute('aria-pressed', 'true');

    evidence.narrowPreviewDefault = true;
  });

  test('左栏变底部抽屉（鸡蛋形 toggle + 抽屉含页签）', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('md-bundle.left-rail'));
    await page.reload();
    await page.getByTestId('file-input').setInputFiles(join(FIX, 'hello.md'));
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible();

    // 桌面侧栏 toggle 不在 DOM 中（窄屏条件渲染，不渲染桌面组件）
    await expect(page.getByTestId('left-rail-toggle')).toHaveCount(0);

    // 移动端鸡蛋形抽屉 toggle 可见
    const mobileToggle = page.getByTestId('mobile-rail-toggle');
    await expect(mobileToggle).toBeVisible();

    // 左栏侧栏不在 DOM 中（窄屏条件渲染）
    await expect(page.getByTestId('left-rail')).toHaveCount(0);

    // 点击移动端 toggle → 底部抽屉弹出
    await mobileToggle.click();
    await expect(page.getByTestId('mobile-rail-drawer')).toBeVisible();

    // 抽屉含 [文件|资源] 页签
    await expect(page.getByTestId('left-rail-tab-files')).toBeVisible();
    await expect(page.getByTestId('left-rail-tab-assets')).toBeVisible();

    evidence.railDrawer = true;
  });

  test('大纲按钮在工作区面板右上且不与页签条重叠', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('file-input').setInputFiles({
      name: 'outline-mobile.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from('# 标题一\n\n段落\n\n## 标题二\n'),
    });
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible();

    // 大纲按钮可见
    const outlineBtn = page.getByTestId('outline-btn');
    await expect(outlineBtn).toBeVisible();

    // 获取大纲按钮和工作区面板的 boundingBox
    const outlineBox = await outlineBtn.boundingBox();
    const workspaceBox = await page.getByTestId('workspace-modes').boundingBox();

    expect(outlineBox).not.toBeNull();
    expect(workspaceBox).not.toBeNull();

    if (outlineBox && workspaceBox) {
      expect(outlineBox.x).toBeGreaterThanOrEqual(workspaceBox.x);
      expect(outlineBox.y).toBeGreaterThanOrEqual(workspaceBox.y);
      expect(outlineBox.x + outlineBox.width).toBeLessThanOrEqual(workspaceBox.x + workspaceBox.width);

      // tab bar 由模式切换按钮 (mode-edit-btn) 定位；outline 按钮 y 应 ≥ 模式按钮底部
      const tabBarBtn = page.getByTestId('mode-edit-btn');
      const tabBarBtnBox = await tabBarBtn.boundingBox();
      if (tabBarBtnBox) {
        const tabBarBottom = tabBarBtnBox.y + tabBarBtnBox.height;
        expect(outlineBox.y).toBeGreaterThanOrEqual(tabBarBottom);
      }
    }

    evidence.outlineNoOverlap = true;
  });

  test('more-btn 溢出菜单可达（含分享/主按钮/导出/复制正文）', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('file-input').setInputFiles(join(FIX, 'hello.md'));
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible();

    // 移动端 more-btn 可见
    const moreBtn = page.getByTestId('more-menu-btn');
    await expect(moreBtn).toBeVisible();

    // 点击 more-btn → 溢出菜单弹出
    await moreBtn.click();
    const moreMenu = page.getByTestId('more-menu');
    await expect(moreMenu).toBeVisible();

    // 菜单含分享/保存/导出/复制正文
    await expect(moreMenu.getByTestId('more-share')).toBeVisible();
    await expect(moreMenu.getByTestId('more-save')).toBeVisible();
    await expect(moreMenu.getByTestId('more-export-md')).toBeVisible();
    await expect(moreMenu.getByTestId('more-copy-image')).toBeVisible();

    evidence.moreMenu = true;
  });

  test('无横向溢出（scrollWidth ≤ viewport）', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('file-input').setInputFiles(join(FIX, 'hello.md'));
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible();

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(scrollWidth).toBeLessThanOrEqual(viewportWidth);

    evidence.noOverflow = true;
  });
});

// ── 1280 桌面回归 ─────────────────────────────────────────

test.describe('1280 桌面回归', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('桌面形态不变：左栏侧栏 + 动作区直接可见无 more 折叠', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('md-bundle.left-rail'));
    await page.reload();
    await page.getByTestId('file-input').setInputFiles(join(FIX, 'hello.md'));
    await expect(page.locator('.cm-editor').first()).toBeVisible();

    // 桌面默认 edit 模式
    await expect(page.getByTestId('mode-edit-btn')).toHaveAttribute('aria-pressed', 'true');

    // 桌面左栏 toggle 可见
    const desktopToggle = page.getByTestId('left-rail-toggle');
    await expect(desktopToggle).toBeVisible();

    // 移动端 toggle 不可见
    const mobileToggle = page.getByTestId('mobile-rail-toggle');
    await expect(mobileToggle).toHaveCount(0);

    // 桌面 more-btn 不可见
    const moreBtn = page.getByTestId('more-menu-btn');
    await expect(moreBtn).toHaveCount(0);

    // 桌面动作区按钮直接可见
    await expect(page.getByTestId('save-btn')).toBeVisible();
    await expect(page.getByTestId('export-btn')).toBeVisible();
    await expect(page.getByTestId('doc-image-btn')).toBeVisible();
    await expect(page.getByTestId('share-menu-btn')).toBeVisible();
    await expect(page.getByTestId('theme-btn')).toBeVisible();

    evidence.desktopRegression = true;
  });
});

// ── 截图 + evidence 落盘 ──────────────────────────────────

test.afterAll(async ({ browser }) => {
  // 375 截图（窄屏 preview 模式，等 preview 面板而非 .cm-editor）
  const narrowCtx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const narrowPage = await narrowCtx.newPage();
  await narrowPage.goto('http://localhost:4173/');
  await narrowPage.getByTestId('file-input').setInputFiles(join(FIX, 'hello.md'));
  await narrowPage.getByTestId('mode-pane-preview').waitFor({ state: 'visible' });
  await narrowPage.screenshot({ path: join(RES, 'v2-mobile-375.png'), fullPage: true });
  await narrowCtx.close();

  // 1280 截图
  const wideCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const widePage = await wideCtx.newPage();
  await widePage.goto('http://localhost:4173/');
  await widePage.getByTestId('file-input').setInputFiles(join(FIX, 'hello.md'));
  await widePage.locator('.cm-editor').first().waitFor();
  await widePage.screenshot({ path: join(RES, 'v2-mobile-1280.png'), fullPage: true });
  await wideCtx.close();

  writeFileSync(join(RES, 'v2-mobile.json'), JSON.stringify(evidence, null, 2) + '\n');
});
