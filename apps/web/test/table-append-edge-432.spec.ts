// #432 回归锁：表格末尾必须能追加行/列。
//
// 症状：列边界只有内部一条（点它新列插在中间），表格右缘没有热点；行边界只覆盖
// 每行上沿，表格底部没有热点 → 真实写作里最常用的「往末尾加一行」做不到。
//
// 判据：末尾热点存在且可点；点击后新行/新列落在**末尾**；表格其余行逐字节不变。
// 运行：pnpm --filter @md-bundle/web exec playwright test test/table-append-edge-432.spec.ts
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
    name: 'table-append.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

async function readSource(page: Page): Promise<string> {
  await page.getByTestId('mode-source-btn').click()
  await expect(page.locator('.cm-content').first()).toBeVisible()
  await settle(page)
  const lines = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.cm-content .cm-line')).map(
      (el) => (el as HTMLElement).textContent ?? '',
    ),
  )
  return lines.join('\n')
}

/** 悬停单元格预热，再把指针移到表格右/下边缘，返回该处的热点。 */
async function hoverTableEdge(page: Page, edge: 'right' | 'bottom') {
  const table = page.getByTestId('cm-table').first()
  await table.locator('td[data-row="0"][data-col="0"]').hover()
  await settle(page)
  const box = await table.boundingBox()
  if (!box) throw new Error('table box missing')
  const point =
    edge === 'right'
      ? { x: box.x + box.width - 6, y: box.y + box.height / 2 }
      : { x: box.x + box.width / 2, y: box.y + box.height - 6 }
  await page.mouse.move(point.x, point.y, { steps: 6 })
  await settle(page)
  const kind = edge === 'right' ? 'col' : 'row'
  return page.locator(`[data-testid="cm-table-hotspot"][data-type="${kind}"]`).last()
}

test('右边缘追加列：新列落在最后一列之后', async ({ page }) => {
  await openEditor(page)
  const hotspot = await hoverTableEdge(page, 'right')
  await expect(hotspot).toBeVisible()
  await expect(hotspot).toHaveAttribute('data-col', '2')
  await hotspot.click()
  await settle(page)

  const source = await readSource(page)
  expect(source).toContain('| A | B |  |')
  expect(source).toContain('| --- | --- | --- |')
  expect(source).toContain('| A1 | B1 |  |')
  expect(source).toContain('| A2 | B2 |  |')
  expect(source).toContain('结尾段落。')
})

test('下边缘追加行：新行落在最后一行之后', async ({ page }) => {
  await openEditor(page)
  const hotspot = await hoverTableEdge(page, 'bottom')
  await expect(hotspot).toBeVisible()
  await expect(hotspot).toHaveAttribute('data-row', '2')
  await hotspot.click()
  await settle(page)

  const source = await readSource(page)
  const lines = source.split('\n')
  const tableLines = lines.filter((l) => l.trim().startsWith('|'))
  expect(tableLines).toEqual([
    '| A | B |',
    '| --- | --- |',
    '| A1 | B1 |',
    '| A2 | B2 |',
    '|  |  |',
  ])
  expect(lines[lines.length - 2]).toBe('结尾段落。')
})

test('末尾追加不改变既有内部边界语义（仍插在该行之前）', async ({ page }) => {
  await openEditor(page)
  const table = page.getByTestId('cm-table').first()
  await table.locator('td[data-row="0"][data-col="0"]').hover()
  await settle(page)
  const firstBoundary = page.locator('[data-testid="cm-table-boundary"][data-type="row"]').first()
  const box = await firstBoundary.boundingBox()
  if (!box) throw new Error('boundary box missing')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 })
  await settle(page)
  const hotspot = page.locator('[data-testid="cm-table-hotspot"][data-type="row"][data-row="0"]').first()
  await expect(hotspot).toBeVisible()
  await hotspot.click()
  await settle(page)

  const rows = (await readSource(page)).split('\n').filter((l) => l.trim().startsWith('|'))
  expect(rows[2]).toBe('|  |  |')
  expect(rows[3]).toBe('| A1 | B1 |')
})
