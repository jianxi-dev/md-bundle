// #390：(a) 补齐产品快捷键的「可发现性」；(b) 二级菜单「滑入即显示」。
// (a) 命令面板行右对齐显示格式化 chord；斜杠插入菜单行显示产品 chord 而非 markdown 触发符。
// (b) 选区浮条与单元格工具栏的二级菜单 hover 即显示（与块手柄 flyout 同一交互哲学）。
// 运行：pnpm --filter @md-bundle/web exec playwright test test/issue-390-shortcuts-slidein.spec.ts
import { expect, test, type Locator, type Page } from '@playwright/test'
import { PALETTE_KEY } from './keys'

test.use({ viewport: { width: 1440, height: 900 } })

// formatKeyChord: mac 无分隔符、非 mac 用 '+'（与浏览器平台一致）。
const IS_MAC = process.platform === 'darwin'
const chord = {
  bold: IS_MAC ? '⌘B' : 'Ctrl+B',
  underline: IS_MAC ? '⌘U' : 'Ctrl+U',
  link: IS_MAC ? '⌘⇧L' : 'Ctrl+Shift+L',
  heading1: IS_MAC ? '⌘⌥1' : 'Ctrl+Alt+1',
  quote: IS_MAC ? '⌘⇧.' : 'Ctrl+Shift+.',
  codeBlock: IS_MAC ? '⌘⇧C' : 'Ctrl+Shift+C',
  task: IS_MAC ? '⌘⇧9' : 'Ctrl+Shift+9',
}

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

async function openEditor(page: Page, doc: string = DOC): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'issue-390.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(doc),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

async function computedDisplay(locator: Locator): Promise<string> {
  return locator.evaluate((el) => window.getComputedStyle(el as HTMLElement).display)
}

/** Move the real pointer to the centre of a locator and let hover handlers run. */
async function hoverCentre(page: Page, locator: Locator): Promise<void> {
  const box = await locator.boundingBox()
  if (!box) throw new Error('element has no bounding box')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await settle(page)
}

test.describe('#390 (a) 快捷键可发现', () => {
  test('命令面板行右对齐显示产品快捷键（加粗/下划线/链接/一级标题）', async ({ page }) => {
    await openEditor(page)
    await page.locator('.cm-content').click()
    await page.keyboard.press(PALETTE_KEY)
    const palette = page.getByTestId('command-palette')
    await expect(palette).toBeVisible()

    // `:has(kbd)` narrows 一级标题 to the bound heading-1 row (turn-into-h1 has none).
    const rowKbd = (label: string) =>
      palette.locator('.mdb-palette-item:has(kbd)', { hasText: label })

    await expect(rowKbd('加粗').locator('kbd')).toHaveText(chord.bold)
    await expect(rowKbd('下划线').locator('kbd')).toHaveText(chord.underline)
    await expect(rowKbd('插入链接').locator('kbd')).toHaveText(chord.link)
    await expect(rowKbd('一级标题').locator('kbd')).toHaveText(chord.heading1)
  })

  test('斜杠插入菜单行显示产品快捷键而非 markdown 触发符', async ({ page }) => {
    await openEditor(page, '')
    await page.locator('.cm-content').click()
    await page.keyboard.type('/')
    await expect(page.locator('.mdb-slash-menu')).toBeVisible()

    // data-cmd pins the row: e.g. 任务 would also substring-match 任务清单.
    const rootRow = (id: string) => page.locator(`.mdb-slash-item[data-cmd="${id}"]`)

    await expect(rootRow('quote').locator('.mdb-slash-item-kbd')).toHaveText(chord.quote)
    await expect(rootRow('code-block').locator('.mdb-slash-item-kbd')).toHaveText(chord.codeBlock)
    await expect(rootRow('task').locator('.mdb-slash-item-kbd')).toHaveText(chord.task)

    // 一级标题 shows the actually-bound chord (⌘⌥1), not the spec scenario's ⌘⇧7 typo.
    await hoverCentre(page, rootRow('heading'))
    const headingRow = page.locator('.mdb-slash-flyout-item[data-cmd="heading-1"]')
    await expect(headingRow).toBeVisible()
    await expect(headingRow.locator('.mdb-slash-flyout-kbd')).toHaveText(chord.heading1)
  })
})

test.describe('#390 (b) 二级菜单滑入即显示', () => {
  test('选区浮条：hover「转换」即显示二级菜单（无需点击）', async ({ page }) => {
    await openEditor(page)
    await page.locator('.cm-content .cm-line').filter({ hasText: 'UNIQUEMARKER' }).first().dblclick()
    await settle(page)

    const toolbar = page.locator('.mdb-floating-toolbar')
    await expect(toolbar).toBeVisible()

    const dropdownBtn = toolbar.locator('.mdb-toolbar-dropdown-btn[title="转换"]')
    const menu = toolbar.locator(
      '.mdb-toolbar-dropdown:has(.mdb-toolbar-dropdown-btn[title="转换"]) .mdb-toolbar-dropdown-menu',
    )
    await expect(menu).toBeHidden()

    await hoverCentre(page, dropdownBtn)

    await expect(menu).toBeVisible()
    expect(await computedDisplay(menu)).toBe('flex')
  })

  test('单元格工具栏：hover「单元格背景色」即显示二级菜单（无需点击）', async ({ page }) => {
    await openEditor(page)
    await page.getByTestId('cm-table').locator('td[data-row="0"][data-col="0"]').click()
    await settle(page)

    const toolbar = page.getByTestId('cell-toolbar')
    await expect(toolbar).toBeVisible()
    const menu = toolbar.locator('.mdb-cell-toolbar-menu')
    await expect(menu).toBeHidden()

    await hoverCentre(page, page.getByTestId('cell-bg'))

    await expect(menu).toBeVisible()
    expect(await computedDisplay(menu)).toBe('flex')
  })
})
