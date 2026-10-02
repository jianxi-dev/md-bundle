import { expect, test, type Page } from '@playwright/test'

test.use({ viewport: { width: 1200, height: 800 } })

// UNIQUEMARKER sits alone on its line so dblclick reliably selects the whole
// word (the line center is the word center). BOTTOMMARKER likewise.
const DOC = `# Selection Toolbar Test

UNIQUEMARKER

Another normal paragraph here.

BOTTOMMARKER near end.
`

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'selection-toolbar.md',
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

test.describe('选区浮条：11 控件 + 颜色弹出面板/对齐/转换 + 切换（#261 + #262 + #277 + #278）', () => {
  test('选中文本后浮条出现 11 个控件（无字体控件）', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    const toolbar = page.locator('.mdb-floating-toolbar')
    await expect(toolbar).toBeVisible()
    const buttons = toolbar.locator('.mdb-toolbar-btn, .mdb-toolbar-dropdown-btn')
    await expect(buttons).toHaveCount(11)
    const titles = await buttons.evaluateAll((els) =>
      els.map((e) => (e as HTMLButtonElement).title),
    )
    expect(titles).toEqual(['颜色', '对齐', '加粗', '删除线', '斜体', '下划线', '插入链接', '行内代码', '分栏', '复制', '转换'])
  })

  test('删除线 applies ~~…~~ and toggles off on second click', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    const strikeBtn = page.locator('.mdb-floating-toolbar .mdb-toolbar-btn[title="删除线"]')
    await expect(strikeBtn).toBeVisible()
    await strikeBtn.click()
    await settle(page)

    let raw = await rawDoc(page)
    expect(raw).toContain('~~UNIQUEMARKER~~')

    // Re-select the (now decorated) word and toggle off. In edit mode the ~~
    // markers are hidden by decorations, so dblclick selects the inner content
    // and toggle Case 2 detects the surrounding ~~ and strips them.
    await selectWord(page, 'UNIQUEMARKER')
    await expect(strikeBtn).toBeVisible()
    await strikeBtn.click()
    await settle(page)

    raw = await rawDoc(page)
    expect(raw).not.toContain('~~')
    expect(raw).toContain('UNIQUEMARKER')
  })

  test('下划线 applies <u>…</u>', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    const underlineBtn = page.locator('.mdb-floating-toolbar .mdb-toolbar-btn[title="下划线"]')
    await expect(underlineBtn).toBeVisible()
    await underlineBtn.click()
    await settle(page)

    const raw = await rawDoc(page)
    expect(raw).toContain('<u>UNIQUEMARKER</u>')
  })

  test('复制 puts the selected text on the clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    const copyBtn = page.locator('.mdb-floating-toolbar .mdb-toolbar-btn[title="复制"]')
    await expect(copyBtn).toBeVisible()
    await copyBtn.click()
    await settle(page)

    const clip = await page.evaluate(() => navigator.clipboard.readText())
    expect(clip).toContain('UNIQUEMARKER')
  })

  test('颜色弹出面板：字体色红色 + 恢复默认', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    const colorBtn = page.locator('.mdb-floating-toolbar .mdb-toolbar-dropdown-btn[title="颜色"]')
    await expect(colorBtn).toBeVisible()
    await colorBtn.click()
    await settle(page)

    const menu = page.locator('.mdb-toolbar-dropdown-menu.mdb-toolbar-color-menu')
    await expect(menu).toBeVisible()
    const redSwatch = menu.locator('.mdb-color-swatch-text[title="红色"]')
    await expect(redSwatch).toBeVisible()
    await redSwatch.click()
    await settle(page)

    let raw = await rawDoc(page)
    expect(raw).toContain('<span class="mdb-color-red">UNIQUEMARKER</span>')

    await selectWord(page, 'UNIQUEMARKER')
    await colorBtn.click()
    await settle(page)
    const reset = page.locator('.mdb-toolbar-dropdown-menu.mdb-toolbar-color-menu .mdb-color-reset')
    await expect(reset).toBeVisible()
    await reset.click()
    await settle(page)

    raw = await rawDoc(page)
    expect(raw).not.toContain('mdb-color-')
    expect(raw).toContain('UNIQUEMARKER')
  })

  test('预览模式下字体色与背景色渲染保真', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    const colorBtn = page.locator('.mdb-floating-toolbar .mdb-toolbar-dropdown-btn[title="颜色"]')
    await colorBtn.click()
    await settle(page)
    const menu = page.locator('.mdb-toolbar-dropdown-menu.mdb-toolbar-color-menu')
    await expect(menu).toBeVisible()
    await menu.locator('.mdb-color-swatch-text[title="红色"]').click()
    await settle(page)

    await colorBtn.click()
    await settle(page)
    await expect(menu).toBeVisible()
    await menu.locator('.mdb-color-swatch-bg[title="蓝色"]').click()
    await settle(page)

    await page.getByTestId('mode-preview-btn').click()
    await expect(page.locator('.preview-content').first()).toBeVisible()
    await settle(page)

    const previewWord = page.locator('.preview-content .mdb-color-red').first()
    await expect(previewWord).toBeVisible()
    const color = await previewWord.evaluate((el) => window.getComputedStyle(el).color)
    expect(color).toMatch(/rgb\(240, 97, 109\)|rgb\(207, 34, 46\)|#f0616d|#cf222e/i)

    const previewBg = page.locator('.preview-content .mdb-bg-blue').first()
    await expect(previewBg).toBeVisible()
    const bg = await previewBg.evaluate((el) => window.getComputedStyle(el).backgroundColor)
    expect(bg).not.toBe('rgba(0, 0, 0, 0)')
    expect(bg).not.toBe('transparent')
  })
})

test.describe('选区浮条：对齐下拉（左/中/右/清除）#262', () => {
  test('浮条包含 11 个控件（含对齐下拉）', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    const toolbar = page.locator('.mdb-floating-toolbar')
    await expect(toolbar).toBeVisible()
    const buttons = toolbar.locator('.mdb-toolbar-btn, .mdb-toolbar-dropdown-btn')
    await expect(buttons).toHaveCount(11)
    const titles = await buttons.evaluateAll((els) =>
      els.map((e) => (e as HTMLButtonElement).title),
    )
    expect(titles).toEqual(['颜色', '对齐', '加粗', '删除线', '斜体', '下划线', '插入链接', '行内代码', '分栏', '复制', '转换'])
  })

  test('对齐下拉：居中 wraps block in ::: {.align-center} … :::', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    const alignDropdown = page.locator('.mdb-floating-toolbar .mdb-toolbar-dropdown-btn[title="对齐"]')
    await expect(alignDropdown).toBeVisible()
    await alignDropdown.click()
    await settle(page)

    const centerOption = page.locator('.mdb-toolbar-dropdown-menu .mdb-toolbar-dropdown-option', { hasText: '居中' }).first()
    await expect(centerOption).toBeVisible()
    await centerOption.click()
    await settle(page)

    let raw = await rawDoc(page)
    expect(raw).toContain('::: {.align-center}')
    expect(raw).toContain('UNIQUEMARKER')
    expect(raw).toContain(':::')
  })

  test('对齐下拉：左对齐 wraps block in ::: {.align-left} … :::', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    const alignDropdown = page.locator('.mdb-floating-toolbar .mdb-toolbar-dropdown-btn[title="对齐"]')
    await alignDropdown.click()
    await settle(page)

    const leftOption = page.locator('.mdb-toolbar-dropdown-menu .mdb-toolbar-dropdown-option', { hasText: '左对齐' }).first()
    await expect(leftOption).toBeVisible()
    await leftOption.click()
    await settle(page)

    let raw = await rawDoc(page)
    expect(raw).toContain('::: {.align-left}')
    expect(raw).toContain('UNIQUEMARKER')
    expect(raw).toContain(':::')
  })

  test('对齐下拉：右对齐 wraps block in ::: {.align-right} … :::', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    const alignDropdown = page.locator('.mdb-floating-toolbar .mdb-toolbar-dropdown-btn[title="对齐"]')
    await alignDropdown.click()
    await settle(page)

    const rightOption = page.locator('.mdb-toolbar-dropdown-menu .mdb-toolbar-dropdown-option', { hasText: '右对齐' }).first()
    await expect(rightOption).toBeVisible()
    await rightOption.click()
    await settle(page)

    let raw = await rawDoc(page)
    expect(raw).toContain('::: {.align-right}')
    expect(raw).toContain('UNIQUEMARKER')
    expect(raw).toContain(':::')
  })

  test('对齐下拉：再次点击同一对齐 toggles off (removes wrapper)', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    const alignDropdown = page.locator('.mdb-floating-toolbar .mdb-toolbar-dropdown-btn[title="对齐"]')
    await alignDropdown.click()
    await settle(page)

    const centerOption = page.locator('.mdb-toolbar-dropdown-menu .mdb-toolbar-dropdown-option', { hasText: '居中' }).first()
    await centerOption.click()
    await settle(page)

    await selectWord(page, 'UNIQUEMARKER')
    await alignDropdown.click()
    await settle(page)
    await centerOption.click()
    await settle(page)

    let raw = await rawDoc(page)
    expect(raw).not.toContain('::: {.align-center}')
    expect(raw).not.toContain(':::')
    expect(raw).toContain('UNIQUEMARKER')
  })

  test('对齐下拉：切换对齐 replaces the class (center → left)', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    const alignDropdown = page.locator('.mdb-floating-toolbar .mdb-toolbar-dropdown-btn[title="对齐"]')
    await alignDropdown.click()
    await settle(page)

    const centerOption = page.locator('.mdb-toolbar-dropdown-menu .mdb-toolbar-dropdown-option', { hasText: '居中' }).first()
    await centerOption.click()
    await settle(page)

    await selectWord(page, 'UNIQUEMARKER')
    await alignDropdown.click()
    await settle(page)
    const leftOption = page.locator('.mdb-toolbar-dropdown-menu .mdb-toolbar-dropdown-option', { hasText: '左对齐' }).first()
    await leftOption.click()
    await settle(page)

    let raw = await rawDoc(page)
    expect(raw).not.toContain('::: {.align-center}')
    expect(raw).toContain('::: {.align-left}')
    expect(raw).toContain('UNIQUEMARKER')
  })

  test('对齐下拉：清除 removes alignment wrapper', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    const alignDropdown = page.locator('.mdb-floating-toolbar .mdb-toolbar-dropdown-btn[title="对齐"]')
    await alignDropdown.click()
    await settle(page)

    const centerOption = page.locator('.mdb-toolbar-dropdown-menu .mdb-toolbar-dropdown-option', { hasText: '居中' }).first()
    await centerOption.click()
    await settle(page)

    await selectWord(page, 'UNIQUEMARKER')
    await alignDropdown.click()
    await settle(page)
    // Wait for the 对齐 dropdown menu to be visible (it's the last dropdown in the toolbar)
    const alignMenu = page.locator('.mdb-toolbar-dropdown-menu').filter({ hasText: '左对齐' })
    await expect(alignMenu).toBeVisible()
    const clearOption = alignMenu.locator('.mdb-toolbar-dropdown-option', { hasText: '清除' }).first()
    await expect(clearOption).toBeVisible()
    await clearOption.click()
    await settle(page)

    let raw = await rawDoc(page)
    expect(raw).not.toContain('::: {.align-center}')
    expect(raw).not.toContain(':::')
    expect(raw).toContain('UNIQUEMARKER')
  })

  test('预览模式下对齐渲染保真：居中 shows text-align: center', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    const alignDropdown = page.locator('.mdb-floating-toolbar .mdb-toolbar-dropdown-btn[title="对齐"]')
    await alignDropdown.click()
    await settle(page)

    const centerOption = page.locator('.mdb-toolbar-dropdown-menu .mdb-toolbar-dropdown-option', { hasText: '居中' }).first()
    await centerOption.click()
    await settle(page)

    await page.getByTestId('mode-preview-btn').click()
    await expect(page.locator('.preview-content').first()).toBeVisible()
    await settle(page)

    const previewBlock = page.locator('.preview-content .layout-align-center').first()
    await expect(previewBlock).toBeVisible()

    const textAlign = await previewBlock.evaluate((el) => window.getComputedStyle(el).textAlign)
    expect(textAlign).toBe('center')
  })
})

/** Open the 分栏 visual picker and click the bar group for `count` columns. */
async function pickColumnBar(page: Page, count: number): Promise<void> {
  const colButton = page.locator('.mdb-floating-toolbar .mdb-toolbar-dropdown-btn[title="分栏"]')
  await expect(colButton).toBeVisible()
  await colButton.click()
  await settle(page)

  const option = page.locator(`.mdb-toolbar-columns-menu .mdb-column-option[data-columns="${count}"]`)
  await expect(option).toBeVisible()
  await option.click()
  await settle(page)
}

test.describe('选区浮条：分栏可视化栏数选择器（1 栏 / 2 栏 / 3 栏 / 4 栏 / 5 栏 / 清除）#263 + #290', () => {
  test('浮条包含 11 个控件（含分栏可视化选择器）', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    const toolbar = page.locator('.mdb-floating-toolbar')
    await expect(toolbar).toBeVisible()
    const buttons = toolbar.locator('.mdb-toolbar-btn, .mdb-toolbar-dropdown-btn')
    await expect(buttons).toHaveCount(11)
    const titles = await buttons.evaluateAll((els) =>
      els.map((e) => (e as HTMLButtonElement).title),
    )
    expect(titles).toEqual(['颜色', '对齐', '加粗', '删除线', '斜体', '下划线', '插入链接', '行内代码', '分栏', '复制', '转换'])
  })

  test('分栏选择器：1 栏 wraps block in ::: {.col-1} … :::', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    await pickColumnBar(page, 1)

    let raw = await rawDoc(page)
    expect(raw).toContain('::: {.col-1}')
    expect(raw).toContain('UNIQUEMARKER')
    expect(raw).toContain(':::')
  })

  test('分栏选择器：2 栏 wraps block in ::: {.col-2} … :::', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    await pickColumnBar(page, 2)

    let raw = await rawDoc(page)
    expect(raw).toContain('::: {.col-2}')
    expect(raw).toContain('UNIQUEMARKER')
    expect(raw).toContain(':::')
  })

  test('分栏选择器：3 栏 wraps block in ::: {.col-3} … :::', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    await pickColumnBar(page, 3)

    let raw = await rawDoc(page)
    expect(raw).toContain('::: {.col-3}')
    expect(raw).toContain('UNIQUEMARKER')
    expect(raw).toContain(':::')
  })

  test('分栏选择器：4 栏 wraps block in ::: {.col-4} … :::', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    await pickColumnBar(page, 4)

    let raw = await rawDoc(page)
    expect(raw).toContain('::: {.col-4}')
    expect(raw).toContain('UNIQUEMARKER')
    expect(raw).toContain(':::')
  })

  test('分栏选择器：5 栏 wraps block in ::: {.col-5} … :::', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    await pickColumnBar(page, 5)

    let raw = await rawDoc(page)
    expect(raw).toContain('::: {.col-5}')
    expect(raw).toContain('UNIQUEMARKER')
    expect(raw).toContain(':::')
  })

  test('分栏选择器：再次点击同一栏数 toggles off (removes wrapper)', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    await pickColumnBar(page, 2)

    await selectWord(page, 'UNIQUEMARKER')
    await pickColumnBar(page, 2)

    let raw = await rawDoc(page)
    expect(raw).not.toContain('::: {.col-2}')
    expect(raw).not.toContain(':::')
    expect(raw).toContain('UNIQUEMARKER')
  })

  test('分栏选择器：切换栏数 replaces the class (2 栏 → 3 栏)', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    await pickColumnBar(page, 2)

    await selectWord(page, 'UNIQUEMARKER')
    await pickColumnBar(page, 3)

    let raw = await rawDoc(page)
    expect(raw).not.toContain('::: {.col-2}')
    expect(raw).toContain('::: {.col-3}')
    expect(raw).toContain('UNIQUEMARKER')
  })

  test('分栏选择器：清除 removes column wrapper', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    await pickColumnBar(page, 2)

    await selectWord(page, 'UNIQUEMARKER')
    const colButton = page.locator('.mdb-floating-toolbar .mdb-toolbar-dropdown-btn[title="分栏"]')
    await colButton.click()
    await settle(page)
    const clearOption = page.locator('.mdb-toolbar-columns-menu .mdb-columns-clear')
    await expect(clearOption).toBeVisible()
    await clearOption.click()
    await settle(page)

    let raw = await rawDoc(page)
    expect(raw).not.toContain('::: {.col-2}')
    expect(raw).not.toContain(':::')
    expect(raw).toContain('UNIQUEMARKER')
  })

  test('预览模式下分栏渲染保真：1 栏 shows grid with 1 column', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    await pickColumnBar(page, 1)

    await page.getByTestId('mode-preview-btn').click()
    await expect(page.locator('.preview-content').first()).toBeVisible()
    await settle(page)

    const previewBlock = page.locator('.preview-content .layout-col-1').first()
    await expect(previewBlock).toBeVisible()

    const display = await previewBlock.evaluate((el) => window.getComputedStyle(el).display)
    expect(display).toBe('grid')

    const gridTemplateColumns = await previewBlock.evaluate((el) => window.getComputedStyle(el).gridTemplateColumns)
    // Should have 1 column
    const columnCount = gridTemplateColumns.split(' ').filter((s) => s.endsWith('px')).length
    expect(columnCount).toBe(1)
  })

  test('预览模式下分栏渲染保真：2 栏 shows grid with 2 columns', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    await pickColumnBar(page, 2)

    await page.getByTestId('mode-preview-btn').click()
    await expect(page.locator('.preview-content').first()).toBeVisible()
    await settle(page)

    const previewBlock = page.locator('.preview-content .layout-col-2').first()
    await expect(previewBlock).toBeVisible()

    const display = await previewBlock.evaluate((el) => window.getComputedStyle(el).display)
    expect(display).toBe('grid')

    const gridTemplateColumns = await previewBlock.evaluate((el) => window.getComputedStyle(el).gridTemplateColumns)
    // Should have 2 columns (computed as pixel values, e.g., "455.25px 455.25px")
    const columnCount = gridTemplateColumns.split(' ').filter((s) => s.endsWith('px')).length
    expect(columnCount).toBe(2)
  })

  test('预览模式下分栏渲染保真：3 栏 shows grid with 3 columns', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    await pickColumnBar(page, 3)

    await page.getByTestId('mode-preview-btn').click()
    await expect(page.locator('.preview-content').first()).toBeVisible()
    await settle(page)

    const previewBlock = page.locator('.preview-content .layout-col-3').first()
    await expect(previewBlock).toBeVisible()

    const display = await previewBlock.evaluate((el) => window.getComputedStyle(el).display)
    expect(display).toBe('grid')

    const gridTemplateColumns = await previewBlock.evaluate((el) => window.getComputedStyle(el).gridTemplateColumns)
    // Should have 3 columns (computed as pixel values, e.g., "297.828px 297.828px 297.844px")
    const columnCount = gridTemplateColumns.split(' ').filter((s) => s.endsWith('px')).length
    expect(columnCount).toBe(3)
  })

  test('预览模式下分栏渲染保真：4 栏 shows grid with 4 columns', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    await pickColumnBar(page, 4)

    await page.getByTestId('mode-preview-btn').click()
    await expect(page.locator('.preview-content').first()).toBeVisible()
    await settle(page)

    const previewBlock = page.locator('.preview-content .layout-col-4').first()
    await expect(previewBlock).toBeVisible()

    const display = await previewBlock.evaluate((el) => window.getComputedStyle(el).display)
    expect(display).toBe('grid')

    const gridTemplateColumns = await previewBlock.evaluate((el) => window.getComputedStyle(el).gridTemplateColumns)
    // Should have 4 columns
    const columnCount = gridTemplateColumns.split(' ').filter((s) => s.endsWith('px')).length
    expect(columnCount).toBe(4)
  })

  test('预览模式下分栏渲染保真：5 栏 shows grid with 5 columns', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    await pickColumnBar(page, 5)

    await page.getByTestId('mode-preview-btn').click()
    await expect(page.locator('.preview-content').first()).toBeVisible()
    await settle(page)

    const previewBlock = page.locator('.preview-content .layout-col-5').first()
    await expect(previewBlock).toBeVisible()

    const display = await previewBlock.evaluate((el) => window.getComputedStyle(el).display)
    expect(display).toBe('grid')

    const gridTemplateColumns = await previewBlock.evaluate((el) => window.getComputedStyle(el).gridTemplateColumns)
    // Should have 5 columns
    const columnCount = gridTemplateColumns.split(' ').filter((s) => s.endsWith('px')).length
    expect(columnCount).toBe(5)
  })
})
