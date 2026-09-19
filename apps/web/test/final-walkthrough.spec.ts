// F3 — 真实手动 QA（Final Verification Wave）：完整用户旅程，真浏览器（Chromium）端到端。
// 单测试串行走完全程（同一页面、连续操作，模拟真人操作顺序），每里程碑截图留证，
// 全程收集 window pageerror + console error（要求 0）。
// 每步独立记录 PASS/FAIL（recordStep 捕获断言失败后继续后续步骤，以界定报告范围）。
// 证据：test-results/final-01..09.png + final-walkthrough.json。
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { dropImages } from './dropImage';

test.describe.configure({ mode: 'serial' });
// 钉住配色方案：主题三态默认「跟随系统」，headless 的 prefers-color-scheme 为 light，
// 会让错误态的根背景断言随运行环境漂移（实测 light --bg=rgb(246,246,248) vs dark rgb(13,17,23)）。
test.use({ colorScheme: 'dark' });
// 预算说明（P2 #187）：本 spec 只走旅程步骤（开→编→贴→重开→画廊），
// 4 个重下载（.mdpkg 保存 / HTML / PNG / .md 导出）已拆至 export-pipeline.spec.ts，
// 因而 120s 对本 spec 的最坏情况（≈7 个 15-20s 等待）有充足余量。
test.setTimeout(120_000);

const here = dirname(fileURLToPath(import.meta.url));
const FIX = join(here, 'fixtures');
const IMGS = join(FIX, 'imgs');
const RES = join(here, '..', 'test-results');

const steps: Record<string, { pass: boolean; note: string }> = {};

test('F3 walkthrough: full user journey in real Chromium', async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('dialog', (d) => void d.accept());

  // Mock FSA unavailable to force download fallback
  await page.addInitScript(() => {
    delete (window as typeof window & { showSaveFilePicker?: unknown }).showSaveFilePicker;
    delete (window as typeof window & { showDirectoryPicker?: unknown }).showDirectoryPicker;
    delete (window as typeof window & { showOpenFilePicker?: unknown }).showOpenFilePicker;
  });

  await page.setViewportSize({ width: 1280, height: 800 });

  /** 记录单步结果：断言失败 → FAIL + note，继续后续步骤（界定报告范围）。 */
  const record = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      steps[name] = { pass: true, note: 'ok' };
    } catch (e) {
      // 取前 3 行非空信息：首行常只有 "expect(...) failed"，真正定位需要后续行。
      const msg =
        e instanceof Error
          ? e.message
              .split('\n')
              .map((l) => l.trim())
              .filter(Boolean)
              .slice(0, 3)
              .join(' ⏐ ')
          : String(e);
      steps[name] = { pass: false, note: msg.slice(0, 300) };
    }
  };

  /** 带重试的可见性等待（CI 负载下元素渲染可能慢）。 */
  const waitForVisible = (locator: Parameters<typeof expect>[0], timeout = 15_000) =>
    expect(locator).toBeVisible({ timeout });

  /** 展开左栏 + 切到资源页签：LeftRail 收起时整体不渲染，asset-list 仅在展开且资源 tab 激活时存在。 */
  const openAssetsPanel = async () => {
    const rail = page.getByTestId('left-rail');
    if ((await rail.count()) === 0 || (await rail.isHidden())) {
      await page.getByTestId('left-rail-toggle').click();
    }
    await expect(rail).toBeVisible();
    await page.getByTestId('left-rail-tab-assets').click();
  };

  /** 读取原始 Markdown：编辑态装饰把 `![red](red.png)`/`> [!NOTE]` 等替换为 widget（见语义编辑态契约），
   *  须切到源码态读原文，读完切回编辑态。 */
  const rawDocText = async (): Promise<string> => {
    await page.getByTestId('mode-source-btn').click();
    await expect(page.locator('.cm-content').first()).toBeVisible();
    const text = await page.locator('.cm-content').first().innerText();
    await page.getByTestId('mode-edit-btn').click();
    await expect(page.locator('.cm-editor').first()).toBeVisible();
    return text;
  };

  // ── Step 1: Landing ──────────────────────────────────────────────
  await record('1-landing', async () => {
    await page.goto('/');
    await expect(page.locator('[data-testid="landing-nav"]')).toBeVisible();
    const slogan = page.locator('[data-testid="hero-slogan"]');
    await expect(slogan).toContainText('Markdown');
    await expect(page.locator('[data-testid="format-line"]')).toBeVisible();
    await expect(page.locator('[data-testid="featured-section"]')).toBeVisible();
    await page.screenshot({ path: join(RES, 'final-01-home.png') });
  });

  // ── Step 2: Open .md → editor visible ────────────────────────────
  await record('2-open-md', async () => {
    await page.getByTestId('file-input').setInputFiles(join(FIX, 'hello.md'));
    await page.getByTestId('mode-edit-btn').click();
    await waitForVisible(page.locator('.cm-editor').first());
    await expect(page.locator('.cm-content').first()).toContainText('Hello');
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
    await page.locator('.cm-content').first().click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type(' 测试编辑内容');
    await expect(page.locator('.cm-content').first()).toContainText('测试编辑内容');
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
    // 编辑态渲染为 callout 卡片；断言插入结果须读源码态原文。
    expect(await rawDocText()).toContain('> [!NOTE]');
  });

  // ── Step 4: Image import + text-paste noop ───────────────────────
  await record('4-import-assets', async () => {
    await openAssetsPanel();
    await dropImages(page, [
      { name: 'red.png', mimeType: 'image/png', data: readFileSync(join(IMGS, 'red.png')) },
    ]);
    const list = page.getByTestId('asset-list');
    await expect(list).toContainText('资源清单 (1)');
    await expect(list).toContainText('red.png');
    // hello.md 已有 `![red](red.png)` → 自动接线，不重复插入（编辑态该引用被 widget 接管，读源码态原文）
    const textAfterImport = await rawDocText();
    expect((textAfterImport.match(/!\[red\]\(red\.png\)/g) ?? []).length).toBe(1);
    // 粘贴文本 → 不触发导入（编辑器内容原样不动）
    const beforePaste = await rawDocText();
    await page.evaluate(() => {
      const dt = new DataTransfer();
      dt.items.add(new File(['plain text'], 'note.txt', { type: 'text/plain' }));
      const el = document.querySelector('[data-testid="workspace-modes"]');
      if (!el) throw new Error('editor area not found');
      el.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
      );
    });
    expect(await rawDocText()).toBe(beforePaste);
    await expect(list).toContainText('资源清单 (1)');
    await page.screenshot({ path: join(RES, 'final-04-assets.png') });
  });

  // ── Step 7: Open .mdpkg (valid + corrupted) ──────────────────────
  await record('7-open-mdpkg', async () => {
    await page.getByTestId('file-input').setInputFiles(join(FIX, 'valid.mdpkg'));
    await page.getByTestId('mode-edit-btn').click();
    await waitForVisible(page.locator('.cm-editor').first());
    await openAssetsPanel();
    // 实测：valid.mdpkg 含 2 个图片资源（blue.png / red.png）→ 「资源清单 (2)」。
    await waitForVisible(page.getByTestId('asset-list'));
    await expect(page.getByTestId('asset-list')).toContainText('资源清单 (2)');

    await page.getByTestId('file-input').setInputFiles(join(FIX, 'corrupted.zip'));
    // 断言稳定契约（错误视图 + 中文标题 + 不白屏），不锁内层文案：
    // corrupted.zip 是真实损坏 ZIP（PK 头有效、中央目录损坏），内层信息来自 ZIP 库，措辞会随库变动。
    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('打开失败');
    await expect(alert).toContainText('重新选择');
    // 无白屏：应用根容器仍是暗色背景 + 页面标题仍在
    await expect(page.getByRole('heading', { name: 'MD-Bundle' })).toBeVisible();
    // 与实时 --bg token 比对，而非硬编码色值：主题重设计会改 token（暗色曾 0d1117 → 08090b），
    // 硬编码会让断言随设计漂移而误报。token 经 span 归一化为 rgb() 形式以便比对。
    const { rootBg, bgToken } = await page.evaluate(() => {
      const root = document.querySelector('#root > div')!;
      const probe = document.createElement('span');
      probe.style.color = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
      document.body.appendChild(probe);
      const token = getComputedStyle(probe).color;
      probe.remove();
      return { rootBg: getComputedStyle(root).backgroundColor, bgToken: token };
    });
    expect(rootBg).toBe(bgToken);
    await page.screenshot({ path: join(RES, 'final-07-error.png') });
  });

  // ── Step 8: Badge persistence ────────────────────────────────────
  await record('8-badge-persist', async () => {
    // 重新打开有效文档 → reload → 徽章状态持久化（localStorage md-bundle.badges.unlocked）。
    // 只断言本旅程内解锁的 first-open：first-pack / first-png 已随导出步骤迁至 export-pipeline.spec.ts（P2 #187）。
    await page.getByTestId('file-input').setInputFiles(join(FIX, 'hello.md'));
    await page.getByTestId('mode-edit-btn').click();
    await expect(page.locator('.cm-editor').first()).toBeVisible();
    await page.reload();
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('md-bundle.badges') ?? 'null'),
    );
    expect(stored).not.toBeNull();
    expect(stored.unlocked).toContain('first-open');
  });

  // ── Step 9: Gallery → mdpkg example ──────────────────────────────
  await record('9-gallery', async () => {
    await page.goto('/');
    await waitForVisible(page.locator('[data-testid="featured-section"]'));
    await page.locator('[data-testid="featured-card-2"]').click();
    await page.getByTestId('mode-edit-btn').click();
    await waitForVisible(page.locator('.cm-editor').first(), 20_000);
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

  // record() 吞掉步骤失败以保证后续步骤仍执行（界定报告范围），但这会让测试在
  // 步骤全挂时仍然「绿」——CI 只看退出码，等于该 spec 失去守门能力。此处把步骤
  // 失败升级为测试失败，使退出码与步骤结论一致。
  const failedSteps = Object.entries(steps)
    .filter(([, s]) => !s.pass)
    .map(([name]) => name);
  expect(
    failedSteps,
    `旅程步骤失败：${failedSteps.join(', ') || '(none)'}。详见 test-results/final-walkthrough.json`,
  ).toEqual([]);
});

test.afterAll(() => {
  mkdirSync(RES, { recursive: true });
  const allPass = Object.values(steps).every((s) => s.pass);
  writeFileSync(
    join(RES, 'final-walkthrough.json'),
    JSON.stringify({ tasks: 'F3', verdict: allPass ? 'APPROVE' : 'REJECT', steps }, null, 2) + '\n',
  );
});