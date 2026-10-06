// #286（change editor-doubao-parity 5.2）：表格悬停列上方/行左侧「＋」加列/加行。
// #385a：热点改为边界级门控——先把指针移到某条边界线上，才显示该条「＋」。
// 运行：pnpm --filter @md-bundle/web exec playwright test test/table-add.spec.ts
import { expect, test, type Locator, type Page } from '@playwright/test'

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
    name: 'table-add.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
  // Absorb CM6's one-time widget re-render on first pointer entry so the
  // boundary-move reveal below is not lost to it.
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

function sepCellCount(source: string): number {
  const sep = source.split('\n').find((l) => l.includes('---')) ?? ''
  return sep.split('|').filter((c) => c.trim().length > 0).length
}

// The boundary strip is pointer-events:none; the reveal listens for mousemove
// on the wrap, so the pointer must land on the line's coordinate to light the dot.
async function pointAtBoundary(page: Page, type: 'col' | 'row'): Promise<Locator> {
  const boundary = page.locator(`[data-testid="cm-table-boundary"][data-type="${type}"]`).first()
  const box = await boundary.boundingBox()
  if (!box) throw new Error('boundary has no bounding box')
  const x = type === 'col' ? box.x + box.width / 2 : box.x + box.width / 4
  const y = type === 'col' ? box.y + 8 : box.y + box.height / 2
  // Touch the content first: CM6 re-renders the widget once on first pointer
  // entry (and after a mode switch), which would otherwise drop the reveal.
  await page.getByTestId('cm-table').locator('td[data-row="0"][data-col="0"]').hover()
  await settle(page)
  await page.mouse.move(x, y)
  await settle(page)
  return page.locator(`[data-testid="cm-table-hotspot"][data-type="${type}"]`).first()
}

test('AC: 悬停列边界点「＋」后新增一列（源码列数 +1）', async ({ page }) => {
  await openEditor(page)

  expect(sepCellCount(await rawDoc(page))).toBe(2)

  const addCol = await pointAtBoundary(page, 'col')
  await expect(addCol).toBeVisible()
  await addCol.click()
  await settle(page)

  expect(sepCellCount(await rawDoc(page))).toBe(3)
})

test('AC: 悬停行边界点「＋」后新增一行（源码行数 +1）', async ({ page }) => {
  await openEditor(page)

  const rowLines = (source: string): number =>
    source.split('\n').filter((l) => l.trim().startsWith('|')).length
  expect(rowLines(await rawDoc(page))).toBe(3) // header + separator + 1 body row

  const addRow = await pointAtBoundary(page, 'row')
  await expect(addRow).toBeVisible()
  await addRow.click()
  await settle(page)

  expect(rowLines(await rawDoc(page))).toBe(4)
})
