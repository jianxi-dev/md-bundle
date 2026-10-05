// editor-fidelity-2 / 2.5 色板保真（#360）e2e：
//   R-COLOR-01 字体色 A×8（默认 + 7 色，原型机读值）
//   R-COLOR-02 背景色 16 格（首格无/斜线 + 15 色）
//   R-COLOR-03 块菜单「颜色›」与工具条颜色面板共用同一色板组件
// 运行：pnpm --filter @md-bundle/web exec playwright test test/color-palette-fidelity2.spec.ts
import { expect, test, type Locator, type Page } from '@playwright/test'

test.use({ viewport: { width: 1440, height: 900 } })

const DOC = `# Color Palette Fidelity

UNIQUEMARKER

Plain paragraph target.
`

// 原型 §2.6 fontColors（含默认 #ebebeb），顺序即 DOM 顺序。
const FONT_VALUES = [
  '#ebebeb',
  '#f0000e',
  '#f2962c',
  '#f0b622',
  '#419e34',
  '#20b2aa',
  '#4c88ff',
  '#8a5cf6',
]

// 原型 §2.6 bgColors（15 色）；色板首格为「无」。
const BG_VALUES = [
  '#f0000e',
  '#f2962c',
  '#f0b622',
  '#419e34',
  '#20b2aa',
  '#4c88ff',
  '#8a5cf6',
  '#ebebeb',
  '#b34444',
  '#845117',
  '#877b10',
  '#296b22',
  '#203e78',
  '#4d2691',
  '#5f5f5f',
]

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'color-palette-fidelity2.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
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

/** Hover a block line, then the handle (which auto-opens the menu since #325). */
async function openBlockMenu(page: Page, text: string): Promise<void> {
  const line = page.locator('.cm-content .cm-line').filter({ hasText: text }).first()
  await expect(line).toBeVisible()
  const lb = await line.boundingBox()
  if (!lb) throw new Error('line has no bounding box')
  await page.mouse.move(lb.x + 20, lb.y + lb.height / 2)
  await settle(page)
  const handle = page.getByTestId('block-handle')
  await expect(handle).toBeVisible()
  const hb = await handle.boundingBox()
  if (!hb) throw new Error('handle has no bounding box')
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2)
  await settle(page)
  await expect(page.getByTestId('block-handle-menu')).toBeVisible()
}

/** Hover the 颜色 row so its shared palette mounts inside the flyout. */
async function openBlockColorFlyout(page: Page): Promise<Locator> {
  const row = page.locator('.mdb-block-handle-menu [data-flyout="color"]')
  await expect(row).toBeVisible()
  const rb = await row.boundingBox()
  if (!rb) throw new Error('color row has no bounding box')
  await page.mouse.move(rb.x + rb.width / 2, rb.y + rb.height / 2)
  await settle(page)
  const flyout = page.locator('.mdb-block-handle-flyout[data-flyout="color"]')
  await expect(flyout).toBeVisible()
  return flyout
}

async function fontValues(palette: Locator): Promise<string[]> {
  return palette.locator('.mdb-color-font-swatch').evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-color') ?? ''),
  )
}

async function bgValues(palette: Locator): Promise<string[]> {
  return palette.locator('.mdb-color-bg-swatch').evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-color') ?? ''),
  )
}

/** Full DOM signature (tag + class, in document order) so two surfaces can be compared. */
async function paletteSignature(palette: Locator): Promise<string> {
  return palette.evaluate((root) =>
    Array.from(root.querySelectorAll('*'))
      .map((el) => `${el.tagName}|${el.className}`)
      .join(','),
  )
}

/** Shared palette contract asserted identically on both surfaces. */
async function expectPaletteContract(palette: Locator): Promise<void> {
  await expect(palette.locator('.mdb-color-row-label')).toHaveText(['字体色', '背景色'])

  // R-COLOR-01: exactly 8 A-swatches, prototype values in order.
  const fontSwatches = palette.locator('.mdb-color-font-swatch')
  await expect(fontSwatches).toHaveCount(8)
  expect(await fontValues(palette)).toEqual(FONT_VALUES)
  await expect(fontSwatches.locator('.mdb-color-swatch-text-glyph')).toHaveCount(8)

  // R-COLOR-02: exactly 16 background swatches; first is "none", 15 colors follow.
  const bgSwatches = palette.locator('.mdb-color-bg-swatch')
  await expect(bgSwatches).toHaveCount(16)
  const bg = await bgValues(palette)
  expect(bg[0]).toBe('')
  expect(bg.slice(1)).toEqual(BG_VALUES)

  // Default/none cells render transparent with a diagonal slash.
  await expect(palette.locator('.mdb-color-font-swatch.mdb-color-swatch-default')).toHaveCount(1)
  await expect(palette.locator('.mdb-color-bg-swatch.mdb-color-swatch-default')).toHaveCount(1)
  await expect(palette.locator('.mdb-color-swatch-slash')).toHaveCount(2)

  // Fixed 8-column 18px grid on both rows.
  const columns = (row: number): Promise<string> =>
    palette.locator('.mdb-color-swatches').nth(row).evaluate((el) => getComputedStyle(el).gridTemplateColumns)
  expect((await columns(0)).split(' ')).toEqual(Array(8).fill('18px'))
  expect((await columns(1)).split(' ')).toEqual(Array(8).fill('18px'))

  // 恢复默认: full-width, 30px tall.
  const reset = palette.locator('.mdb-color-reset')
  await expect(reset).toHaveText('恢复默认')
  const resetBox = await reset.boundingBox()
  expect(resetBox?.height).toBeCloseTo(30, 0)
}

test.describe('色板保真（R-COLOR-01/02/03）', () => {
  test('R-COLOR-01/02 工具条颜色面板：A×8 + 背景色×16 精确色值', async ({ page }) => {
    await openEditor(page)
    await page.locator('.cm-content .cm-line').filter({ hasText: 'UNIQUEMARKER' }).first().dblclick()
    await settle(page)

    const menu = await openColorPopup(page)
    const palette = menu.locator('.mdb-color-palette')
    await expect(palette).toBeVisible()
    await expectPaletteContract(palette)
  })

  test('R-COLOR-01/02 块菜单「颜色›」：同一色板契约', async ({ page }) => {
    await openEditor(page)
    await openBlockMenu(page, 'Plain paragraph target.')
    const flyout = await openBlockColorFlyout(page)

    const palette = flyout.locator('.mdb-color-palette')
    await expect(palette).toBeVisible()
    await expectPaletteContract(palette)
  })

  test('R-COLOR-03 块菜单与工具条渲染同一色板 DOM', async ({ page }) => {
    await openEditor(page)

    // Toolbar surface first.
    await page.locator('.cm-content .cm-line').filter({ hasText: 'UNIQUEMARKER' }).first().dblclick()
    await settle(page)
    const toolbarPalette = (await openColorPopup(page)).locator('.mdb-color-palette')
    await expect(toolbarPalette).toBeVisible()
    const toolbarSignature = await paletteSignature(toolbarPalette)

    // Collapse the selection, then open the block-handle surface.
    await page.locator('.cm-content .cm-line').filter({ hasText: 'Plain paragraph target.' }).first().click()
    await settle(page)
    await openBlockMenu(page, 'Plain paragraph target.')
    const blockPalette = (await openBlockColorFlyout(page)).locator('.mdb-color-palette')
    await expect(blockPalette).toBeVisible()
    const blockSignature = await paletteSignature(blockPalette)

    expect(toolbarSignature).toBe(blockSignature)
    expect(toolbarSignature).toContain('mdb-color-font-swatch')
    expect(toolbarSignature).toContain('mdb-color-bg-swatch')
  })

  test('工具条：应用字体色/背景色改变文档，恢复默认清除两类标记', async ({ page }) => {
    await openEditor(page)
    await page.locator('.cm-content .cm-line').filter({ hasText: 'UNIQUEMARKER' }).first().dblclick()
    await settle(page)

    let menu = await openColorPopup(page)
    await menu.locator('.mdb-color-font-swatch[title="黄色"]').click()
    await settle(page)

    // Edit-mode render: the applied mark is actually tinted.
    const yellow = page.locator('.cm-content .cm-color-yellow').first()
    await expect(yellow).toBeVisible()
    const yellowColor = await yellow.evaluate((el) => getComputedStyle(el).color)
    expect(yellowColor).toMatch(/rgb\(240, 182, 34\)/)

    menu = await openColorPopup(page)
    await menu.locator('.mdb-color-bg-swatch[title="深灰"]').click()
    await settle(page)
    const slate = page.locator('.cm-content .cm-bg-slate').first()
    await expect(slate).toBeVisible()
    const slateBg = await slate.evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(slateBg).not.toBe('rgba(0, 0, 0, 0)')

    let raw = await rawDoc(page)
    expect(raw).toContain('mdb-color-yellow')
    expect(raw).toContain('mdb-bg-slate')

    await page.locator('.cm-content .cm-bg-slate').first().dblclick()
    await settle(page)
    menu = await openColorPopup(page)
    await menu.locator('.mdb-color-reset').click()
    await settle(page)

    raw = await rawDoc(page)
    expect(raw).not.toContain('mdb-color-')
    expect(raw).not.toContain('mdb-bg-')
    expect(raw).toContain('UNIQUEMARKER')
  })

  test('块菜单：应用字体色改变文档，恢复默认清除标记', async ({ page }) => {
    await openEditor(page)
    await openBlockMenu(page, 'Plain paragraph target.')
    let flyout = await openBlockColorFlyout(page)
    await flyout.locator('.mdb-color-font-swatch[title="青色"]').click()
    await settle(page)

    let raw = await rawDoc(page)
    expect(raw).toContain('mdb-color-cyan')

    await openBlockMenu(page, 'Plain paragraph target.')
    flyout = await openBlockColorFlyout(page)
    await flyout.locator('.mdb-color-reset').click()
    await settle(page)

    raw = await rawDoc(page)
    expect(raw).not.toContain('mdb-color-')
    expect(raw).toContain('Plain paragraph target.')
  })
})
