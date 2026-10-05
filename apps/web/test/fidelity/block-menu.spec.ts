import { test, expect } from '@playwright/test';

test.describe('Fidelity: Block Menu (R-MENU-01 through R-MENU-07)', () => {
  test.fixme('A-05.1: Block menu width is 236px', async ({ page }) => {
    await page.goto('/');
    // 断言骨架（待对应票实现后启用）： Open block menu and verify width
    // const menu = page.locator('.mdb-block-menu, .menu.open').first();
    // await expect(menu).toHaveCSS('width', '236px');
  });

  test.fixme('A-06.1: Block menu item height is 32px', async ({ page }) => {
    await page.goto('/');
    // 断言骨架（待对应票实现后启用）： Verify menu item height
    // const item = page.locator('.mdb-menu-item, .mi').first();
    // await expect(item).toHaveCSS('height', '32px');
  });

  test.fixme('A-06.2: Block menu item font-size is 12px', async ({ page }) => {
    await page.goto('/');
    // 断言骨架（待对应票实现后启用）： Verify menu item font-size
    // const item = page.locator('.mdb-menu-item, .mi').first();
    // await expect(item).toHaveCSS('font-size', '12px');
  });

  test.fixme('A-07.1: Block menu converts to grid with 10 items', async ({ page }) => {
    await page.goto('/');
    // 断言骨架（待对应票实现后启用）： Verify grid has 10 items
  });

  test.fixme('A-07.2: Grid item icons match exact sequence', async ({ page }) => {
    await page.goto('/');
    // 断言骨架（待对应票实现后启用）： Verify icons: TextOutlined H1Outlined H2Outlined H3Outlined OrderListOutlined DisorderListOutlined TodoOutlined CodeblockOutlined ReferenceOutlined CalloutOutlined
  });

  test.fixme('A-08.1: Table block menu has "标题行" with data-icon="HeaderRowOutlined"', async ({ page }) => {
    await page.goto('/');
    // 断言骨架（待对应票实现后启用）： Verify table menu has header row toggle
  });

  test.fixme('A-08.2: Table block menu has "标题列" with data-icon="HeaderColumnOutlined"', async ({ page }) => {
    await page.goto('/');
    // 断言骨架（待对应票实现后启用）： Verify table menu has header column toggle
  });

  test.fixme('A-08.3: Table block menu has "均分列宽" with data-icon="DistributeColumnsOutlined"', async ({ page }) => {
    await page.goto('/');
    // 断言骨架（待对应票实现后启用）： Verify table menu has distribute columns toggle
  });

  test.fixme('A-09.1: Callout block menu has no "颜色" and no "翻译"', async ({ page }) => {
    await page.goto('/');
    // 断言骨架（待对应票实现后启用）： Verify callout menu exclusions
  });

  test.fixme('A-09.2: Callout block menu has "同步块" with data-icon="LinkRecordOutlined"', async ({ page }) => {
    await page.goto('/');
    // 断言骨架（待对应票实现后启用）： Verify callout menu has sync block
  });

  test.fixme('A-10.1: Block menu top aligns with block top ±2px', async ({ page }) => {
    await page.goto('/');
    // 断言骨架（待对应票实现后启用）： Verify menu.y ≈ block.y ±2px
  });

  test.fixme('A-11.1: Block menu action items contain 评论/剪切/复制/翻译/分享/复制链接/在下方添加', async ({ page }) => {
    await page.goto('/');
    // 断言骨架（待对应票实现后启用）： Verify all action items present
  });
});