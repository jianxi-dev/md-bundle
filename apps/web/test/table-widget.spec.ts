// #285（change editor-doubao-parity 5.1）：编辑态表格渲染为带边框预览 widget + 单击单元格编辑回写。
// 运行：pnpm --filter @md-bundle/web exec playwright test test/table-widget.spec.ts
import { expect, test, type Page } from '@playwright/test'

const DOC = `Intro paragraph.

| A | B |
| --- | --- |
| 1 | 2 |
| 3 | 4 |
`

test.use({ viewport: { width: 1440, height: 900 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'table.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

async function rawDoc(page: Page): Promise<string> {
  await page.getByTestId('mode-source-btn').click()
  await expect(page.locator('.cm-content').first()).toBeVisible()
  const text = await page.locator('.cm-content').first().innerText()
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  return text
}

test('AC (A): 表格以带边框预览 widget 显示，而非原始 | 文本', async ({ page }) => {
  await openEditor(page)

  const table = page.getByTestId('cm-table')
  await expect(table).toBeVisible()
  await expect(table.locator('th')).toHaveCount(2)
  await expect(table.locator('th').first()).toHaveText('A')
  await expect(table.locator('td')).toHaveCount(4)

  const border = await table
    .locator('td')
    .first()
    .evaluate((el) => getComputedStyle(el).borderTopWidth)
  expect(border).not.toBe('0px')

  // 非活动态：源码标记被替换，内容区不出现分隔行原始文本
  await expect(page.locator('.cm-content')).not.toContainText('| --- |')
})

test('AC (B): 单击单元格输入 A1 后源码对应单元格变为 A1', async ({ page }) => {
  await openEditor(page)

  const cell = page.getByTestId('cm-table').locator('td[data-row="0"][data-col="0"]')
  await expect(cell).toBeVisible()
  await cell.click()
  await settle(page)

  await page.keyboard.type('A1')
  await settle(page)

  expect(await rawDoc(page)).toContain('A1')
})
