// 大纲 + 左栏 e2e 验收（任务 2.4）：serial 模式 + evidence 落盘。
// 验收项：
//   ① LeftRail：260px 左栏、页签 [文件|资源]、默认收起、toggle 展开/收起
//   ② LeftRail 资源页签渲染 AssetPanel（data-testid=asset-list 不变）
//   ③ LeftRail 文件页签空态文案
//   ④ LeftRail 孤儿徽标点（left-rail-badge）
//   ⑤ OutlineMenu：hover 弹出、click 钉住、Esc 收起
//   ⑥ 大纲三模式跳转（edit/source → CM6 scrollIntoView；preview → DOM scrollIntoView）
//   ⑦ code-fence：代码块内 # 不出现在大纲
//   ⑧ 大纲项当前标题高亮
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { dropImages } from './dropImage';
import { UNDO_KEY } from './keys';

const here = dirname(fileURLToPath(import.meta.url));
const FIX = join(here, 'fixtures');
const RES = join(here, '..', 'test-results');

const evidence = {
  tasks: '2.4',
  leftRailToggle: false,
  leftRailTabs: false,
  leftRailAssetsTab: false,
  leftRailFilesEmptyState: false,
  leftRailOrphanBadge: false,
  outlineHover: false,
  outlinePinned: false,
  outlineEscClose: false,
  outlineEditScroll: false,
  outlineSourceScroll: false,
  outlinePreviewScroll: false,
  outlineCodeFence: false,
  outlineCurrentHighlight: false,
};

test.use({ viewport: { width: 1280, height: 800 } });
test.describe.configure({ mode: 'serial' });

// ── 左栏验收 ─────────────────────────────────────────────

test('LeftRail 默认收起 + toggle 展开/收起', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('md-bundle.left-rail'));
  await page.reload();
  await page.getByTestId('file-input').setInputFiles(join(FIX, 'hello.md'));
  // 切换到编辑模式以访问编辑器
  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible();

  // 左栏默认收起：不可见
  const rail = page.getByTestId('left-rail');
  await expect(rail).toBeHidden();

  // toggle 按钮始终可见
  const toggle = page.getByTestId('left-rail-toggle');
  await expect(toggle).toBeVisible();

  // 点击 toggle → 左栏展开
  await toggle.click();
  await expect(rail).toBeVisible();

  // 左栏宽度 260px
  const box = await rail.boundingBox();
  expect(box?.width).toBe(260);

  // 再次点击 → 收起
  await toggle.click();
  await expect(rail).toBeHidden();

  evidence.leftRailToggle = true;
});

test('LeftRail 页签 [文件|资源] + 切换', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(join(FIX, 'hello.md'));
  // 切换到编辑模式以访问编辑器
  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible();

  // 展开左栏
  await page.getByTestId('left-rail-toggle').click();
  const rail = page.getByTestId('left-rail');
  await expect(rail).toBeVisible();

  // 两个页签钮存在
  const tabFiles = page.getByTestId('left-rail-tab-files');
  const tabAssets = page.getByTestId('left-rail-tab-assets');
  await expect(tabFiles).toBeVisible();
  await expect(tabAssets).toBeVisible();

  // 默认选中文件页签（aria-selected）
  await expect(tabFiles).toHaveAttribute('aria-selected', 'true');

  // 点击资源页签
  await tabAssets.click();
  await expect(tabAssets).toHaveAttribute('aria-selected', 'true');
  await expect(tabFiles).toHaveAttribute('aria-selected', 'false');

  evidence.leftRailTabs = true;
});

test('LeftRail 资源页签渲染 AssetPanel', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(join(FIX, 'hello.md'));
  // 切换到编辑模式以访问编辑器
  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible();

  // 展开左栏 → 切到资源页签
  await page.getByTestId('left-rail-toggle').click();
  await page.getByTestId('left-rail-tab-assets').click();

  // AssetPanel 存在（data-testid=asset-list）
  await expect(page.getByTestId('asset-list')).toBeVisible();

  evidence.leftRailAssetsTab = true;
});

test('LeftRail 文件页签空态文案', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(join(FIX, 'hello.md'));
  // 切换到编辑模式以访问编辑器
  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible();

  // 展开左栏 → 文件页签（默认）
  await page.getByTestId('left-rail-toggle').click();
  const rail = page.getByTestId('left-rail');
  await expect(rail).toBeVisible();

  // 文件页签空态文案
  await expect(page.getByTestId('left-rail-tab-files')).toHaveAttribute('aria-selected', 'true');
  await expect(rail).toContainText('授权文件夹');

  evidence.leftRailFilesEmptyState = true;
});

test('LeftRail 孤儿资源时 toggle 显示徽标点', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(join(FIX, 'hello.md'));
  // 切换到编辑模式以访问编辑器
  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible();

  await page.getByTestId('left-rail-toggle').click();
  await expect(page.getByTestId('left-rail')).toBeVisible();
  await page.getByTestId('left-rail-tab-assets').click();
  await expect(page.getByTestId('asset-list')).toBeVisible();

  await dropImages(page, [
    {
      name: 'orphan.png',
      mimeType: 'image/png',
      data: Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
        0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90,
        0x77, 0x53, 0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8,
        0xcf, 0xc0, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33, 0x00, 0x00, 0x00,
        0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
      ]),
    },
  ]);
  await expect(page.getByTestId('asset-orphan.png')).toBeVisible({ timeout: 10000 });

  // 聚焦 CM6 → Cmd+Z 撤销文本插入（资产状态不受影响 → 形成孤儿）
  await page.locator('.cm-content').click();
  await page.keyboard.press(UNDO_KEY);
  await page.waitForTimeout(300);

  // 收起左栏 → 徽标点应出现
  await page.getByTestId('left-rail-toggle').click();
  await expect(page.getByTestId('left-rail')).toBeHidden();
  await expect(page.getByTestId('left-rail-badge')).toBeVisible();

  evidence.leftRailOrphanBadge = true;
});

// ── 大纲验收 ─────────────────────────────────────────────

test('OutlineMenu hover 弹出、click 钉住、Esc 收起', async ({ page }) => {
  await page.goto('/');
  // 打开含多标题文档
  await page.getByTestId('file-input').setInputFiles({
    name: 'outline-test.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# 标题一\n\n段落\n\n## 标题二\n\n更多\n'),
  });
  // 切换到编辑模式以访问编辑器
  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible();

  const btn = page.getByTestId('outline-btn');
  await expect(btn).toBeVisible();

  // hover → 浮层出现
  await btn.hover();
  const menu = page.getByTestId('outline-menu');
  await expect(menu).toBeVisible();
  evidence.outlineHover = true;

  // 移开鼠标 → 浮层消失（hover 模式）
  await page.mouse.move(0, 0);
  await expect(menu).toBeHidden();

  // click 钉住
  await btn.click();
  await expect(menu).toBeVisible();
  evidence.outlinePinned = true;

  // Esc 收起
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  evidence.outlineEscClose = true;
});

test('大纲项与当前标题高亮', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles({
    name: 'hl-test.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# 第一\n\n段落\n\n## 第二\n\n段落\n\n### 第三\n'),
  });
  // 切换到编辑模式以访问编辑器
  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible();

  // 钉住大纲
  await page.getByTestId('outline-btn').click();
  const menu = page.getByTestId('outline-menu');
  await expect(menu).toBeVisible();

  // 三个大纲项存在
  await expect(page.getByTestId('outline-item-0')).toBeVisible();
  await expect(page.getByTestId('outline-item-1')).toBeVisible();
  await expect(page.getByTestId('outline-item-2')).toBeVisible();

  // 至少一个 outline-current 高亮
  const currentCount = await page.getByTestId('outline-current').count();
  expect(currentCount).toBeGreaterThanOrEqual(1);

  evidence.outlineCurrentHighlight = true;
});

test('code-fence 内 # 不出现在大纲', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles({
    name: 'fence-test.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# 真标题\n\n```\n# 假标题\n## 也是假的\n```\n\n## 真二级\n'),
  });
  // 切换到编辑模式以访问编辑器
  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible();

  // 钉住大纲
  await page.getByTestId('outline-btn').click();
  const menu = page.getByTestId('outline-menu');
  await expect(menu).toBeVisible();

  // 只有 2 个大纲项（真标题 + 真二级），不含 fence 内的假标题
  await expect(page.getByTestId('outline-item-0')).toBeVisible();
  await expect(page.getByTestId('outline-item-1')).toBeVisible();
  await expect(page.getByTestId('outline-item-2')).toBeHidden();

  evidence.outlineCodeFence = true;
});

test('编辑/源码模式点击大纲项 → CM6 滚动到标题', async ({ page }) => {
  await page.goto('/');
  // 构造长文档，确保有滚动
  const lines = ['# 起始'];
  for (let i = 0; i < 30; i++) lines.push(`段落${i}`);
  lines.push('## 目标标题');
  for (let i = 0; i < 30; i++) lines.push(`段落${i}`);
  await page.getByTestId('file-input').setInputFiles({
    name: 'scroll-test.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(lines.join('\n') + '\n'),
  });
  // 切换到编辑模式以访问编辑器
  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible();

  // 确保在 edit 模式
  await page.getByTestId('mode-edit-btn').click();

  // 钉住大纲
  await page.getByTestId('outline-btn').click();
  const menu = page.getByTestId('outline-menu');
  await expect(menu).toBeVisible();

  // 点击「目标标题」（index 1）
  await page.getByTestId('outline-item-1').click();

  // CM6 编辑器滚动（scrollEl.scrollTop 变化）
  const scrollEl = page.locator('.cm-editor .cm-scroller');
  const scrollTop = await scrollEl.evaluate((el) => el.scrollTop);
  expect(scrollTop).toBeGreaterThan(0);

  evidence.outlineEditScroll = true;
});

test('源码模式点击大纲项 → CM6 滚动', async ({ page }) => {
  await page.goto('/');
  const lines = ['# 起始'];
  for (let i = 0; i < 30; i++) lines.push(`段落${i}`);
  lines.push('## 目标');
  for (let i = 0; i < 30; i++) lines.push(`段落${i}`);
  await page.getByTestId('file-input').setInputFiles({
    name: 'src-scroll.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(lines.join('\n') + '\n'),
  });
  // 切换到编辑模式以访问编辑器
  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible();

  // 切到源码模式
  await page.getByTestId('mode-source-btn').click();

  // 钉住大纲
  await page.getByTestId('outline-btn').click();
  const menu = page.getByTestId('outline-menu');
  await expect(menu).toBeVisible();

  // 点击「目标」
  await page.getByTestId('outline-item-1').click();

  const scrollEl = page.locator('.cm-editor .cm-scroller');
  const scrollTop = await scrollEl.evaluate((el) => el.scrollTop);
  expect(scrollTop).toBeGreaterThan(0);

  evidence.outlineSourceScroll = true;
});

test('预览模式点击大纲项 → DOM 滚动', async ({ page }) => {
  await page.goto('/');
  const lines = ['# 起始'];
  for (let i = 0; i < 20; i++) lines.push(`段落${i}\n\n`);
  lines.push('## 目标');
  for (let i = 0; i < 20; i++) lines.push(`段落${i}\n\n`);
  await page.getByTestId('file-input').setInputFiles({
    name: 'pv-scroll.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(lines.join('\n') + '\n'),
  });
  // 切换到编辑模式以访问编辑器（先确保在edit模式，之后再切preview）
  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible();

  // 切到预览模式
  await page.getByTestId('mode-preview-btn').click();
  await expect(page.getByTestId('mode-pane-preview')).toBeVisible();

  // 钉住大纲
  await page.getByTestId('outline-btn').click();
  const menu = page.getByTestId('outline-menu');
  await expect(menu).toBeVisible();

  // 点击「目标」
  await page.getByTestId('outline-item-1').click();

  // 预览面板 scrollTop 变化
  const pvPane = page.getByTestId('mode-pane-preview');
  const scrollTop = await pvPane.evaluate((el) => el.scrollTop);
  expect(scrollTop).toBeGreaterThan(0);

  evidence.outlinePreviewScroll = true;
});

test.afterAll(() => {
  writeFileSync(join(RES, 'v2-outline.json'), JSON.stringify(evidence, null, 2) + '\n');
});
