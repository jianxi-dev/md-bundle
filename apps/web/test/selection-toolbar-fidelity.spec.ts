// #328（change editor-fidelity 7.1 / W5）：选区工具栏保真
//   （字体色=彩色字母 A；表格单元格选区 → 合并单元格 / 单元格背景色）
// 运行：pnpm --filter @md-bundle/web exec playwright test test/selection-toolbar-fidelity.spec.ts
import { expect, test, type Page, type Locator } from '@playwright/test'

test.use({ viewport: { width: 1440, height: 900 } })

const DOC = `# Selection Toolbar Fidelity

UNIQUEMARKER

| A | B |
| --- | --- |
| 1 | 2 |
| 3 | 4 |
`

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'selection-toolbar-fidelity.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

/** Double-click the single-word line to select the whole word. */
async function selectWord(page: Page, word: string): Promise<void> {
  const line = page.locator('.cm-content .cm-line').filter({ hasText: word }).first()
  await expect(line).toBeVisible()
  await line.dblclick()
  await settle(page)
}

/** Switch to source mode, read raw Markdown, switch back to edit mode. */
async function rawDoc(page: Page): Promise<string> {
  await page.getByTestId('mode-source-btn').click()
  await expect(page.locator('.cm-content').first()).toBeVisible()
  const text = await page.locator('.cm-content').first().innerText()
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
  return text
}

async function openColorPopup(page: Page): Promise<Locator> {
  const colorBtn = page.locator('.mdb-floating-toolbar .mdb-toolbar-dropdown-btn[title="颜色"]')
  await expect(colorBtn).toBeVisible()
  await colorBtn.click()
  await settle(page)
  const menu = page.locator('.mdb-toolbar-dropdown-menu.mdb-toolbar-color-menu')
  await expect(menu).toBeVisible()
  return menu
}

function bodyCell(page: Page, row: number, col: number): Locator {
  return page.getByTestId('cm-table').locator(`td[data-row="${row}"][data-col="${col}"]`)
}

/** Drag across cells to build a rectangular cell selection (no editor opens). */
async function dragCells(page: Page, from: Locator, to: Locator): Promise<void> {
  const a = await from.boundingBox()
  const b = await to.boundingBox()
  if (!a || !b) throw new Error('cell bounding box unavailable')
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 })
  await page.mouse.up()
  await settle(page)
}

test.describe('字体色 = 彩色字母 A；背景色 = 色块（#328）', () => {
  test('字体色每项是一个 tinted「A」字母，背景色是实心色块', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')
    const menu = await openColorPopup(page)

    const textSwatches = menu.locator('.mdb-color-font-swatch')
    await expect(textSwatches).toHaveCount(8)
    const glyphTexts = await textSwatches.locator('span.mdb-color-swatch-text-glyph').allTextContents()
    expect(glyphTexts).toEqual(['A', 'A', 'A', 'A', 'A', 'A', 'A', 'A'])

    const redGlyph = menu.locator('.mdb-color-font-swatch[title="红色"] span.mdb-color-swatch-text-glyph')
    const redColor = await redGlyph.evaluate((el) => window.getComputedStyle(el).color)
    expect(redColor).toMatch(/rgb\(240, 0, 14\)/i)

    // The font row is a glyph, not a filled swatch.
    const redFontBg = await menu
      .locator('.mdb-color-font-swatch[title="红色"]')
      .evaluate((el) => window.getComputedStyle(el).backgroundColor)
    expect(redFontBg).toMatch(/rgba?\(0, 0, 0, 0\)|transparent/i)

    // The background row keeps solid swatches.
    const blueBg = menu.locator('.mdb-color-bg-swatch[title="蓝色"]')
    const blueBgColor = await blueBg.evaluate((el) => window.getComputedStyle(el).backgroundColor)
    expect(blueBgColor).toMatch(/rgb\(76, 136, 255\)/i)
  })
})

test.describe('表格单元格选区工具栏（#328）', () => {
  test('单选单元格：工具栏出现且「合并单元格」禁用', async ({ page }) => {
    await openEditor(page)
    await bodyCell(page, 0, 0).click()
    await settle(page)

    const toolbar = page.getByTestId('cell-toolbar')
    await expect(toolbar).toBeVisible()
    const merge = page.getByTestId('cell-merge')
    await expect(merge).toBeVisible()
    await expect(merge).toBeDisabled()
  })

  test('多选单元格（拖拽）：合并单元格启用', async ({ page }) => {
    await openEditor(page)
    await dragCells(page, bodyCell(page, 0, 0), bodyCell(page, 0, 1))

    const merge = page.getByTestId('cell-merge')
    await expect(merge).toBeVisible()
    await expect(merge).toBeEnabled()
  })

  test('多选后合并：文本并入左上单元格，源码无原始 | 行', async ({ page }) => {
    await openEditor(page)
    await dragCells(page, bodyCell(page, 0, 0), bodyCell(page, 0, 1))
    await page.getByTestId('cell-merge').click()
    await settle(page)

    const raw = await rawDoc(page)
    expect(raw).toContain('| 1 2 |')
    // Still a single table (widget renders), not collapsed source.
    await expect(page.getByTestId('cm-table')).toBeVisible()
  })

  test('单元格背景色：应用到单元格并在源码写 mdb-bg-*', async ({ page }) => {
    await openEditor(page)
    await bodyCell(page, 0, 0).click()
    await settle(page)

    await page.getByTestId('cell-bg').click()
    await settle(page)
    const swatch = page.locator('.mdb-cell-toolbar-menu .mdb-color-swatch-bg[title="蓝色"]')
    await expect(swatch).toBeVisible()
    await swatch.click()
    await settle(page)

    const bg = await bodyCell(page, 0, 0).evaluate(
      (el) => window.getComputedStyle(el).backgroundColor,
    )
    expect(bg).not.toMatch(/rgba?\(0, 0, 0, 0\)|transparent/i)

    const raw = await rawDoc(page)
    expect(raw).toContain('<span class="mdb-bg-blue">1</span>')
  })

  test('恢复默认：移除单元格背景类与颜色', async ({ page }) => {
    await openEditor(page)
    await bodyCell(page, 0, 0).click()
    await settle(page)

    await page.getByTestId('cell-bg').click()
    await settle(page)
    await page.locator('.mdb-cell-toolbar-menu .mdb-color-swatch-bg[title="绿色"]').click()
    await settle(page)

    await page.getByTestId('cell-bg').click()
    await settle(page)
    const reset = page.locator('.mdb-cell-toolbar-menu .mdb-cell-toolbar-reset')
    await expect(reset).toBeVisible()
    await reset.click()
    await settle(page)

    const cell = bodyCell(page, 0, 0)
    await expect(cell).not.toHaveClass(/cm-table-cell-bg-/)

    // Clear the selection first: the live selection highlight paints the cell
    // too, which would otherwise mask the (now transparent) cell background.
    await page.locator('.cm-content .cm-line').filter({ hasText: 'UNIQUEMARKER' }).first().click()
    await settle(page)
    const bg = await cell.evaluate((el) => window.getComputedStyle(el).backgroundColor)
    expect(bg).toMatch(/rgba?\(0, 0, 0, 0\)|transparent/i)

    const raw = await rawDoc(page)
    expect(raw).not.toContain('mdb-bg-')
  })

  test('点击表格外：工具栏隐藏且无残留选中态', async ({ page }) => {
    await openEditor(page)
    await dragCells(page, bodyCell(page, 0, 0), bodyCell(page, 0, 1))
    await expect(page.getByTestId('cell-toolbar')).toBeVisible()

    await page.locator('.cm-content .cm-line').filter({ hasText: 'UNIQUEMARKER' }).first().click()
    await settle(page)

    await expect(page.getByTestId('cell-toolbar')).toBeHidden()
    await expect(page.locator('.cm-table-cell-selected')).toHaveCount(0)
  })
})
