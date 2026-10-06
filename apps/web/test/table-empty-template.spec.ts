// #386：斜杠插入表格的模板必须是空单元格——不得写入 A/B/C/1/2/3/4 占位文字。
import { expect, test, type Page } from '@playwright/test'

test.use({ viewport: { width: 1200, height: 700 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page, doc: string): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'table-empty.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(doc),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

async function typeSlashAtDocEnd(page: Page): Promise<void> {
  await page.locator('.cm-content').click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+End' : 'Control+End')
  await settle(page)
  await page.keyboard.type('/')
  await expect(page.locator('.mdb-slash-menu')).toBeVisible()
}

async function rawDoc(page: Page): Promise<string> {
  await page.getByTestId('mode-source-btn').click()
  await expect(page.locator('.cm-content').first()).toBeVisible()
  const text = await page.locator('.cm-content').first().innerText()
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  return text
}

test('斜杠网格插入 3×2 表格：单元格全部为空，无占位文字（#386）', async ({ page }) => {
  await openEditor(page, '# Title\n\n')
  await typeSlashAtDocEnd(page)

  await page.locator('.mdb-slash-item').filter({ hasText: '表格' }).first().click()
  await expect(page.locator('.mdb-slash-grid-cell')).toHaveCount(100)
  await page.locator('.mdb-slash-grid-cell[data-r="2"][data-c="3"]').click()
  await settle(page)
  await expect(page.locator('.mdb-slash-menu')).toHaveCount(0)

  const raw = await rawDoc(page)
  const tableLines = raw.split('\n').filter((line) => line.includes('|'))
  // 结构有效：header + separator + 2 body rows
  expect(tableLines).toHaveLength(4)
  // 表头是空单元格，不是 A/B/C
  expect(tableLines[0]).toBe('|  |  |  |')
  expect(tableLines[1]).toBe('| --- | --- | --- |')
  // 表体是空单元格，不是 1/2/3/4
  expect(tableLines[2]).toBe('|  |  |  |')
  expect(tableLines[3]).toBe('|  |  |  |')
  // 全文不含任何占位文字
  expect(raw).not.toMatch(/\| [A-Z] \|/)
  expect(raw).not.toMatch(/\| \d+ \|/)
})

test('斜杠网格插入表格：编辑态表格 widget 正常渲染且单元格为空（#386）', async ({ page }) => {
  await openEditor(page, '# Title\n\n')
  await typeSlashAtDocEnd(page)

  await page.locator('.mdb-slash-item').filter({ hasText: '表格' }).first().click()
  await page.locator('.mdb-slash-grid-cell[data-r="2"][data-c="3"]').click()
  await settle(page)

  // 表格 widget 渲染：3 列 × 3 行（含表头）= 9 个单元格
  const table = page.locator('.cm-table').first()
  await expect(table).toBeVisible()
  const cells = table.locator('.cm-table-cell-text')
  await expect(cells).toHaveCount(9)
  const cellTexts = await cells.allInnerTexts()
  expect(cellTexts.every((t) => t.trim() === '')).toBe(true)
})
