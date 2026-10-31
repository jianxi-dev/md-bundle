// #452 回归锁：格内手柄图标按语义区分，且与块级手柄共用图标词汇。
//
// 旧实现两态都用 CSS `::after { content: "+" }`，有内容的格子也显示「＋」。
//
// 运行：pnpm --filter @md-bundle/web exec playwright test test/table-cell-handle-icon-452.spec.ts
import { expect, test, type Page } from '@playwright/test'

const DOC = `# 表格

| A | B |
| --- | --- |
| A1 | B1 |
|  |  |

结尾段落。
`

test.use({ viewport: { width: 1440, height: 1200 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

test('有内容格显示转换图标，空格显示加号', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'handle-icon-452.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)

  const filled = page.getByTestId('cm-table').locator('td[data-row="0"][data-col="0"]')
  const empty = page.getByTestId('cm-table').locator('td[data-row="1"][data-col="0"]')

  const filledIcon = filled.locator('.mdb-table-cell-handle svg')
  const emptyIcon = empty.locator('.mdb-table-cell-handle svg')
  await expect(filledIcon).toHaveCount(1)
  await expect(emptyIcon).toHaveCount(1)

  const filledName = await filledIcon.getAttribute('data-icon')
  const emptyName = await emptyIcon.getAttribute('data-icon')
  expect(filledName, '有内容格图标').toBe('FormatParagraphOutlined')
  expect(emptyName, '空格图标').toBe('AddOutlined')
  expect(filledName).not.toBe(emptyName)
})
