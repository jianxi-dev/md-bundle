import { expect, test, type Page, type Locator } from '@playwright/test'

test.use({ viewport: { width: 1200, height: 800 } })

// UNIQUEMARKER sits alone on its line so dblclick reliably selects the whole
// word (the line center is the word center).
const DOC = `# Color Popup Test

UNIQUEMARKER

Another normal paragraph here.
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
    name: 'selection-toolbar-color.md',
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

/** Open the 颜色 dual-palette popup and return its (visible) menu. */
async function openColorPopup(page: Page): Promise<Locator> {
  const colorBtn = page.locator('.mdb-floating-toolbar .mdb-toolbar-dropdown-btn[title="颜色"]')
  await expect(colorBtn).toBeVisible()
  await colorBtn.click()
  await settle(page)
  const menu = page.locator('.mdb-toolbar-dropdown-menu.mdb-toolbar-color-menu')
  await expect(menu).toBeVisible()
  return menu
}

test.describe('选区浮条：颜色弹出面板（字体色 + 背景色 + 恢复默认）#278 task 3.2', () => {
  test('AC-A: 选中文本后浮条不再有 字体 控件，总数为 11', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    const toolbar = page.locator('.mdb-floating-toolbar')
    await expect(toolbar).toBeVisible()

    // The 字体 control is gone entirely (no button or dropdown with that title).
    await expect(toolbar.locator('[title="字体"]')).toHaveCount(0)

    const buttons = toolbar.locator('.mdb-toolbar-btn, .mdb-toolbar-dropdown-btn')
    await expect(buttons).toHaveCount(11)
    const titles = await buttons.evaluateAll((els) =>
      els.map((e) => (e as HTMLButtonElement).title),
    )
    expect(titles).toEqual([
      '颜色',
      '对齐',
      '加粗',
      '删除线',
      '斜体',
      '下划线',
      '插入链接',
      '行内代码',
      '分栏',
      '复制',
      '转换',
    ])
  })

  test('AC-B: 选择背景色 → 源码加 mdb-bg-* 类且预览渲染；恢复默认移除', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    const menu = await openColorPopup(page)
    await expect(menu.locator('.mdb-color-row-label', { hasText: '字体色' })).toBeVisible()
    await expect(menu.locator('.mdb-color-row-label', { hasText: '背景色' })).toBeVisible()

    // Pick 背景色 → 蓝色.
    const bgBlue = menu.locator('.mdb-color-bg-swatch[title="蓝色"]')
    await expect(bgBlue).toBeVisible()
    await bgBlue.click()
    await settle(page)

    // Source got the class wrapping the selection.
    let raw = await rawDoc(page)
    expect(raw).toContain('<span class="mdb-bg-blue">UNIQUEMARKER</span>')

    // Preview renders it with a non-transparent background.
    await page.getByTestId('mode-preview-btn').click()
    await expect(page.locator('.preview-content').first()).toBeVisible()
    await settle(page)
    const previewWord = page.locator('.preview-content .mdb-bg-blue').first()
    await expect(previewWord).toBeVisible()
    const bg = await previewWord.evaluate((el) => window.getComputedStyle(el).backgroundColor)
    expect(bg).not.toBe('rgba(0, 0, 0, 0)')
    expect(bg).not.toBe('transparent')

    // Back to edit, reselect, then 恢复默认 removes the bg wrapper.
    await page.getByTestId('mode-edit-btn').click()
    await expect(page.locator('.cm-editor').first()).toBeVisible()
    await settle(page)
    await selectWord(page, 'UNIQUEMARKER')
    const resetMenu = await openColorPopup(page)
    const reset = resetMenu.locator('.mdb-color-reset')
    await expect(reset).toBeVisible()
    await reset.click()
    await settle(page)

    raw = await rawDoc(page)
    expect(raw).not.toContain('mdb-bg-')
    expect(raw).toContain('UNIQUEMARKER')

    // Preview no longer carries the background class.
    await page.getByTestId('mode-preview-btn').click()
    await expect(page.locator('.preview-content').first()).toBeVisible()
    await settle(page)
    await expect(page.locator('.preview-content .mdb-bg-blue')).toHaveCount(0)
  })

  test('字体色 swatch 仍写 mdb-color-*，与背景色可叠加且恢复默认同时移除', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    // Text color via the 字体色 row.
    let menu = await openColorPopup(page)
    const textRed = menu.locator('.mdb-color-font-swatch[title="红色"]')
    await expect(textRed).toBeVisible()
    await textRed.click()
    await settle(page)

    // Background via the 背景色 row (selection persists across swatch clicks).
    menu = await openColorPopup(page)
    const bgBlue = menu.locator('.mdb-color-bg-swatch[title="蓝色"]')
    await expect(bgBlue).toBeVisible()
    await bgBlue.click()
    await settle(page)

    let raw = await rawDoc(page)
    expect(raw).toContain('mdb-color-red')
    expect(raw).toContain('mdb-bg-blue')

    // 恢复默认 removes both wrappers in one action. In edit mode the nested
    // text-color wrapper keeps its raw tags visible, so select the marked word
    // (the bg mark element) instead of dblclicking the line center.
    const marked = page.locator('.cm-content .cm-bg-blue').first()
    await expect(marked).toBeVisible()
    await marked.dblclick()
    await settle(page)
    menu = await openColorPopup(page)
    await menu.locator('.mdb-color-reset').click()
    await settle(page)

    raw = await rawDoc(page)
    expect(raw).not.toContain('mdb-color-')
    expect(raw).not.toContain('mdb-bg-')
    expect(raw).toContain('UNIQUEMARKER')
  })

  test('背景色再次选择同一色可切换关闭（toggle）', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    let menu = await openColorPopup(page)
    await menu.locator('.mdb-color-bg-swatch[title="绿色"]').click()
    await settle(page)

    let raw = await rawDoc(page)
    expect(raw).toContain('<span class="mdb-bg-green">UNIQUEMARKER</span>')

    await selectWord(page, 'UNIQUEMARKER')
    menu = await openColorPopup(page)
    await menu.locator('.mdb-color-bg-swatch[title="绿色"]').click()
    await settle(page)

    raw = await rawDoc(page)
    expect(raw).not.toContain('mdb-bg-')
    expect(raw).toContain('UNIQUEMARKER')
  })
})
