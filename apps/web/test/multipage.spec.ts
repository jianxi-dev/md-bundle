import { expect, test } from '@playwright/test';

// Task 5.2 — static multipage routes (/spec, /about) served by Vite MPA mode.
// Body text is asserted at the <body> level: these pages are pure static HTML,
// so content must be present in the markup with zero JS execution.

test('/spec renders the format spec page', async ({ page }) => {
  await page.goto('/spec');
  await expect(page.getByRole('heading', { name: /格式规范/ })).toBeVisible();
  await expect(page.locator('body')).toContainText('mdpkg');
  await expect(page.locator('body')).toContainText('manifest.json');
  await expect(page.locator('body')).toContainText('sha256');
});

test('/about renders the about page', async ({ page }) => {
  await page.goto('/about');
  await expect(page.getByRole('heading', { name: /关于/ })).toBeVisible();
  await expect(page.locator('body')).toContainText('MIT');
  await expect(page.locator('body')).toContainText('github.com/jianxi-dev');
});

test('site nav links between the three pages', async ({ page }) => {
  await page.goto('/spec');
  const nav = page.getByRole('navigation');
  await nav.getByRole('link', { name: '关于' }).click();
  await expect(page.getByRole('heading', { name: /关于/ })).toBeVisible();
  await nav.getByRole('link', { name: '首页' }).click();
  await expect(page).toHaveURL('/');
});