import { expect, test } from '@playwright/test';

test('homepage renders the MD-Bundle placeholder', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('landing-nav')).toBeVisible();
  await expect(page.locator('[data-testid="hero-slogan"]')).toContainText('Markdown');
  await expect(page.locator('[data-testid="hero-slogan"]')).toContainText('文本与图片');
});