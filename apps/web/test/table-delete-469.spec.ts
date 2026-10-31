// #469：表格删除行/列。插入入口在边界热点上，删除作为同一气泡里的第二个动作。
import { expect, test, type Page } from '@playwright/test'

test.use({ viewport: { width: 1440, height: 1000 } })
const DOC = `# T

| A | B | C |
| --- | --- | --- |
| 1 | 2 | 3 |
| 4 | 5 | 6 |
| 7 | 8 | 9 |

尾。
`

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'table-delete-469.md',
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

// 边界条是 pointer-events:none，热点靠指针靠近才显形；先触发一次 re-render，
// 再把指针放到边界坐标上（与 table-add.spec.ts 的 pointAtBoundary 同法）。
async function pointAt(page: Page, type: 'col' | 'row', index: number): Promise<void> {
  const boundary = page.locator(`[data-testid="cm-table-boundary"][data-type="${type}"]`)
    .filter({ has: page.locator(`[data-${type}="${index}"]`) })
    .first()
  const box = await boundary.boundingBox()
  if (!box) throw new Error('boundary has no bounding box')
  const x = type === 'col' ? box.x + box.width / 2 : box.x + box.width / 4
  const y = type === 'col' ? box.y + 8 : box.y + box.height / 2
  await page.getByTestId('cm-table').locator('td[data-row="0"][data-col="0"]').hover()
  await settle(page)
  await page.mouse.move(x, y)
  await settle(page)
}

test('行边界气泡提供「删除」并删掉该行', async ({ page }) => {
  await openEditor(page)
  await pointAt(page, 'row', 1)
  const boundary = page.locator('.cm-table-boundary-row[data-row="1"]').first()
  await expect(boundary).toHaveCount(1)
  const hotspot = boundary.locator('.cm-table-hotspot')
  await expect(hotspot).toBeVisible()
  await hotspot.hover()
  await settle(page)

  const del = boundary.locator('.cm-table-boundary-delete')
  await expect(del).toBeVisible()
  await del.click()
  await settle(page)

  const doc = await rawDoc(page)
  expect(doc).not.toContain('| 4 | 5 | 6 |')
  expect(doc).toContain('| 1 | 2 | 3 |')
  expect(doc).toContain('| 7 | 8 | 9 |')
})

test('列边界气泡提供「删除」并删掉该列', async ({ page }) => {
  await openEditor(page)
  await pointAt(page, 'col', 1)
  const boundary = page.locator('.cm-table-boundary-col[data-col="1"]').first()
  await expect(boundary).toHaveCount(1)
  const hotspot = boundary.locator('.cm-table-hotspot')
  await expect(hotspot).toBeVisible()
  await hotspot.hover()
  await settle(page)

  const del = boundary.locator('.cm-table-boundary-delete')
  await expect(del).toBeVisible()
  await del.click()
  await settle(page)

  const doc = await rawDoc(page)
  // 中间列（B）整列消失
  expect(doc).not.toContain('| B |')
  expect(doc).toContain('| A | C |')
  expect(doc).toContain('| 1 | 3 |')
})
