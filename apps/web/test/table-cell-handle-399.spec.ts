// #399（增量）：单元格手柄必须落在内容前面，不能贴在单元格右侧。
//
// 旧位置 `right:2px` 让手柄读作「在单元格后面」，连带把块菜单锚到表格右下角。
// 本票先修位置；「有内容/无内容两种语义」待定（GFM 单元格只有行内文本，没有可转换的块类型）。
//
// 运行：pnpm --filter @md-bundle/web exec playwright test test/table-cell-handle-399.spec.ts
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

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'cell-handle-399.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

test('手柄在单元格内容左侧，而不是右侧', async ({ page }) => {
  await openEditor(page)
  const cell = page.getByTestId('cm-table').locator('td[data-row="0"][data-col="1"]')
  await cell.hover()
  await settle(page)

  const gaps = await page.evaluate(() => {
    const td = document.querySelector('td[data-row="0"][data-col="1"]') as HTMLElement | null
    if (!td) return null
    const handle = td.querySelector('.cm-table-cell-handle') as HTMLElement | null
    const text = td.querySelector('.cm-table-cell-text') as HTMLElement | null
    if (!handle || !text) return null
    const cr = td.getBoundingClientRect()
    const hr = handle.getBoundingClientRect()
    const tr = text.getBoundingClientRect()
    return {
      leftGap: Math.round(hr.left - cr.left),
      rightGap: Math.round(cr.right - hr.right),
      handleBeforeText: hr.left <= tr.left,
    }
  })

  expect(gaps, 'handle/text boxes').not.toBeNull()
  expect(gaps!.leftGap, '手柄距单元格左缘').toBeLessThanOrEqual(4)
  expect(gaps!.rightGap, '手柄不应贴在右缘').toBeGreaterThan(100)
  expect(gaps!.handleBeforeText, '手柄应在文本左侧').toBe(true)
})
