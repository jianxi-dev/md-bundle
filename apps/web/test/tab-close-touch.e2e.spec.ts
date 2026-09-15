// 触屏设备页签关闭按钮可见性 e2e（issue #91）：serial 模式 + evidence 落盘。
// 验收项：
//   ① 触屏（iPhone 13，无 hover 能力）：页签关闭按钮 computed opacity = 1（常显、不依赖 :hover）
//   ② 触屏深浅主题一致：light / dark 下均为 1
//   ③ 桌面 Chrome 对照：默认 computed opacity = 0（仍依赖 :hover 显现，行为不变）
// 说明：关闭按钮可见性只看 computed opacity —— Playwright 的 toBeVisible 不区分 opacity:0。
// 证据：test-results/tab-close-touch.json（afterAll 汇总）。
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const FIX = join(here, 'fixtures');
const RES = join(here, '..', 'test-results');

const evidence = {
  issue: '91',
  touchLightCloseVisible: false,
  touchDarkCloseVisible: false,
  desktopCloseHidden: false,
};

test.describe.configure({ mode: 'serial' });

/** 打开 hello.md 后返回页签关闭按钮的 computed opacity；theme 指定时先落盘主题偏好并重载。 */
async function closeBtnOpacity(
  page: import('@playwright/test').Page,
  theme?: 'light' | 'dark',
): Promise<string> {
  await page.goto('/');
  if (theme) {
    await page.evaluate((t) => localStorage.setItem('md-bundle.theme', t), theme);
    await page.reload();
  }
  await page.getByTestId('file-input').setInputFiles(join(FIX, 'hello.md'));

  const closeBtn = page.getByRole('button', { name: '关闭 hello.md' });
  await expect(closeBtn).toBeVisible();
  return closeBtn.evaluate((el) => getComputedStyle(el).opacity);
}

// ── 触屏（无 hover 能力）──────────────────────────────────────

test.describe('触屏（无 hover 能力）', () => {
  // 显式触屏 context（不用 devices 预设：其 defaultBrowserType 会强制新 worker，
  // 与 config 的 chromium project 冲突）。hasTouch + isMobile 使 (hover: none) 命中。
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  });

  test('浅色主题：页签关闭按钮常显（opacity = 1）', async ({ page }) => {
    expect(await closeBtnOpacity(page, 'light')).toBe('1');
    evidence.touchLightCloseVisible = true;
  });

  test('深色主题：页签关闭按钮常显（opacity = 1）', async ({ page }) => {
    expect(await closeBtnOpacity(page, 'dark')).toBe('1');
    evidence.touchDarkCloseVisible = true;
  });
});

// ── 桌面对照（有 hover 能力）──────────────────────────────────

test.describe('桌面 Chrome（有 hover 能力）', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('默认隐藏：页签关闭按钮 opacity = 0（依赖 :hover 显现）', async ({ page }) => {
    expect(await closeBtnOpacity(page)).toBe('0');
    evidence.desktopCloseHidden = true;
  });
});

// ── evidence 落盘 ─────────────────────────────────────────────

test.afterAll(async () => {
  writeFileSync(join(RES, 'tab-close-touch.json'), JSON.stringify(evidence, null, 2) + '\n');
});
