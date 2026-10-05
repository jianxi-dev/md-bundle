// #286（change editor-doubao-parity 5.2）：表格悬停列上方/行左侧「＋」加列/加行。
// 运行：pnpm --filter @md-bundle/web exec playwright test test/table-add.spec.ts
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
    name: 'table-add.md',
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

function sepCellCount(source: string): number {
  const sep = source.split('\n').find((l) => l.includes('---')) ?? ''
  return sep.split('|').filter((c) => c.trim().length > 0).length
}

test('AC: 悬停列边界点「＋」后新增一列（源码列数 +1）', async ({ page }) => {
  await openEditor(page)

  expect(sepCellCount(await rawDoc(page))).toBe(2)

  // Hotspots are hover-gated: reveal them by hovering a cell first.
  await page.getByTestId('cm-table').locator('td[data-row="0"][data-col="0"]').hover()
  const addCol = page.locator('[data-testid="cm-table-hotspot"][data-type="col"]')
  await expect(addCol).toHaveCount(1) // one interior boundary between the two columns
  await addCol.first().click()
  await settle(page)

  expect(sepCellCount(await rawDoc(page))).toBe(3)
})

test('AC: 悬停行边界点「＋」后新增一行（源码行数 +1）', async ({ page }) => {
  await openEditor(page)

  const rowLines = (source: string): number =>
    source.split('\n').filter((l) => l.trim().startsWith('|')).length
  expect(rowLines(await rawDoc(page))).toBe(3) // header + separator + 1 body row

  await page.getByTestId('cm-table').locator('td[data-row="0"][data-col="0"]').hover()
  const addRow = page.locator('[data-testid="cm-table-hotspot"][data-type="row"]')
  await expect(addRow).toHaveCount(1) // one top-boundary hotspot for the single body row
  await addRow.first().click()
  await settle(page)

  expect(rowLines(await rawDoc(page))).toBe(4)
})
