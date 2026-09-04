import { expect, test } from '@playwright/test';

test('homepage renders the MD-Bundle placeholder', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'MD-Bundle' })).toBeVisible();
  await expect(page.getByText('分享 Markdown，不再裂图。')).toBeVisible();
});