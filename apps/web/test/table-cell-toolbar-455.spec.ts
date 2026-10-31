// #455 回归锁：表格单元格工具条的三件事。
// 1. 单击单元格只进编辑，不弹工具条（工具条只服务多格选区）；
// 2. 拖选多格后「合并单元格」真的合并；
// 3. 打开背景色面板后指针移进面板不消失，能选到色。
//
// 运行：pnpm --filter @md-bundle/web exec playwright test test/table-cell-toolbar-455.spec.ts
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
    name: 'cell-toolbar-455.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

async function dragSelect(page: Page, from: [number, number], to: [number, number]): Promise<void> {
  const a = page.getByTestId('cm-table').locator(`td[data-row="${from[0]}"][data-col="${from[1]}"]`)
  const b = page.getByTestId('cm-table').locator(`td[data-row="${to[0]}"][data-col="${to[1]}"]`)
  const ab = await a.boundingBox()
  const bb = await b.boundingBox()
  if (!ab || !bb) throw new Error('cell boxes missing')
  await page.mouse.move(ab.x + ab.width / 2, ab.y + ab.height / 2)
  await page.mouse.down()
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 8 })
  await page.mouse.up()
  await settle(page)
}

async function readSource(page: Page): Promise<string> {
  await page.getByTestId('mode-source-btn').click()
  await expect(page.locator('.cm-content').first()).toBeVisible()
  await settle(page)
  const text = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.cm-content .cm-line'))
      .map((el) => (el as HTMLElement).textContent ?? '')
      .join('\n'),
  )
  await page.getByTestId('mode-edit-btn').click()
  await settle(page)
  return text
}

test('单击单元格不弹工具条', async ({ page }) => {
  await openEditor(page)
  await page.getByTestId('cm-table').locator('td[data-row="0"][data-col="0"]').click()
  await settle(page)
  await expect(page.getByTestId('cell-toolbar')).toBeHidden()
  await expect(page.locator('.cm-table-cell-input')).toHaveCount(1)
})

test('多格选区点「合并单元格」真的合并', async ({ page }) => {
  await openEditor(page)
  await dragSelect(page, [0, 0], [1, 1])
  const toolbar = page.getByTestId('cell-toolbar')
  await expect(toolbar).toBeVisible()
  await page.getByTestId('cell-merge').click()
  await settle(page)

  const source = await readSource(page)
  // 2×2 合并成一个单元格：四格文本按行序拼到左上角，其余格清空，表格仍成立
  const tableLines = source.split('\n').filter((l) => l.trim().startsWith('|'))
  expect(tableLines).toHaveLength(4)
  expect(tableLines[2]).toBe('| A1 B1 A2 B2 |  |')
  expect(tableLines[3]).toBe('|  |  |')
})

test('背景色面板：指针移进面板不消失，可选中', async ({ page }) => {
  await openEditor(page)
  await dragSelect(page, [0, 0], [0, 1])
  await expect(page.getByTestId('cell-toolbar')).toBeVisible()

  await page.getByTestId('cell-bg').hover()
  const menu = page.locator('.mdb-cell-toolbar-menu')
  await expect(menu).toBeVisible()

  // 移进面板本身
  const swatch = menu.locator('.mdb-color-swatch').first()
  await swatch.hover()
  await settle(page)
  await expect(menu).toBeVisible()

  await swatch.click()
  await settle(page)
  expect(await readSource(page)).toContain('mdb-bg-red')
})
