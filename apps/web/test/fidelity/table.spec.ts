import { test, expect } from '@playwright/test';

test.describe('Fidelity: Table (R-TABLE-01 through R-TABLE-05)', () => {
  test.fixme('A-18.1: Row/col hotspots display:none when not hovering', async ({ page }) => {
    await page.goto('/');
    // 断言骨架（待对应票实现后启用）： Verify hotspots hidden by default
  });

  test.fixme('A-18.2: Hover cell shows blue "+" bubbles "插入行"/"插入列"', async ({ page }) => {
    await page.goto('/');
    // 断言骨架（待对应票实现后启用）： Hover cell and verify hotspots appear
  });

  test.fixme('A-19.1: Row "+" y-position ≈ row boundary ±2px', async ({ page }) => {
    await page.goto('/');
    // 断言骨架（待对应票实现后启用）： Verify row hotspot position
  });

  test.fixme('A-19.2: Col "+" x-position ≈ col boundary ±2px', async ({ page }) => {
    await page.goto('/');
    // 断言骨架（待对应票实现后启用）： Verify column hotspot position
  });

  test.fixme('A-20.1: Click cell center → cursor in cell (not cm-table-boundary)', async ({ page }) => {
    await page.goto('/');
    // 断言骨架（待对应票实现后启用）： Click cell center, verify elementFromPoint is cell not boundary
  });

  test.fixme('A-21.1: Hover .mdb-table-cell-handle → insert menu opens', async ({ page }) => {
    await page.goto('/');
    // 断言骨架（待对应票实现后启用）： Hover cell handle, verify insert menu opens
  });

  test.fixme('A-22.1: Table block menu has "标题行" "标题列" "均分列宽"', async ({ page }) => {
    await page.goto('/');
    // 断言骨架（待对应票实现后启用）： Verify table block menu toggles
  });
});