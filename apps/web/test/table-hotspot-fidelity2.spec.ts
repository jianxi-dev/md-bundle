// #359（change editor-fidelity-2 / 2.4）：表格行列插入热点保真。
// 覆盖 R-TABLE-01（hover 门控）、R-TABLE-02（贴边界 ±2px）、R-TABLE-03（点中心落光标不插行/列）、
// R-TABLE-04（格内手柄悬停 → 插入菜单）、R-TABLE-05（块菜单表格三项，轻量回归）。
// 运行：pnpm --filter @md-bundle/web exec playwright test test/table-hotspot-fidelity2.spec.ts
import { expect, test, type Locator, type Page } from '@playwright/test'

const DOC = `Intro paragraph.

| A | B |
| --- | --- |
| 1 | 2 |
| 3 | 4 |
`

const TABLE_DOC = `
| H1 | H2 |
| --- | --- |
| a | b |`

test.use({ viewport: { width: 1440, height: 900 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page, doc: string = DOC, name = 'table-hotspot.md'): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name,
    mimeType: 'text/markdown',
    buffer: Buffer.from(doc),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

async function boxOf(
  locator: Locator,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox()
  if (!box) throw new Error('element has no bounding box')
  return box
}

function bodyCell(page: Page, row: number, col: number): Locator {
  return page.getByTestId('cm-table').locator(`td[data-row="${row}"][data-col="${col}"]`)
}

function hotspots(page: Page, type: 'col' | 'row'): Locator {
  return page.locator(`[data-testid="cm-table-hotspot"][data-type="${type}"]`)
}

// ── R-TABLE-01: hover 门控 ────────────────────────────────────────────────
test('A-18.1 非 hover 时行列热点 display:none', async ({ page }) => {
  await openEditor(page)

  expect(await hotspots(page, 'col').count()).toBeGreaterThan(0)
  expect(await hotspots(page, 'row').count()).toBeGreaterThan(0)

  const visible = await page.getByTestId('cm-table-hotspot').evaluateAll(
    (els) => els.filter((el) => getComputedStyle(el).display !== 'none').length,
  )
  expect(visible).toBe(0)

  await page.screenshot({ path: '../../.artifacts/359/01-non-hover-hidden.png' })
})

test('A-18.2 悬停单元格后现蓝色「+」与「插入行」/「插入列」气泡', async ({ page }) => {
  await openEditor(page)
  await bodyCell(page, 0, 0).hover()
  await settle(page)

  const colHotspot = hotspots(page, 'col').first()
  const rowHotspot = hotspots(page, 'row').first()
  await expect(colHotspot).toBeVisible()
  await expect(rowHotspot).toBeVisible()

  await expect(colHotspot).toHaveAttribute('title', '插入列')
  await expect(rowHotspot).toHaveAttribute('title', '插入行')

  // Hovering a dot shows its bubble + boundary highlight line.
  await colHotspot.hover()
  await settle(page)
  await expect(colHotspot.locator('.cm-table-hotspot-bubble')).toBeVisible()
  await expect(colHotspot.locator('.cm-table-hotspot-bubble')).toHaveText('插入列')
  await expect(page.locator('.cm-table-boundary-active')).toHaveCount(1)

  await page.screenshot({ path: '../../.artifacts/359/02-hover-hotspots.png' })
})

test('A-18.3 移开边界后 elementFromPoint 不含 cm-table-boundary', async ({ page }) => {
  await openEditor(page)
  await bodyCell(page, 0, 0).hover()
  await settle(page)

  const hotspot = hotspots(page, 'row').first()
  await hotspot.hover()
  await settle(page)
  await expect(page.locator('.cm-table-boundary-active')).toHaveCount(1)

  const boundary = hotspot.locator('xpath=ancestor::*[@data-testid="cm-table-boundary"]')
  const bBox = await boxOf(boundary)
  const point = { x: bBox.x + bBox.width / 2, y: bBox.y + bBox.height / 2 }

  await page.mouse.move(10, 10)
  await settle(page)
  await expect(page.locator('.cm-table-boundary-active')).toHaveCount(0)

  const inBoundary = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.closest('.cm-table-boundary') !== null,
    point,
  )
  expect(inBoundary).toBe(false)

  await page.screenshot({ path: '../../.artifacts/359/08-boundary-move-away.png' })
})

// ── R-TABLE-02: 热点贴边界 ±2px ────────────────────────────────────────────
test('A-19.1 行「+」中心 y ≈ 相邻行边界 ±2px', async ({ page }) => {
  await openEditor(page)
  await bodyCell(page, 0, 0).hover()
  await settle(page)

  const rows = await hotspots(page, 'row').all()
  expect(rows.length).toBeGreaterThan(0)
  for (const hotspot of rows) {
    const row = Number(await hotspot.getAttribute('data-row'))
    const hsBox = await boxOf(hotspot)
    const rowBox = await boxOf(bodyCell(page, row, 0))
    // Measure the RENDERED boundary line, not the same cell edge the widget
    // used: the line must sit on the row boundary, and the dot on the line.
    const lineBox = await boxOf(
      page.locator(
        `[data-testid="cm-table-boundary"][data-type="row"][data-row="${row}"] .cm-table-boundary-line`,
      ),
    )
    const centerY = hsBox.y + hsBox.height / 2
    const lineCenterY = lineBox.y + lineBox.height / 2
    expect(Math.abs(lineCenterY - rowBox.y), `row ${row} line vs boundary`).toBeLessThanOrEqual(2)
    expect(Math.abs(centerY - lineCenterY), `row ${row} dot vs line`).toBeLessThanOrEqual(2)
  }

  await page.screenshot({ path: '../../.artifacts/359/03-row-geometry.png' })
})

test('A-19.2 列「+」中心 x ≈ 相邻列边界 ±2px', async ({ page }) => {
  await openEditor(page)
  await bodyCell(page, 0, 0).hover()
  await settle(page)

  const cols = await hotspots(page, 'col').all()
  expect(cols.length).toBeGreaterThan(0)
  for (const hotspot of cols) {
    const col = Number(await hotspot.getAttribute('data-col'))
    const hsBox = await boxOf(hotspot)
    const colBox = await boxOf(bodyCell(page, 0, col))
    // Measure the RENDERED boundary line independently (see the row case).
    const lineBox = await boxOf(
      page.locator(
        `[data-testid="cm-table-boundary"][data-type="col"][data-col="${col}"] .cm-table-boundary-line`,
      ),
    )
    const centerX = hsBox.x + hsBox.width / 2
    const lineCenterX = lineBox.x + lineBox.width / 2
    expect(Math.abs(lineCenterX - colBox.x), `col ${col} line vs boundary`).toBeLessThanOrEqual(2)
    expect(Math.abs(centerX - lineCenterX), `col ${col} dot vs line`).toBeLessThanOrEqual(2)
  }

  await page.screenshot({ path: '../../.artifacts/359/04-col-geometry.png' })
})

// ── R-TABLE-03: 点单元格中心落光标、不插行/列 ─────────────────────────────
test('A-20.1 点单元格中心 elementFromPoint=单元格且不插行/列', async ({ page }) => {
  await openEditor(page)

  const cell = bodyCell(page, 0, 0)
  await cell.hover()
  await settle(page)

  const hit = await cell.evaluate((el) => {
    const r = el.getBoundingClientRect()
    const node = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return {
      inCell: node !== null && el.contains(node),
      inBoundary: node?.closest('.cm-table-boundary') !== null,
      inHotspot: node?.closest('.cm-table-hotspot') !== null,
    }
  })
  expect(hit.inBoundary).toBe(false)
  expect(hit.inHotspot).toBe(false)
  expect(hit.inCell).toBe(true)

  const table = page.getByTestId('cm-table')
  const thBefore = await table.locator('th').count()
  const trBefore = await table.locator('tbody tr').count()

  await cell.click()
  await settle(page)
  await expect(page.getByTestId('cm-table-cell-input')).toBeFocused()

  // No structural change: the click placed the caret instead of inserting.
  await expect(table.locator('th')).toHaveCount(thBefore)
  await expect(table.locator('tbody tr')).toHaveCount(trBefore)

  await page.screenshot({ path: '../../.artifacts/359/05-click-cell-center.png' })
})

// ── R-TABLE-04: 格内手柄悬停 → 插入菜单 ───────────────────────────────────
test('A-21.1 悬停 .mdb-table-cell-handle → 插入菜单打开', async ({ page }) => {
  await openEditor(page)

  const cell = bodyCell(page, 0, 0)
  await cell.hover()
  await settle(page)

  const handle = cell.locator('.mdb-table-cell-handle')
  await expect(handle).toBeVisible()
  await handle.hover()
  await settle(page)

  const slashMenu = page.getByTestId('slash-menu')
  await expect(slashMenu).toBeVisible()
  await expect(slashMenu).toContainText('基础')
  await expect(slashMenu.locator('.mdb-slash-item').first()).toBeVisible()

  await page.screenshot({ path: '../../.artifacts/359/06-cell-handle-insert-menu.png' })
})

// ── R-TABLE-05: 块菜单表格三项（轻量回归） ────────────────────────────────
test('A-22.1 表格块菜单含「标题行」「标题列」「均分列宽」', async ({ page }) => {
  await openEditor(page, TABLE_DOC, 'table-menu.md')

  const line = page.locator('.cm-content .cm-line').filter({ hasText: 'H1' }).first()
  await expect(line).toBeVisible()
  const lineBox = await boxOf(line)
  await page.mouse.move(lineBox.x + 20, lineBox.y + lineBox.height / 2)
  await settle(page)

  const blockHandle = page.getByTestId('block-handle')
  await expect(blockHandle).toBeVisible()
  const handleBox = await boxOf(blockHandle)
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
  await settle(page)

  const menu = page.getByTestId('block-handle-menu')
  await expect(menu).toBeVisible()
  await expect(menu).toContainText('标题行')
  await expect(menu).toContainText('标题列')
  await expect(menu).toContainText('均分列宽')

  await page.screenshot({ path: '../../.artifacts/359/07-block-menu-table-items.png' })
})
