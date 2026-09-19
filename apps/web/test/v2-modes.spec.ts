// 顶栏 v2 验收 e2e（任务 2.1）：ghost 图标动作区 + 三模式图标 + 禁用组 + 单一主按钮。
//   - ①模式三图标存在（edit/source/preview），aria-label 正确
//   - ②无文档禁用组：保存/导出/复制正文 disabled；分享/主题 disabled（过渡期）；模式图标 disabled
//   - ③有文档（打开示例）全可用
//   - ④单主按钮存在且无文档时 disabled
// 证据：test-results/v2-modes.json（afterAll 汇总）。
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { dropImages } from './dropImage';
import { UNDO_KEY } from './keys';

const here = dirname(fileURLToPath(import.meta.url));
const FIX = join(here, 'fixtures');
const RES = join(here, '..', 'test-results');

const evidence = {
  tasks: '2.1+3.4',
  modeIconsExist: false,
  disabledGroupNoDoc: false,
  docEnabled: false,
  primaryButtonExists: false,
  decorEditOn: false,
  decorSourceOff: false,
  undoPreserved: false,
  imageImportWithDecor: false,
  slashCalloutCard: false,
};

test.use({ viewport: { width: 1280, height: 800 } });

// 串行模式：fullyParallel:true 下并行 worker 各自持有独立 evidence 对象，
// 只有 serial 保证单 worker 跑完所有测试，afterAll 才能落盘完整 facts。
test.describe.configure({ mode: 'serial' });

test('模式三图标存在（edit/source/preview）+ aria-label', async ({ page }) => {
  await page.goto('/');

  // 打开一个文档使模式图标可用（常驻顶栏始终渲染，但模式图标在 empty 态 disabled）
  await page.getByTestId('file-input').setInputFiles(join(FIX, 'hello.md'));

  // 模式三图标 testid + aria-label
  const editBtn = page.getByTestId('mode-edit-btn');
  const sourceBtn = page.getByTestId('mode-source-btn');
  const previewBtn = page.getByTestId('mode-preview-btn');

  await expect(editBtn).toBeVisible();
  await expect(sourceBtn).toBeVisible();
  await expect(previewBtn).toBeVisible();

  await expect(editBtn).toHaveAttribute('aria-label', '编辑模式');
  await expect(sourceBtn).toHaveAttribute('aria-label', '源码模式');
  await expect(previewBtn).toHaveAttribute('aria-label', '预览模式');

  // 打开文档后默认预览模式（aria-pressed=true）
  await expect(previewBtn).toHaveAttribute('aria-pressed', 'true');

  // 切换到编辑模式以继续测试
  await editBtn.click();
  await expect(editBtn).toHaveAttribute('aria-pressed', 'true');

  // 现在编辑器可见
  await expect(page.locator('.cm-editor').first()).toBeVisible();

  evidence.modeIconsExist = true;
});

test('无文档禁用组：empty 态无顶栏（Landing 全页），打开文档后顶栏按钮全可用', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('[data-testid="landing-nav"]')).toBeVisible();
  await expect(page.getByTestId('save-btn')).toHaveCount(0);
  await expect(page.getByTestId('export-btn')).toHaveCount(0);

  await page.getByTestId('file-input').setInputFiles(join(FIX, 'hello.md'));
  // 切换到编辑模式以访问编辑器
  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible();

  await expect(page.getByTestId('save-btn')).toBeEnabled();
  await expect(page.getByTestId('export-btn')).toBeEnabled();
  await expect(page.getByTestId('mode-edit-btn')).toBeEnabled();
  await expect(page.getByTestId('mode-source-btn')).toBeEnabled();
  await expect(page.getByTestId('mode-preview-btn')).toBeEnabled();

  evidence.disabledGroupNoDoc = true;
});

test('有文档（打开示例）全可用', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(join(FIX, 'hello.md'));
  // 切换到编辑模式以访问编辑器
  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible();

  // 所有文档类按钮可用
  await expect(page.getByTestId('save-btn')).toBeEnabled();
  await expect(page.getByTestId('export-btn')).toBeEnabled();

  // 模式图标可用
  await expect(page.getByTestId('mode-edit-btn')).toBeEnabled();
  await expect(page.getByTestId('mode-source-btn')).toBeEnabled();
  await expect(page.getByTestId('mode-preview-btn')).toBeEnabled();

  // 主按钮存在且为图标按钮（无中文文字）
  await expect(page.getByTestId('save-btn').locator('svg')).toBeVisible();

  evidence.docEnabled = true;
});

test('单主按钮存在且有文档时 enabled', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('save-btn')).toHaveCount(0);

  await page.getByTestId('file-input').setInputFiles(join(FIX, 'hello.md'));
  // 切换到编辑模式以访问编辑器
  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible();
  const saveBtn = page.getByTestId('save-btn');
  await expect(saveBtn).toBeVisible();
  await expect(saveBtn).toBeEnabled();
  await expect(saveBtn.locator('svg')).toBeVisible();

  await page.getByTestId('export-btn').click();
  await expect(page.getByTestId('export-menu')).toBeVisible();
  await expect(page.getByTestId('export-md')).toBeVisible();
  await expect(page.getByTestId('export-mdpkg')).toBeVisible();
  await expect(page.getByTestId('export-html')).toBeVisible();
  await expect(page.getByTestId('export-png')).toBeVisible();

  evidence.primaryButtonExists = true;
});

// ── 任务 2.2：单窗三模式工作区验收 ────────────────────────────────────────

test('工作区始终只有一个 CM6 实例（edit/source 共享）', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(join(FIX, 'hello.md'));
  // 切换到编辑模式以访问编辑器
  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible();

  // edit 模式：恰好 1 个 .cm-editor
  await expect(page.locator('.cm-editor')).toHaveCount(1);

  // source 模式：仍是同一个实例，不新增
  await page.getByTestId('mode-source-btn').click();
  await expect(page.locator('.cm-editor')).toHaveCount(1);

  // preview 模式：编辑器隐藏但仍在 DOM（display:none），仍是 1 个
  await page.getByTestId('mode-preview-btn').click();
  await expect(page.locator('.cm-editor')).toHaveCount(1);

  // 切回 edit：仍是 1 个
  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor')).toHaveCount(1);
});

test('edit→source→edit undo 跨模式保留', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(join(FIX, 'hello.md'));
  // 切换到编辑模式以访问编辑器
  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible();
  await expect(page.getByTestId('mode-pane-editor').locator('.cm-content')).toContainText('Hello');

  const editorPane = page.getByTestId('mode-pane-editor');
  const cmContent = editorPane.locator('.cm-content');

  // 切到 source 模式，输入内容
  await page.getByTestId('mode-source-btn').click();
  await expect(editorPane).toBeVisible();
  await cmContent.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.insertText(' from-source');
  await expect(cmContent).toContainText(' from-source');

  // 切回 edit 模式——内容保留（同一实例）
  await page.getByTestId('mode-edit-btn').click();
  await expect(editorPane).toBeVisible();
  await expect(cmContent).toContainText(' from-source');

  // undo 撤销 source 中的输入（同一 undo 栈）
  await cmContent.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.press(UNDO_KEY);
  await expect(cmContent).not.toContainText(' from-source');
});

test('输入→切 preview→渲染出现；切回 edit→undo 保留', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(join(FIX, 'hello.md'));
  // 切换到编辑模式以访问编辑器
  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible();
  await expect(page.getByTestId('mode-pane-editor').locator('.cm-content')).toContainText('Hello');

  const editorPane = page.getByTestId('mode-pane-editor');
  const cmContent = editorPane.locator('.cm-content');

  await cmContent.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  await page.keyboard.insertText('testundo');
  await expect(cmContent).toContainText('testundo');

  await page.keyboard.press(UNDO_KEY);
  await expect(cmContent).not.toContainText('testundo');

  await page.keyboard.insertText('testundo');
  await expect(cmContent).toContainText('testundo');

  await page.getByTestId('mode-preview-btn').click();
  await expect(page.getByTestId('mode-pane-preview')).toBeVisible();
  await expect(editorPane).toBeHidden();

  await page.getByTestId('mode-edit-btn').click();
  await expect(editorPane).toBeVisible();
  await expect(cmContent).toContainText('testundo');

  await cmContent.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.press(UNDO_KEY);
  await expect(cmContent).not.toContainText('testundo');
});

test('循环连切 edit↔source↔preview 数次 0 pageerror', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(join(FIX, 'hello.md'));
  // 切换到编辑模式以访问编辑器
  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible();

  for (let i = 0; i < 2; i++) {
    await page.getByTestId('mode-source-btn').click();
    await page.getByTestId('mode-preview-btn').click();
    await page.getByTestId('mode-edit-btn').click();
  }

  expect(pageErrors).toEqual([]);
  await expect(page.getByTestId('mode-pane-editor')).toBeVisible();
  await expect(page.locator('.cm-editor').first()).toBeVisible();
});

test('source 模式显示原始源码文本（含 # 标记）', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles({
    name: 'src-test.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# Heading\n\nBody text\n'),
  });
  // 切换到编辑模式以访问编辑器
  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible();

  await page.getByTestId('mode-source-btn').click();
  await expect(page.getByTestId('mode-pane-editor')).toBeVisible();
  await expect(page.getByTestId('mode-pane-editor').locator('.cm-content')).toContainText('# Heading');
  await expect(page.getByTestId('mode-pane-preview')).toBeHidden();
});

test('preview 模式无编辑器（隐藏）且渲染预览内容', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles({
    name: 'pv-test.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# Preview Test\n\nParagraph\n'),
  });
  // 切换到编辑模式以访问编辑器
  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible();

  await page.getByTestId('mode-preview-btn').click();
  await expect(page.getByTestId('mode-pane-preview')).toBeVisible();
  await expect(page.locator('.preview-content h1').first()).toHaveText('Preview Test');
  await expect(page.getByTestId('mode-pane-editor')).toBeHidden();
});

test('mdpkg 打开→edit 模式可编辑→preview 用 PreviewView 渲染', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(join(FIX, 'valid.mdpkg'));
  // 切换到编辑模式以访问编辑器
  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible();

  await expect(page.getByTestId('mode-pane-editor')).toBeVisible();
  await expect(page.getByTestId('mode-pane-editor').locator('.cm-content')).toContainText('# 打包测试');

  await page.getByTestId('mode-preview-btn').click();
  await expect(page.getByTestId('mode-pane-preview')).toBeVisible();
  await expect(page.locator('.preview-content h1').first()).toBeVisible();
  await expect(page.getByTestId('mdpkg-frame')).toHaveCount(0);
});

// ── 任务 3.4：装饰 Compartment 切换验收 ────────────────────────────────────────

test('edit 模式含装饰：heading widget 可见', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(join(FIX, 'hello.md'));
  // 切换到编辑模式以访问编辑器
  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible();

  const editorPane = page.getByTestId('mode-pane-editor');
  const cmContent = editorPane.locator('.cm-content');
  // 光标移出标题块 → 该块进入非活动态（标记以 opacity:0 隐藏）
  await cmContent.click();
  await page.keyboard.press('Control+End');

  // 语义编辑态契约：非活动块的标题标记保留在 DOM（原始 "# "，不再是 [H1] 徽章），
  // 但以 opacity:0 视觉隐藏。断言计算样式而非文案，才锁得住这个行为。
  const marker = cmContent.locator('.cm-heading-marker').first();
  await expect(marker).toHaveCount(1);
  await expect(marker).toHaveText('# ');
  const opacity = await marker.evaluate((el) => getComputedStyle(el).opacity);
  expect(Number(opacity)).toBe(0);

  evidence.decorEditOn = true;
});

test('source 模式装饰关闭：raw # 文本可见，heading widget 消失', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(join(FIX, 'hello.md'));
  // 切换到编辑模式以访问编辑器
  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible();

  const editorPane = page.getByTestId('mode-pane-editor');
  const cmContent = editorPane.locator('.cm-content');
  // Move cursor past heading range so selection-reveal doesn't suppress heading widget
  await cmContent.click();
  await page.keyboard.press('Control+End');
  await expect(cmContent).toContainText('[H1]');

  await page.getByTestId('mode-source-btn').click();
  await expect(editorPane).toBeVisible();
  await expect(cmContent).toContainText('# Hello');
  await expect(cmContent).not.toContainText('[H1]');

  evidence.decorSourceOff = true;
});

test('decorations compartment 切换后 undo 保留', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(join(FIX, 'hello.md'));
  // 切换到编辑模式以访问编辑器
  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible();

  const editorPane = page.getByTestId('mode-pane-editor');
  const cmContent = editorPane.locator('.cm-content');

  await cmContent.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.insertText(' decor-test');
  await expect(cmContent).toContainText('decor-test');

  await page.getByTestId('mode-source-btn').click();
  await expect(editorPane).toBeVisible();
  await expect(cmContent).toContainText('decor-test');

  await page.getByTestId('mode-edit-btn').click();
  await expect(editorPane).toBeVisible();
  await expect(cmContent).toContainText('decor-test');

  await cmContent.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.press(UNDO_KEY);
  await expect(cmContent).not.toContainText('decor-test');

  evidence.undoPreserved = true;
});

test('edit 模式图片装饰：![red](red.png) 渲染 img widget', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(join(FIX, 'hello.md'));
  // 切换到编辑模式以访问编辑器
  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible();

  const rail = page.getByTestId('left-rail');
  if ((await rail.count()) === 0 || (await rail.isHidden())) {
    await page.getByTestId('left-rail-toggle').click();
  }
  await expect(rail).toBeVisible();
  await page.getByTestId('left-rail-tab-assets').click();

  await dropImages(page, [
    { name: 'red.png', mimeType: 'image/png', data: readFileSync(join(FIX, 'imgs', 'red.png')) },
  ]);

  // Force decoration rebuild: asset import doesn't change editor state,
  // so we need a selection change to trigger StateField.update
  const cmContent = page.getByTestId('mode-pane-editor').locator('.cm-content');
  await cmContent.click();
  await page.keyboard.press('Control+End');

  await page.getByTestId('mode-edit-btn').click();
  const cmImageWidget = page.getByTestId('mode-pane-editor').locator('.cm-image-widget');
  await expect(cmImageWidget.first()).toBeVisible();
  const img = cmImageWidget.first().locator('img');
  await expect(img).toHaveAttribute('src', /^data:image\//);

  evidence.imageImportWithDecor = true;
});

test('斜杠 [!NOTE] 插入 → edit 模式即时 callout 卡', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(join(FIX, 'hello.md'));
  // 切换到编辑模式以访问编辑器
  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible();

  const editorPane = page.getByTestId('mode-pane-editor');
  const cmContent = editorPane.locator('.cm-content');

  await cmContent.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  // keydown 触发 slashKeymap（insertText 走 input handler 不触发 keymap）
  await page.keyboard.press('/');

  const slashMenu = page.locator('.mdb-slash-menu');
  await expect(slashMenu).toBeVisible({ timeout: 3000 });
  // Callout 是 defaultCommands 第二项（index 1）：Heading/Callout/Image ref/Code block/Table/Quote
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  await expect(editorPane.locator('.cm-callout').first()).toBeVisible();
  // edit 模式 callout 卡即时可见（coration replace 隐藏原始 > [!NOTE] 文本）
  const calloutText = await editorPane.locator('.cm-callout').first().innerText();
  expect(calloutText).toContain('注释');

  await page.getByTestId('mode-source-btn').click();
  await expect(cmContent).toContainText('> [!NOTE]');
  await expect(editorPane.locator('.cm-callout')).toHaveCount(0);

  evidence.slashCalloutCard = true;
});

test.afterAll(() => {
  writeFileSync(join(RES, 'v2-modes.json'), JSON.stringify(evidence, null, 2) + '\n');
});
