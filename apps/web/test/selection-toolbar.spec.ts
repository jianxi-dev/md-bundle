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

test.describe('选区浮条：10 控件 + 字体/颜色/对齐下拉 + 切换（#261 + #262）', () => {
  test('选中文本后浮条出现 11 个控件', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    const toolbar = page.locator('.mdb-floating-toolbar')
    await expect(toolbar).toBeVisible()
    const buttons = toolbar.locator('.mdb-toolbar-btn, .mdb-toolbar-dropdown-btn')
    await expect(buttons).toHaveCount(11)
    const titles = await buttons.evaluateAll((els) =>
      els.map((e) => (e as HTMLButtonElement).title),
    )
    expect(titles).toEqual(['字体', '颜色', '对齐', '加粗', '删除线', '斜体', '下划线', '插入链接', '行内代码', '分栏', '复制'])
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

  test('字体 dropdown applies 衬线 and toggles off', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    const fontDropdown = page.locator('.mdb-floating-toolbar .mdb-toolbar-dropdown-btn[title="字体"]')
    await expect(fontDropdown).toBeVisible()
    await fontDropdown.click()
    await settle(page)

    const serifOption = page.locator('.mdb-toolbar-dropdown-menu .mdb-toolbar-dropdown-option', { hasText: '衬线' }).first()
    await expect(serifOption).toBeVisible()
    await serifOption.click()
    await settle(page)

    let raw = await rawDoc(page)
    expect(raw).toContain('<span class="mdb-font-serif">UNIQUEMARKER</span>')

    await selectWord(page, 'UNIQUEMARKER')
    await fontDropdown.click()
    await settle(page)
    const clearOption = page.locator('.mdb-toolbar-dropdown-menu .mdb-toolbar-dropdown-option', { hasText: '无' }).first()
    await expect(clearOption).toBeVisible()
    await clearOption.click()
    await settle(page)

    raw = await rawDoc(page)
    expect(raw).not.toContain('mdb-font-')
    expect(raw).toContain('UNIQUEMARKER')
  })

  test('颜色 dropdown applies 红色 and toggles off', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    const colorDropdown = page.locator('.mdb-floating-toolbar .mdb-toolbar-dropdown-btn[title="颜色"]')
    await expect(colorDropdown).toBeVisible()
    await colorDropdown.click()
    await settle(page)

    const redOption = page.locator('.mdb-toolbar-dropdown-menu .mdb-toolbar-dropdown-option', { hasText: '红色' }).first()
    await expect(redOption).toBeVisible()
    await redOption.click()
    await settle(page)

    let raw = await rawDoc(page)
    expect(raw).toContain('<span class="mdb-color-red">UNIQUEMARKER</span>')

    await selectWord(page, 'UNIQUEMARKER')
    await colorDropdown.click()
    await settle(page)
    const clearOption = page.locator('.mdb-toolbar-dropdown-menu .mdb-toolbar-dropdown-option', { hasText: '清除' }).first()
    await expect(clearOption).toBeVisible()
    await clearOption.click()
    await settle(page)

    raw = await rawDoc(page)
    expect(raw).not.toContain('mdb-color-')
    expect(raw).toContain('UNIQUEMARKER')
  })

  test('预览模式下字体/颜色渲染保真', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    const fontDropdown = page.locator('.mdb-floating-toolbar .mdb-toolbar-dropdown-btn[title="字体"]')
    await fontDropdown.click()
    await settle(page)
    const serifOption = page.locator('.mdb-toolbar-dropdown-menu .mdb-toolbar-dropdown-option', { hasText: '衬线' }).first()
    await serifOption.click()
    await settle(page)

    const colorDropdown = page.locator('.mdb-floating-toolbar .mdb-toolbar-dropdown-btn[title="颜色"]')
    await colorDropdown.click()
    await settle(page)
    const redOption = page.locator('.mdb-toolbar-dropdown-menu .mdb-toolbar-dropdown-option', { hasText: '红色' }).first()
    await redOption.click()
    await settle(page)

    await page.getByTestId('mode-preview-btn').click()
    await expect(page.locator('.preview-content').first()).toBeVisible()
    await settle(page)

    const previewWord = page.locator('.preview-content .mdb-color-red').first()
    await expect(previewWord).toBeVisible()

    const fontFamily = await previewWord.evaluate((el) => window.getComputedStyle(el).fontFamily)
    const color = await previewWord.evaluate((el) => window.getComputedStyle(el).color)

    expect(fontFamily).toMatch(/Georgia|serif/i)
    expect(color).toMatch(/rgb\(240, 97, 109\)|rgb\(207, 34, 46\)|#f0616d|#cf222e/i)
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
    expect(titles).toEqual(['字体', '颜色', '对齐', '加粗', '删除线', '斜体', '下划线', '插入链接', '行内代码', '分栏', '复制'])
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

test.describe('选区浮条：分栏下拉（2 栏 / 3 栏 / 清除）#263', () => {
  test('浮条包含 11 个控件（含分栏下拉）', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    const toolbar = page.locator('.mdb-floating-toolbar')
    await expect(toolbar).toBeVisible()
    const buttons = toolbar.locator('.mdb-toolbar-btn, .mdb-toolbar-dropdown-btn')
    await expect(buttons).toHaveCount(11)
    const titles = await buttons.evaluateAll((els) =>
      els.map((e) => (e as HTMLButtonElement).title),
    )
    expect(titles).toEqual(['字体', '颜色', '对齐', '加粗', '删除线', '斜体', '下划线', '插入链接', '行内代码', '分栏', '复制'])
  })

  test('分栏下拉：2 栏 wraps block in ::: {.col-2} … :::', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    const colDropdown = page.locator('.mdb-floating-toolbar .mdb-toolbar-dropdown-btn[title="分栏"]')
    await expect(colDropdown).toBeVisible()
    await colDropdown.click()
    await settle(page)

    const col2Option = page.locator('.mdb-toolbar-dropdown-menu .mdb-toolbar-dropdown-option', { hasText: '2 栏' }).first()
    await expect(col2Option).toBeVisible()
    await col2Option.click()
    await settle(page)

    let raw = await rawDoc(page)
    expect(raw).toContain('::: {.col-2}')
    expect(raw).toContain('UNIQUEMARKER')
    expect(raw).toContain(':::')
  })

  test('分栏下拉：3 栏 wraps block in ::: {.col-3} … :::', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    const colDropdown = page.locator('.mdb-floating-toolbar .mdb-toolbar-dropdown-btn[title="分栏"]')
    await colDropdown.click()
    await settle(page)

    const col3Option = page.locator('.mdb-toolbar-dropdown-menu .mdb-toolbar-dropdown-option', { hasText: '3 栏' }).first()
    await expect(col3Option).toBeVisible()
    await col3Option.click()
    await settle(page)

    let raw = await rawDoc(page)
    expect(raw).toContain('::: {.col-3}')
    expect(raw).toContain('UNIQUEMARKER')
    expect(raw).toContain(':::')
  })

  test('分栏下拉：再次点击同一分栏 toggles off (removes wrapper)', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    const colDropdown = page.locator('.mdb-floating-toolbar .mdb-toolbar-dropdown-btn[title="分栏"]')
    await colDropdown.click()
    await settle(page)

    const col2Option = page.locator('.mdb-toolbar-dropdown-menu .mdb-toolbar-dropdown-option', { hasText: '2 栏' }).first()
    await col2Option.click()
    await settle(page)

    await selectWord(page, 'UNIQUEMARKER')
    await colDropdown.click()
    await settle(page)
    await col2Option.click()
    await settle(page)

    let raw = await rawDoc(page)
    expect(raw).not.toContain('::: {.col-2}')
    expect(raw).not.toContain(':::')
    expect(raw).toContain('UNIQUEMARKER')
  })

  test('分栏下拉：切换分栏 replaces the class (2 栏 → 3 栏)', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    const colDropdown = page.locator('.mdb-floating-toolbar .mdb-toolbar-dropdown-btn[title="分栏"]')
    await colDropdown.click()
    await settle(page)

    const col2Option = page.locator('.mdb-toolbar-dropdown-menu .mdb-toolbar-dropdown-option', { hasText: '2 栏' }).first()
    await col2Option.click()
    await settle(page)

    await selectWord(page, 'UNIQUEMARKER')
    await colDropdown.click()
    await settle(page)
    const col3Option = page.locator('.mdb-toolbar-dropdown-menu .mdb-toolbar-dropdown-option', { hasText: '3 栏' }).first()
    await col3Option.click()
    await settle(page)

    let raw = await rawDoc(page)
    expect(raw).not.toContain('::: {.col-2}')
    expect(raw).toContain('::: {.col-3}')
    expect(raw).toContain('UNIQUEMARKER')
  })

  test('分栏下拉：清除 removes column wrapper', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    const colDropdown = page.locator('.mdb-floating-toolbar .mdb-toolbar-dropdown-btn[title="分栏"]')
    await colDropdown.click()
    await settle(page)

    const col2Option = page.locator('.mdb-toolbar-dropdown-menu .mdb-toolbar-dropdown-option', { hasText: '2 栏' }).first()
    await col2Option.click()
    await settle(page)

    await selectWord(page, 'UNIQUEMARKER')
    await colDropdown.click()
    await settle(page)
    // Wait for the 分栏 dropdown menu to be visible
    const colMenu = page.locator('.mdb-toolbar-dropdown-menu').filter({ hasText: '2 栏' })
    await expect(colMenu).toBeVisible()
    const clearOption = colMenu.locator('.mdb-toolbar-dropdown-option', { hasText: '清除' }).first()
    await expect(clearOption).toBeVisible()
    await clearOption.click()
    await settle(page)

    let raw = await rawDoc(page)
    expect(raw).not.toContain('::: {.col-2}')
    expect(raw).not.toContain(':::')
    expect(raw).toContain('UNIQUEMARKER')
  })

  test('预览模式下分栏渲染保真：2 栏 shows grid with 2 columns', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    const colDropdown = page.locator('.mdb-floating-toolbar .mdb-toolbar-dropdown-btn[title="分栏"]')
    await colDropdown.click()
    await settle(page)

    const col2Option = page.locator('.mdb-toolbar-dropdown-menu .mdb-toolbar-dropdown-option', { hasText: '2 栏' }).first()
    await col2Option.click()
    await settle(page)

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

    const colDropdown = page.locator('.mdb-floating-toolbar .mdb-toolbar-dropdown-btn[title="分栏"]')
    await colDropdown.click()
    await settle(page)

    const col3Option = page.locator('.mdb-toolbar-dropdown-menu .mdb-toolbar-dropdown-option', { hasText: '3 栏' }).first()
    await col3Option.click()
    await settle(page)

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
})
