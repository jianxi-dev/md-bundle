import { expect, test, type Page } from '@playwright/test'

test.use({ viewport: { width: 1200, height: 800 } })

const DOC = `# Columns 5 Test

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
    name: 'columns-5.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

async function selectWord(page: Page, word: string): Promise<void> {
  const line = page.locator('.cm-content .cm-line').filter({ hasText: word }).first()
  await expect(line).toBeVisible()
  await line.dblclick()
  await settle(page)
}

async function rawDoc(page: Page): Promise<string> {
  await page.getByTestId('mode-source-btn').click()
  await expect(page.locator('.cm-content').first()).toBeVisible()
  const text = await page.locator('.cm-content').first().innerText()
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
  return text
}

test.describe('分栏 1–5 栏：源码含 {.col-N} + 预览渲染 grid-template-columns', () => {
  test('5 栏：源码含 {.col-5} 且预览 grid-template-columns 有 5 轨', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    const colDropdown = page.locator('.mdb-floating-toolbar .mdb-toolbar-dropdown-btn[title="分栏"]')
    await expect(colDropdown).toBeVisible()
    await colDropdown.click()
    await settle(page)

    const col5Option = page.locator('.mdb-toolbar-dropdown-menu .mdb-toolbar-dropdown-option', { hasText: '5 栏' }).first()
    await expect(col5Option).toBeVisible()
    await col5Option.click()
    await settle(page)

    // Verify source contains {.col-5}
    let raw = await rawDoc(page)
    expect(raw).toContain('::: {.col-5}')
    expect(raw).toContain('UNIQUEMARKER')
    expect(raw).toContain(':::')

    // Switch to preview and verify grid-template-columns has 5 tracks
    await page.getByTestId('mode-preview-btn').click()
    await expect(page.locator('.preview-content').first()).toBeVisible()
    await settle(page)

    const previewBlock = page.locator('.preview-content .layout-col-5').first()
    await expect(previewBlock).toBeVisible()

    const display = await previewBlock.evaluate((el) => window.getComputedStyle(el).display)
    expect(display).toBe('grid')

    const gridTemplateColumns = await previewBlock.evaluate((el) => window.getComputedStyle(el).gridTemplateColumns)
    // Should have 5 columns (computed as pixel values, e.g., "200px 200px 200px 200px 200px")
    const columnCount = gridTemplateColumns.split(' ').filter((s) => s.endsWith('px')).length
    expect(columnCount).toBe(5)
  })

  test('1 栏：源码含 {.col-1} 且预览 grid-template-columns 有 1 轨', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    const colDropdown = page.locator('.mdb-floating-toolbar .mdb-toolbar-dropdown-btn[title="分栏"]')
    await expect(colDropdown).toBeVisible()
    await colDropdown.click()
    await settle(page)

    const col1Option = page.locator('.mdb-toolbar-dropdown-menu .mdb-toolbar-dropdown-option', { hasText: '1 栏' }).first()
    await expect(col1Option).toBeVisible()
    await col1Option.click()
    await settle(page)

    // Verify source contains {.col-1}
    let raw = await rawDoc(page)
    expect(raw).toContain('::: {.col-1}')
    expect(raw).toContain('UNIQUEMARKER')
    expect(raw).toContain(':::')

    // Switch to preview and verify grid-template-columns has 1 track
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
})