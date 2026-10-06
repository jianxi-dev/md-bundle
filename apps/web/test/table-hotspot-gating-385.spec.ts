// #385 表格边界热点门控 + 格内手柄误触回归。
// (a) 只有指针贴近的那条行/列边界显示「＋」，其余保持 display:none（真实 hover，逐条断言计算样式）。
// (b) 格内手柄悬停不再误弹插入菜单；点击才打开，且打开后不因指针移动而消失。
// 运行：pnpm --filter @md-bundle/web exec playwright test test/table-hotspot-gating-385.spec.ts
import { expect, test, type Locator, type Page } from '@playwright/test'

const DOC = `Intro paragraph.

| A | B | C |
| --- | --- | --- |
| 1 | 2 | 3 |
| 4 | 5 | 6 |
| 7 | 8 | 9 |
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
    name: 'table-gating.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

function boundary(page: Page, type: 'col' | 'row', index: number): Locator {
  const attr = type === 'col' ? 'col' : 'row'
  return page.locator(
    `[data-testid="cm-table-boundary"][data-type="${type}"][data-${attr}="${index}"]`,
  )
}

// Warms the content first so CM6's one-time widget re-render does not swallow
// the reveal, then lands the real pointer on the boundary's axis.
async function pointAtBoundary(page: Page, type: 'col' | 'row', index: number): Promise<void> {
  const box = await boundary(page, type, index).boundingBox()
  if (!box) throw new Error('boundary has no bounding box')
  const x = type === 'col' ? box.x + box.width / 2 : box.x + box.width / 4
  const y = type === 'col' ? box.y + 8 : box.y + box.height / 2
  await page.getByTestId('cm-table').locator('td[data-row="0"][data-col="0"]').hover()
  await settle(page)
  await page.mouse.move(x, y)
  await settle(page)
}

// Computed display per hotspot, keyed `type:index` — the real gate, not mere
// element presence.
function displayMap(page: Page): Promise<Record<string, string>> {
  return page.getByTestId('cm-table-hotspot').evaluateAll((els) => {
    const out: Record<string, string> = {}
    for (const el of els) {
      const kind = (el as HTMLElement).dataset.type
      const index = (el as HTMLElement).dataset.col ?? (el as HTMLElement).dataset.row
      out[`${kind}:${index}`] = getComputedStyle(el).display
    }
    return out
  })
}

const visible = (map: Record<string, string>): string[] =>
  Object.entries(map)
    .filter(([, v]) => v !== 'none')
    .map(([k]) => k)
    .sort()

test('(a) 仅贴近的列边界显示热点，其余全部隐藏', async ({ page }) => {
  await openEditor(page)

  // Baseline: entering the table itself reveals nothing until the pointer is
  // on a line.
  await page.getByTestId('cm-table').locator('td[data-row="1"][data-col="1"]').hover()
  await settle(page)
  expect(visible(await displayMap(page))).toEqual([])

  for (const col of [1, 2]) {
    await pointAtBoundary(page, 'col', col)
    expect(visible(await displayMap(page)), `hovering col boundary ${col}`).toEqual([`col:${col}`])
  }
})

test('(a) 仅贴近的行边界显示热点，其余全部隐藏', async ({ page }) => {
  await openEditor(page)

  for (let row = 0; row < 3; row += 1) {
    await pointAtBoundary(page, 'row', row)
    expect(visible(await displayMap(page)), `hovering row boundary ${row}`).toEqual([`row:${row}`])
  }
})

test('(a) 移开表格后所有热点回到隐藏', async ({ page }) => {
  await openEditor(page)
  await pointAtBoundary(page, 'col', 1)
  expect(visible(await displayMap(page))).toEqual(['col:1'])

  await page.mouse.move(10, 10)
  await settle(page)
  expect(visible(await displayMap(page))).toEqual([])
})

test('(c) 插入列后 DOM 结构与源码同步（原位更新而非残影）', async ({ page }) => {
  await openEditor(page)
  await pointAtBoundary(page, 'col', 1)
  await page.locator('[data-testid="cm-table-hotspot"][data-type="col"][data-col="1"]').click()
  await settle(page)

  const table = page.getByTestId('cm-table')
  await expect(table.locator('thead th')).toHaveCount(4)
  const header = table.locator('thead th .cm-table-cell-text')
  expect((await header.allInnerTexts()).map((t) => t.trim())).toEqual(['A', '', 'B', 'C'])
  const firstRow = table.locator('tbody tr').first().locator('td .cm-table-cell-text')
  expect((await firstRow.allInnerTexts()).map((t) => t.trim())).toEqual(['1', '', '2', '3'])
})

test('(b) 末列格内手柄悬停不弹插入菜单，点击才打开', async ({ page }) => {
  await openEditor(page)

  const cell = page.getByTestId('cm-table').locator('td[data-row="0"][data-col="2"]')
  const box = (await cell.boundingBox())!
  const handle = cell.locator('.cm-table-cell-handle')

  // Casual brush across the last column's top-right handle region.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await settle(page)
  await page.mouse.move(box.x + box.width - 6, box.y + 6)
  await settle(page)
  await expect(page.getByTestId('slash-menu')).toHaveCount(0)

  // A deliberate press opens the menu...
  await handle.click()
  await settle(page)
  const menu = page.getByTestId('slash-menu')
  await expect(menu).toBeVisible()

  // ...and it survives the pointer moving back into the cell.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await settle(page)
  await expect(page.getByTestId('slash-menu')).toBeVisible()
})
