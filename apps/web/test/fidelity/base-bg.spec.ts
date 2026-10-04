import { test, expect } from '@playwright/test';

test.describe('Fidelity: Base Background (R-BASE-01)', () => {
  test.fixme('A-35.1: Editor background color === Preview background color', async ({ page }) => {
    await page.goto('/');
    // 断言骨架（待对应票实现后启用）： Compare getComputedStyle('.cm-editor').backgroundColor === getComputedStyle('.preview-content').backgroundColor
    // const editorBg = await page.evaluate(() => getComputedStyle(document.querySelector('.cm-editor')!).backgroundColor);
    // const previewBg = await page.evaluate(() => getComputedStyle(document.querySelector('.preview-content')!).backgroundColor);
    // expect(editorBg).toBe(previewBg);
  });
});