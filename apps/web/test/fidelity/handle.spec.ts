import { test, expect } from '@playwright/test';

test.describe('Fidelity: Block Handle (R-HANDLE-01, R-HANDLE-02, R-HANDLE-03)', () => {
  test.fixme('A-01.1: Handle width is 42px', async ({ page }) => {
    await page.goto('/');
    // 断言骨架（待对应票实现后启用）： Locate block handle and measure width
    // const handle = page.locator('.mdb-block-handle, .hnd').first();
    // await expect(handle).toHaveCSS('width', '42px');
  });

  test.fixme('A-01.2: Handle height is 26px', async ({ page }) => {
    await page.goto('/');
    // 断言骨架（待对应票实现后启用）： Locate block handle and measure height
    // const handle = page.locator('.mdb-block-handle, .hnd').first();
    // await expect(handle).toHaveCSS('height', '26px');
  });

  test.fixme('A-01.3: Handle border-radius is 6px', async ({ page }) => {
    await page.goto('/');
    // 断言骨架（待对应票实现后启用）： Locate block handle and measure border-radius
    // const handle = page.locator('.mdb-block-handle, .hnd').first();
    // await expect(handle).toHaveCSS('border-radius', '6px');
  });

  test.fixme('A-02.1: Table block handle has data-icon="DataSheetOutlined"', async ({ page }) => {
    await page.goto('/');
    // 断言骨架（待对应票实现后启用）： Verify table block handle icon
  });

  test.fixme('A-02.2: List block handle has data-icon="DisorderListOutlined"', async ({ page }) => {
    await page.goto('/');
    // 断言骨架（待对应票实现后启用）： Verify list block handle icon
  });

  test.fixme('A-02.3: Callout block handle has data-icon="CalloutOutlined"', async ({ page }) => {
    await page.goto('/');
    // 断言骨架（待对应票实现后启用）： Verify callout block handle icon
  });

  test.fixme('A-02.4: Drag handle has data-icon="DragOutlined"', async ({ page }) => {
    await page.goto('/');
    // 断言骨架（待对应票实现后启用）： Verify drag handle icon
  });

  test.fixme('A-03.1-03.6: ICON_MAP completeness for all block types', async ({ page }) => {
    await page.goto('/');
    // 断言骨架（待对应票实现后启用）： Verify all block type icons match ICON_MAP
  });

  test.fixme('A-04.1: Hover text 500ms → menu stays closed', async ({ page }) => {
    await page.goto('/');
    // 断言骨架（待对应票实现后启用）： Hover over block text, wait 500ms, verify menu not open
  });

  test.fixme('A-04.2: Hover handle ≥120ms → menu opens', async ({ page }) => {
    await page.goto('/');
    // 断言骨架（待对应票实现后启用）： Hover over block handle, wait 120ms, verify menu opens
  });
});