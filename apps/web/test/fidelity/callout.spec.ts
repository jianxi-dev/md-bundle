import { test, expect } from '@playwright/test';

test.describe('Fidelity: Callout (R-CALLOUT-01, R-CALLOUT-02)', () => {
  test.fixme('A-26.1: Callout type flyout has 13 unique labels: 注释 信息 摘要 待办 提示 成功 问题 警告 失败 危险 Bug 示例 引用', async ({ page }) => {
    await page.goto('/');
    // 断言骨架（待对应票实现后启用）： Open callout type selector, verify 13 unique labels
  });

  test.fixme('A-27.1: Click header emoji → emoji-mart opens → select updates data-callout-emoji', async ({ page }) => {
    await page.goto('/');
    // 断言骨架（待对应票实现后启用）： Click callout emoji, verify emoji-mart opens and selection works
  });
});