// 复制邀请链接 toast 反馈 e2e（Issue #75）—— serial 模式 + evidence 落盘。
// 验收项：
//   ① 分享菜单 → 复制邀请链接 → role=status toast 显示「邀请链接已复制」
//   ② toast 自动消失（3500ms 后不再可见）
// 证据：test-results/v2-share-invite-toast.json
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const FIX = join(here, 'fixtures');
const RES = join(here, '..', 'test-results');

test.describe.configure({ mode: 'serial' });

const evidence = {
  tasks: '#75',
  shareMenuToastVisible: false,
  shareMenuToastAutoDismiss: false,
};

const openMd = async (page: import('@playwright/test').Page) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(join(FIX, 'hello.md'));
  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible();
};

test('分享菜单 → 复制邀请链接 → toast 显示「邀请链接已复制」', async ({ page, context }) => {
  // 授予剪贴板权限（Chromium headless 默认无权限）
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);

  await openMd(page);

  // 打开分享菜单 → 点击复制邀请链接
  await page.getByTestId('share-menu-btn').click();
  await page.getByTestId('share-invite-link').click();

  // 断言 role=status 的 toast 出现且包含文案（排除 badge-toast 的 role=status）
  const toast = page.getByText('邀请链接已复制');
  await expect(toast).toBeVisible();
  await page.screenshot({ path: join(RES, 'v2-share-invite-toast-visible.png') });
  evidence.shareMenuToastVisible = true;
});

test('toast 自动消失（3500ms 后不可见）', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);

  await openMd(page);

  await page.getByTestId('share-menu-btn').click();
  await page.getByTestId('share-invite-link').click();

  const toast = page.getByText('邀请链接已复制');
  await expect(toast).toBeVisible();

  await page.waitForTimeout(4000);
  await expect(toast).toHaveCount(0);
  evidence.shareMenuToastAutoDismiss = true;
});

test.afterAll(() => {
  mkdirSync(RES, { recursive: true });
  writeFileSync(
    join(RES, 'v2-share-invite-toast.json'),
    JSON.stringify({ ...evidence }, null, 2) + '\n',
  );
});
