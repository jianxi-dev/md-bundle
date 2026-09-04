// F3 — 真实手动 QA（Final Verification Wave）：完整用户旅程，真浏览器（Chromium）端到端。
// 单测试串行走完全程（同一页面、连续操作，模拟真人操作顺序），每里程碑截图留证，
// 全程收集 window pageerror + console error（要求 0）。
// 每步独立记录 PASS/FAIL（recordStep 捕获断言失败后继续后续步骤，以界定报告范围）。
// 证据：test-results/final-01..09.png + final-walkthrough.json。
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

const steps: Record<string, { pass: boolean; note: string }> = {};

const docText = (page: Page) => page.locator('.cm-content').innerText();

test('F3 walkthrough: full user journey in real Chromium', async ({ page, context }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  // 含图导出 .md 的确认框：全程自动接受（步骤 6 需要）。
  page.on('dialog', (d) => void d.accept());

  await page.setViewportSize({ width: 1280, height: 800 });

  /** 记录单步结果：断言失败 → FAIL + note，继续后续步骤（界定报告范围）。 */
  const record = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      steps[name] = { pass: true, note: 'ok' };
    } catch (e) {
      steps[name] = { pass: false, note: e instanceof Error ? e.message.split('\n')[0] : String(e) };
    }
  };

  // ── Step 1: Landing ──────────────────────────────────────────────
  await record('1-landing', async () => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '分享 Markdown，不再裂图。' })).toBeVisible();
    await expect(page.getByText('一个文件，带走全部图文。')).toBeVisible();
    await expect(page.getByTestId('logo')).toBeVisible();
    await expect(page.getByTestId('promo')).toBeVisible();
    await page.screenshot({ path: join(RES, 'final-01-home.png') });
  });

  // ── Step 2: Open .md → split editor + preview ────────────────────
  await record('2-open-md', async () => {
    await page.getByTestId('file-input').setInputFiles(join(FIX, 'hello.md'));
    await expect(page.locator('.cm-editor')).toBeVisible();
    await expect(page.locator('.cm-content')).toContainText('Hello');
    await expect(page.locator('.markdown-body h1').first()).toHaveText('Hello');
    // first-open 徽章 toast（旅程中至少观察一次徽章 toast）
    const toast = page.getByTestId('badge-toast');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('首次打开');
    await toast.click();
    await expect(toast).toHaveCount(0);
    await page.screenshot({ path: join(RES, 'final-02-md.png') });
  });

  // ── Step 3: Edit + slash menu ────────────────────────────────────
  await record('3a-edit-preview', async () => {
    await page.locator('.cm-content').click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type(' 测试编辑内容');
    await expect(page.locator('.markdown-body')).toContainText('测试编辑内容');
  });
  await record('3b-slash-menu', async () => {
    // 新行 → 斜杠菜单（行首调用，callout 才能渲染为可见 blockquote）
    await page.keyboard.press('Enter');
    await page.keyboard.type('/');
    await page.screenshot({ path: join(RES, 'final-03-slash.png') });
    await expect(page.locator('.mdb-slash-menu')).toBeVisible();
    // Esc 关闭菜单（不插入内容，`/` 保留）
    await page.keyboard.press('Escape');
    await expect(page.locator('.mdb-slash-menu')).toHaveCount(0);
    // 删掉残留的 `/`，重新打开 → 选择 Callout
    await page.keyboard.press('Backspace');
    await page.keyboard.type('/');
    await expect(page.locator('.mdb-slash-menu')).toBeVisible();
    await page.keyboard.press('ArrowDown'); // Heading → Callout
    await page.keyboard.press('Enter');
    await expect(page.locator('.cm-content')).toContainText('> [!NOTE]');
    await expect(page.locator('.markdown-body blockquote').first()).toBeVisible();
  });

  // ── Step 4: Image import + text-paste noop ───────────────────────
  await record('4-import-assets', async () => {
    await page.getByTestId('import-images-input').setInputFiles(join(IMGS, 'red.png'));
    const list = page.getByTestId('asset-list');
    await expect(list).toContainText('资源清单 (1)');
    await expect(list).toContainText('red.png');
    // hello.md 已有 `![red](red.png)` → 自动接线，不重复插入
    const textAfterImport = await docText(page);
    expect((textAfterImport.match(/!\[red\]\(red\.png\)/g) ?? []).length).toBe(1);
    // 预览渲染出图片引用元素
    await expect(page.locator('.markdown-body img[src="red.png"]')).toBeVisible();
    // 粘贴文本 → 不触发导入（编辑器内容原样不动）
    const beforePaste = await docText(page);
    await page.evaluate(() => {
      const dt = new DataTransfer();
      dt.items.add(new File(['plain text'], 'note.txt', { type: 'text/plain' }));
      const el = document.querySelector('.mdb-editor-area');
      if (!el) throw new Error('editor area not found');
      el.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
      );
    });
    expect(await docText(page)).toBe(beforePaste);
    await expect(list).toContainText('资源清单 (1)');
    await page.screenshot({ path: join(RES, 'final-04-assets.png') });
  });

  // ── Step 5: Save (content-driven → .mdpkg) ───────────────────────
  await record('5-save-mdpkg', async () => {
    const [saveDl] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('save-btn').click(),
    ]);
    expect(saveDl.suggestedFilename()).toMatch(/\.mdpkg$/);
    const savePath = await saveDl.path();
    expect(savePath).not.toBeNull();
    const saveBytes = readFileSync(savePath!);
    expect(Array.from(saveBytes.subarray(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    // first-pack 徽章 toast
    const toast = page.getByTestId('badge-toast');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('首次打包');
    await toast.click();
    await expect(toast).toHaveCount(0);
    await page.screenshot({ path: join(RES, 'final-05-save.png') });
  });

  // ── Step 6: Export dropdown (HTML / PNG / .md+confirm) ───────────
  await record('6-exports', async () => {
    // HTML：Made with MD-Bundle + data:image 内联
    await page.getByTestId('export-btn').click();
    const [htmlDl] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-html').click(),
    ]);
    expect(htmlDl.suggestedFilename()).toMatch(/\.html$/);
    const htmlPath = await htmlDl.path();
    expect(htmlPath).not.toBeNull();
    const html = readFileSync(htmlPath!, 'utf-8');
    expect(html).toContain('Made with MD-Bundle');
    expect(html).toContain('data:image');
    // PNG 长图：魔数 + 尺寸
    await page.getByTestId('export-btn').click();
    const [pngDl] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-png').click(),
    ]);
    expect(pngDl.suggestedFilename()).toMatch(/\.png$/);
    const pngPath = await pngDl.path();
    expect(pngPath).not.toBeNull();
    const pngBytes = readFileSync(pngPath!);
    expect(Array.from(pngBytes.subarray(0, 8))).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    const pngSize = parsePngSize(new Uint8Array(pngBytes));
    expect(pngSize).not.toBeNull();
    expect(pngSize!.width).toBeGreaterThanOrEqual(400);
    // 徽章 toast：PNG 导出触发 png-exported（首次长图）+ export-succeeded（exportCount 3 → 导出大师）。
    // latest-wins —— 最终可见的是后一个解锁（导出大师 rare）；两者任一都是徽章解锁证据。
    const toast = page.getByTestId('badge-toast');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('解锁徽章');
    const toastText = await toast.innerText();
    expect(toastText).toMatch(/首次长图|导出大师/);
    await toast.click();
    await expect(toast).toHaveCount(0);
    // .md 含图 → confirm（已自动接受）→ 下载
    await page.getByTestId('export-btn').click();
    const [mdDl] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-md').click(),
    ]);
    expect(mdDl.suggestedFilename()).toMatch(/\.md$/);
    const mdPath = await mdDl.path();
    expect(mdPath).not.toBeNull();
    expect(readFileSync(mdPath!, 'utf-8')).toContain('# Hello');
    await page.screenshot({ path: join(RES, 'final-06-exports.png') });
  });

  // ── Step 7: Open .mdpkg (valid + corrupted) ──────────────────────
  await record('7-open-mdpkg', async () => {
    await page.getByTestId('file-input').setInputFiles(join(FIX, 'valid.mdpkg'));
    await expect(page.getByTestId('mdpkg-frame')).toBeVisible();
    await expect(page.getByTestId('validation-pass')).toBeVisible();
    await expect(page.getByTestId('validation-pass')).toContainText('通过');
    await expect(page.getByText('5 个资源')).toBeVisible();
    const srcDoc = await page.getByTestId('mdpkg-frame').getAttribute('srcdoc');
    expect(srcDoc).toContain('data:image/png;base64,');

    await page.getByTestId('file-input').setInputFiles(join(FIX, 'corrupted.zip'));
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('MDPKG-E303');
    // 无白屏：应用根容器仍是暗色背景 + 页面标题仍在
    await expect(page.getByRole('heading', { name: 'MD-Bundle' })).toBeVisible();
    const rootBg = await page.evaluate(
      () => getComputedStyle(document.querySelector('#root > div')!).backgroundColor,
    );
    expect(rootBg).toBe('rgb(13, 17, 23)');
    await page.screenshot({ path: join(RES, 'final-07-error.png') });
  });

  // ── Step 8: Share + badge persistence ────────────────────────────
  await record('8-share-badges', async () => {
    // 重新打开有效文档（error 态无分享卡）→ 分享按钮可用
    await page.getByTestId('file-input').setInputFiles(join(FIX, 'hello.md'));
    await expect(page.locator('.cm-editor')).toBeVisible();
    const shareBtn = page.getByTestId('share-card-btn');
    await expect(shareBtn).toBeEnabled();
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: 'http://localhost:4173',
    });
    await shareBtn.click();
    await expect(page.getByTestId('share-card-status')).toContainText('已复制到剪贴板');
    await page.screenshot({ path: join(RES, 'final-08-share-toast.png') });
    // reload → 徽章状态持久化（localStorage md-bundle.badges.unlocked）
    await page.reload();
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('md-bundle.badges') ?? 'null'),
    );
    expect(stored).not.toBeNull();
    expect(stored.unlocked).toContain('first-open');
    expect(stored.unlocked).toContain('first-pack');
    expect(stored.unlocked).toContain('first-png');
  });

  // ── Step 9: Gallery → mdpkg example ──────────────────────────────
  await record('9-gallery', async () => {
    await page.getByTestId('example-mdpkg-demo').click();
    await expect(page.getByTestId('mdpkg-frame')).toBeVisible();
    await expect(page.getByTestId('validation-pass')).toBeVisible();
    await page.screenshot({ path: join(RES, 'final-09-gallery.png') });
  });

  // ── Step 10: Zero pageerrors / console errors ────────────────────
  // 过滤项：md 分支实时预览里相对图片引用（red.png）的 404 资源加载 —— 预期行为
  // （相对引用只在 .mdpkg 内联后可见；.mdpkg iframe 预览已断言 data:image 内联）。
  const realConsoleErrors = consoleErrors.filter((e) => !/Failed to load resource/.test(e));
  steps['10-zero-errors'] = {
    pass: pageErrors.length === 0 && realConsoleErrors.length === 0,
    note:
      pageErrors.length > 0
        ? `pageerrors: ${pageErrors.join(' | ')}`
        : realConsoleErrors.length > 0
          ? `console errors: ${realConsoleErrors.join(' | ')}`
          : 'ok',
  };
});

test.afterAll(() => {
  mkdirSync(RES, { recursive: true });
  const allPass = Object.values(steps).every((s) => s.pass);
  writeFileSync(
    join(RES, 'final-walkthrough.json'),
    JSON.stringify({ tasks: 'F3', verdict: allPass ? 'APPROVE' : 'REJECT', steps }, null, 2) + '\n',
  );
});