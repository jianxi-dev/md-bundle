// #236 / #333：callout 卡片点击后可进入编辑。#333 起改为卡片内联编辑（不再坍缩为 `> [!NOTE]` 源码）。
import { expect, test, type Page } from '@playwright/test'

const DOC = `# Callout

Intro paragraph.

> [!NOTE]
> callout body text here

Outro paragraph.
`

test.use({ viewport: { width: 1440, height: 900 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

test('callout 卡片可点击并内联编辑（#236 / #333）', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'callout.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)

  // 非活动块：渲染 callout 卡片，隐藏源码
  await expect(page.locator('.cm-callout')).toBeVisible()

  // 点击卡片 → 卡片保持渲染，出现内联编辑器并获得焦点（#333：不坍缩为源码）
  await page.locator('.cm-callout').first().click()
  await settle(page)
  await expect(page.locator('.cm-callout')).toHaveCount(1)
  await expect(page.getByTestId('cm-callout-editor')).toBeFocused()

  // 键入写入源码（锁行为，防回归）
  await page.keyboard.type('ZZZ')
  await settle(page)
  await page.getByTestId('mode-source-btn').click()
  await expect(page.locator('.cm-content').first()).toContainText('ZZZ')
})
