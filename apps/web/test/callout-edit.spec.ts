// #236：callout 卡片选中/点击后必须可进入并编辑（块级 replace 曾吞掉指针）。
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

test('callout 卡片可点击进入并可编辑（#236）', async ({ page }) => {
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

  // 点击卡片进入块 → 卡片被抑制，露出可编辑源码
  await page.locator('.cm-callout').first().click({ position: { x: 40, y: 20 } })
  await settle(page)
  await expect(page.locator('.cm-callout')).toHaveCount(0)
  await expect(page.locator('.cm-content').first()).toContainText('[!NOTE]')

  // 键入写入源码（锁行为，防回归）
  await page.keyboard.type('ZZZ')
  await settle(page)
  await page.getByTestId('mode-source-btn').click()
  await expect(page.locator('.cm-content').first()).toContainText('ZZZ')
})
