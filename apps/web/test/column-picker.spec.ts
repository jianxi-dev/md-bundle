import { expect, test, type Page } from '@playwright/test'

test.use({ viewport: { width: 1200, height: 800 } })

// AC of #290: the 分栏 control must be a VISUAL bar picker — clicking the Nth
// bar group (N vertical bars) wraps the block in `::: {.col-N}`.
const DOC = `# Column Picker Test

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
    name: 'column-picker.md',
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

/** Open the 分栏 picker and click the bar group for `count` columns. */
async function pickColumnBar(page: Page, count: number): Promise<void> {
  const colBtn = page.locator('.mdb-floating-toolbar .mdb-toolbar-dropdown-btn[title="分栏"]')
  await expect(colBtn).toBeVisible()
  await colBtn.click()
  await settle(page)

  const menu = page.locator('.mdb-toolbar-columns-menu')
  await expect(menu).toBeVisible()
  const option = menu.locator(`.mdb-column-option[data-columns="${count}"]`)
  await expect(option).toBeVisible()
  await option.click()
  await settle(page)
}

test.describe('分栏可视化栏数选择器（#290）', () => {
  test('点击第 3 个横杠组后，块被包成 ::: {.col-3} … :::', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    await pickColumnBar(page, 3)

    const raw = await rawDoc(page)
    expect(raw).toContain('::: {.col-3}')
    expect(raw).toContain('UNIQUEMARKER')
    expect(raw).toContain(':::')
  })

  test('点击第 5 个横杠组后，块被包成 ::: {.col-5} … :::', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    await pickColumnBar(page, 5)

    const raw = await rawDoc(page)
    expect(raw).toContain('::: {.col-5}')
    expect(raw).toContain('UNIQUEMARKER')
    expect(raw).toContain(':::')
  })

  test('选择器是图形化的：1..5 共 5 组，第 N 组恰有 N 根横杠', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    const colBtn = page.locator('.mdb-floating-toolbar .mdb-toolbar-dropdown-btn[title="分栏"]')
    await colBtn.click()
    await settle(page)

    const menu = page.locator('.mdb-toolbar-columns-menu')
    await expect(menu).toBeVisible()

    const groups = await menu.locator('.mdb-column-option').evaluateAll((els) =>
      els.map((el) => ({
        columns: (el as HTMLElement).dataset.columns,
        bars: el.querySelectorAll('.mdb-column-bar').length,
      })),
    )
    expect(groups).toEqual([
      { columns: '1', bars: 1 },
      { columns: '2', bars: 2 },
      { columns: '3', bars: 3 },
      { columns: '4', bars: 4 },
      { columns: '5', bars: 5 },
    ])
  })

  test('清除 action removes the column wrapper', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    await pickColumnBar(page, 3)
    // 包裹后内容由分栏 widget 渲染（不再是 .cm-line）；点列单元格选中该块源码范围。
    await page.getByTestId('cm-columns').locator('.cm-column').first().click()
    await settle(page)

    const colBtn = page.locator('.mdb-floating-toolbar .mdb-toolbar-dropdown-btn[title="分栏"]')
    await colBtn.click()
    await settle(page)
    const clear = page.locator('.mdb-toolbar-columns-menu .mdb-columns-clear')
    await expect(clear).toBeVisible()
    await clear.click()
    await settle(page)

    const raw = await rawDoc(page)
    expect(raw).not.toContain('::: {.col-3}')
    expect(raw).not.toContain(':::')
    expect(raw).toContain('UNIQUEMARKER')
  })
})
