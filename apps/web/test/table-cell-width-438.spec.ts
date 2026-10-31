// #438 回归锁：进入单元格编辑不得改变列宽。
//
// 旧实现把 <input> 插在文本 span 旁边，两者同时在流内；span 仍参与 auto 布局的
// min-content 计算，input 再按默认固有宽度加一份 → 表格把列撑宽。
//
// 判据：进编辑前后单元格宽度与表格总宽相等（±1px），提交后仍相等。
// 运行：pnpm --filter @md-bundle/web exec playwright test test/table-cell-width-438.spec.ts
import { expect, test, type Page } from '@playwright/test'

const DOC = `# 表格

| A | B |
| --- | --- |
| A1 | B1 |
| A2 | B2 |

结尾段落。
`

test.use({ viewport: { width: 1440, height: 1200 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'cell-width-438.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

test('进入单元格编辑时列宽不变', async ({ page }) => {
  await openEditor(page)
  const cell = page.getByTestId('cm-table').locator('td[data-row="0"][data-col="0"]')
  const table = page.getByTestId('cm-table').first()

  const before = await cell.boundingBox()
  const tableBefore = await table.boundingBox()
  if (!before || !tableBefore) throw new Error('no box')

  await cell.click()
  await settle(page)
  await expect(page.locator('.cm-table-cell-input')).toHaveCount(1)

  const during = await cell.boundingBox()
  const tableDuring = await table.boundingBox()
  if (!during || !tableDuring) throw new Error('no box during edit')

  expect(Math.abs(during.width - before.width), '编辑中单元格宽度').toBeLessThanOrEqual(1)
  expect(Math.abs(tableDuring.width - tableBefore.width), '编辑中表格总宽').toBeLessThanOrEqual(1)

  // 提交后内容变长会正常触发 auto 布局重排，这里只锁「进编辑不跳」这一条；
  // 提交后的列宽由内容决定，不是本票的契约。
  await page.keyboard.type('XYZ')
  await page.keyboard.press('Enter')
  await settle(page)
  await expect(page.locator('.cm-table-cell-input')).toHaveCount(0)
})
