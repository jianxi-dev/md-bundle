// #384: 表格单元格内联 markdown 渲染（粗体/斜体/行内码/链接）
// 运行：pnpm --filter @md-bundle/web exec playwright test test/table-inline-markdown.spec.ts
import { expect, test, type Page } from '@playwright/test'

const DOC = `Intro paragraph.

| A | B |
| --- | --- |
| **粗体** | *斜体* |
| \`行内码\` | [链接](https://example.com) |
| 普通文本 | **粗体** 和 *斜体* |
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
    name: 'table-inline.md',
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

test('AC: 单元格内 **粗体** 在编辑态渲染为 <strong>，源码保留 **粗体**', async ({ page }) => {
  await openEditor(page)

  const table = page.getByTestId('cm-table')
  await expect(table).toBeVisible()

  // 检查第一行第一列：原始源码为 **粗体**
  const cellBold = table.locator('td[data-row="0"][data-col="0"] .cm-table-cell-text')
  await expect(cellBold).toBeVisible()

  // 渲染后应包含 <strong> 元素
  const strongEl = cellBold.locator('strong')
  await expect(strongEl).toBeVisible()
  await expect(strongEl).toHaveText('粗体')

  // 验证源码仍包含 **粗体**
  const source = await rawDoc(page)
  expect(source).toContain('**粗体**')
})

test('AC: 单元格内 *斜体* 在编辑态渲染为 <em>', async ({ page }) => {
  await openEditor(page)

  const table = page.getByTestId('cm-table')
  const cellItalic = table.locator('td[data-row="0"][data-col="1"] .cm-table-cell-text')
  await expect(cellItalic).toBeVisible()

  const emEl = cellItalic.locator('em')
  await expect(emEl).toBeVisible()
  await expect(emEl).toHaveText('斜体')
})

test('AC: 单元格内 `行内码` 在编辑态渲染为 <code>', async ({ page }) => {
  await openEditor(page)

  const table = page.getByTestId('cm-table')
  const cellCode = table.locator('td[data-row="1"][data-col="0"] .cm-table-cell-text')
  await expect(cellCode).toBeVisible()

  const codeEl = cellCode.locator('code')
  await expect(codeEl).toBeVisible()
  await expect(codeEl).toHaveText('行内码')
})

test('AC: 单元格内 [链接](url) 在编辑态渲染为 <a>', async ({ page }) => {
  await openEditor(page)

  const table = page.getByTestId('cm-table')
  const cellLink = table.locator('td[data-row="1"][data-col="1"] .cm-table-cell-text')
  await expect(cellLink).toBeVisible()

  const linkEl = cellLink.locator('a')
  await expect(linkEl).toBeVisible()
  await expect(linkEl).toHaveText('链接')
  await expect(linkEl).toHaveAttribute('href', 'https://example.com')
  await expect(linkEl).toHaveAttribute('target', '_blank')
  await expect(linkEl).toHaveAttribute('rel', 'noopener noreferrer')
})

test('AC: 单元格内混合内联 markdown 正确渲染', async ({ page }) => {
  await openEditor(page)

  const table = page.getByTestId('cm-table')
  const cellMixed = table.locator('td[data-row="2"][data-col="1"] .cm-table-cell-text')
  await expect(cellMixed).toBeVisible()

  const strongEl = cellMixed.locator('strong')
  await expect(strongEl).toBeVisible()
  await expect(strongEl).toHaveText('粗体')

  const emEl = cellMixed.locator('em')
  await expect(emEl).toBeVisible()
  await expect(emEl).toHaveText('斜体')
})

test('AC: 编辑单元格时输入框显示原始 markdown 标记', async ({ page }) => {
  await openEditor(page)

  const table = page.getByTestId('cm-table')
  const cell = table.locator('td[data-row="0"][data-col="0"]')
  await cell.click()
  await settle(page)

  const input = page.getByTestId('cm-table-cell-input')
  await expect(input).toBeFocused()
  // 输入框应显示原始标记 **粗体**
  await expect(input).toHaveValue('**粗体**')
})

test('AC: 编辑后提交，源码仍保留 markdown 标记', async ({ page }) => {
  await openEditor(page)

  const table = page.getByTestId('cm-table')
  const cell = table.locator('td[data-row="2"][data-col="0"]') // 普通文本单元格
  await cell.click()
  await settle(page)

  const input = page.getByTestId('cm-table-cell-input')
  await expect(input).toBeFocused()
  await input.fill('**新粗体**')
  await page.keyboard.press('Enter')
  await settle(page)

  const source = await rawDoc(page)
  expect(source).toContain('**新粗体**')
})