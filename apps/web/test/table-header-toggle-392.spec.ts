// #392：表格块手柄（表格左侧手柄）菜单必须暴露并应用「标题行/标题列」。
// 入口级复现：Markdown 语言是 CommonMark，表格在块模型里是 paragraph，旧代码用
// block.type === 'table' 判定导致 tableOnly 行恒被 display:none 隐藏。
// 运行：pnpm --filter @md-bundle/web exec playwright test test/table-header-toggle-392.spec.ts
import { expect, test, type Page } from '@playwright/test'

const DOC = `Intro paragraph.

| A | B |
| --- | --- |
| 1 | 2 |
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
    name: 'table-header-392.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
  // First pointer entry makes CM6 rebuild the table widget; absorb it before
  // reaching for the block handle, or the handle is torn down mid-hover.
  await page.getByTestId('cm-table').locator('td[data-row="0"][data-col="0"]').hover()
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

/** Hover the table so its gutter handle appears, then open the handle menu. */
async function openTableBlockMenu(page: Page): Promise<void> {
  const table = page.getByTestId('cm-table')
  const box = await table.boundingBox()
  if (!box) throw new Error('table has no bounding box')
  await page.mouse.move(box.x + 30, box.y + box.height / 2)
  await settle(page)
  const handle = page.getByTestId('block-handle')
  await expect(handle).toBeVisible()
  await expect(handle).toHaveAttribute('data-icon', 'DataSheetOutlined')
  await handle.click()
  await expect(page.getByTestId('block-handle-menu')).toBeVisible()
}

test('AC: 表格块手柄菜单暴露「标题行/标题列」并应用 标题行（源码移除分隔行）', async ({ page }) => {
  await openEditor(page)

  await openTableBlockMenu(page)
  const menu = page.getByTestId('block-handle-menu')
  await expect(menu.getByRole('button', { name: '标题行' })).toBeVisible()
  await expect(menu.getByRole('button', { name: '标题列' })).toBeVisible()

  await menu.getByRole('button', { name: '标题行' }).click()
  await settle(page)

  const after = await rawDoc(page)
  expect(after).not.toContain('---')
  expect(after).toContain('| A | B |')
  expect(after).toContain('| 1 | 2 |')
})

test('AC: 表格块手柄菜单应用 标题列（源码首列前空格翻转）', async ({ page }) => {
  await openEditor(page)

  await openTableBlockMenu(page)
  await page.getByTestId('block-handle-menu').getByRole('button', { name: '标题列' }).click()
  await settle(page)

  const after = await rawDoc(page)
  expect(after).toContain('|A | B |')
  expect(after).not.toContain('| A | B |')
})
