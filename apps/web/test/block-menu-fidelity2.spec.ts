// 块菜单保真度二期（#357 task 2.2）e2e：
// 1. 菜单容器 min-width 236px / padding 5px / font-size 12px / border-radius 6px
// 2. 菜单项 height 32px / padding 0 8px / gap 9px / border-radius 4px / hover rgba(235,235,235,.08)
// 3. 「转为」网格恰好 10 项，每项带 svg[data-icon]
// 4. 表格块菜单额外含「标题行」/「标题列」/「均分列宽」
// 5. 高亮块菜单不含「颜色」/「翻译」，含「同步块」
// 6. 菜单顶端与块顶对齐（menu.top ≈ block.y ±2px）
import { expect, test, type Locator, type Page } from '@playwright/test'

const PARA_DOC = `Paragraph one.

Paragraph two.`

const TABLE_DOC = `\n| H1 | H2 |
| --- | --- |
| a | b |`

const CALLOUT_DOC = `Plain paragraph target.

> [!NOTE]
> Callout body text

Paragraph.`

test.use({ viewport: { width: 1440, height: 900 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
}

async function openEditorWith(page: Page, fileName: string, source: string): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: fileName,
    mimeType: 'text/markdown',
    buffer: Buffer.from(source),
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

async function hoverLine(page: Page, text: string): Promise<void> {
  const line = page.locator('.cm-content .cm-line').filter({ hasText: text }).first()
  await expect(line).toBeVisible()
  const box = await boxOf(line)
  await page.mouse.move(box.x + 20, box.y + box.height / 2)
  await settle(page)
}

async function hoverHandle(page: Page): Promise<void> {
  const handle = page.getByTestId('block-handle')
  await expect(handle).toBeVisible()
  const box = await boxOf(handle)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await settle(page)
}

async function openMenuOn(page: Page, text: string): Promise<void> {
  await hoverLine(page, text)
  await hoverHandle(page)
  await expect(page.getByTestId('block-handle-menu')).toBeVisible()
}

// --- 1. 菜单容器 Token ---
test('菜单容器 min-width 236px / padding 5px / font-size 12px / border-radius 6px', async ({ page }) => {
  await openEditorWith(page, 'menu-tokens.md', PARA_DOC)
  await openMenuOn(page, 'Paragraph one')

  const menu = page.getByTestId('block-handle-menu')
  await expect(menu).toBeVisible()

  // min-width 236px
  const menuBox = await boxOf(menu)
  expect(menuBox.width).toBeGreaterThanOrEqual(236)

  // padding 5px
  await expect(menu).toHaveCSS('padding', '5px')

  // font-size 12px
  await expect(menu).toHaveCSS('font-size', '12px')

  // border-radius 6px
  await expect(menu).toHaveCSS('border-radius', '6px')
})

// --- 2. 菜单项 Token ---
test('菜单项 height 32px / padding 0 8px / gap 9px / border-radius 4px / hover rgba(235,235,235,.08)', async ({ page }) => {
  await openEditorWith(page, 'menu-item-tokens.md', PARA_DOC)
  await openMenuOn(page, 'Paragraph one')

  const menu = page.getByTestId('block-handle-menu')
  const items = menu.locator('.mdb-block-handle-item')
  await expect(items.first()).toBeVisible()

  // height 32px
  await expect(items.first()).toHaveCSS('height', '32px')

  // padding 0 8px
  await expect(items.first()).toHaveCSS('padding-left', '8px')
  await expect(items.first()).toHaveCSS('padding-right', '8px')

  // gap 9px
  await expect(items.first()).toHaveCSS('gap', '9px')

  // border-radius 4px
  await expect(items.first()).toHaveCSS('border-radius', '4px')

  // hover background rgba(235,235,235,.08)
  const itemBox = await boxOf(items.first())
  await page.mouse.move(itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height / 2)
  await settle(page)
  await expect(items.first()).toHaveCSS('background-color', 'rgba(235, 235, 235, 0.08)')
})

// --- 3. 「转为」网格 10 项 ---
test('「转为」网格恰好 10 项，每项带 svg[data-icon]', async ({ page }) => {
  await openEditorWith(page, 'menu-convert-grid.md', PARA_DOC)
  await openMenuOn(page, 'Paragraph one')

  const grid = page.getByTestId('block-handle-convert-grid')
  await expect(grid).toBeVisible()

  const gridItems = grid.locator('.mdb-block-handle-grid-item')
  await expect(gridItems).toHaveCount(10)

  const expectedIcons = [
    'TextOutlined',
    'H1Outlined',
    'H2Outlined',
    'H3Outlined',
    'OrderListOutlined',
    'DisorderListOutlined',
    'TodoOutlined',
    'CodeblockOutlined',
    'ReferenceOutlined',
    'CalloutOutlined',
  ]

  for (let i = 0; i < expectedIcons.length; i++) {
    const item = gridItems.nth(i)
    const svg = item.locator('svg')
    await expect(svg).toHaveCount(1)
    await expect(svg).toHaveAttribute('data-icon', expectedIcons[i])
  }
})

// --- 4. 表格块菜单含三项 ---
test('表格块菜单不再提供 GFM 无法表达的三项（#437）', async ({ page }) => {
  await openEditorWith(page, 'menu-table.md', TABLE_DOC)
  await openMenuOn(page, 'H1')

  const menu = page.getByTestId('block-handle-menu')
  // GFM 管道表没有表头列/列宽语法，表头行恒存在。这三项旧实现分别会删掉分隔行、
  // 只挪行首空格、直接空转，按 #437 移除；菜单不得再承诺不存在的语义。
  await expect(menu).not.toContainText('标题行')
  await expect(menu).not.toContainText('标题列')
  await expect(menu).not.toContainText('均分列宽')
  await expect(menu).toContainText('在下方添加')
  await expect(menu).toContainText('删除')
})

// --- 5. 高亮块菜单无「颜色」/「翻译」，有「同步块」 ---
test('高亮块菜单不含「颜色」/「翻译」，含「同步块」', async ({ page }) => {
  await openEditorWith(page, 'menu-callout.md', CALLOUT_DOC)
  await openMenuOn(page, 'Callout body text')

  const menu = page.getByTestId('block-handle-menu')

  const colorItem = menu.locator('.mdb-block-handle-item', { hasText: '颜色' })
  await expect(colorItem).toHaveCount(1)
  await expect(colorItem).toBeHidden()

  const translateItem = menu.locator('.mdb-block-handle-item', { hasText: '翻译' })
  await expect(translateItem).toHaveCount(1)
  await expect(translateItem).toBeHidden()

  await expect(menu).toContainText('同步块')
  const syncedItem = menu.locator('.mdb-block-handle-item', { hasText: '同步块' })
  await expect(syncedItem.locator('svg')).toHaveAttribute('data-icon', 'LinkRecordOutlined')
})

// --- 6. 菜单顶端与块顶对齐 ---
test('菜单纵向以指针行为中心（#466；放不下时退回顶端对齐）', async ({ page }) => {
  await openEditorWith(page, 'menu-position.md', PARA_DOC)
  await hoverLine(page, 'Paragraph one')
  await hoverHandle(page)

  const menu = page.getByTestId('block-handle-menu')
  await expect(menu).toBeVisible()

  const handle = page.getByTestId('block-handle')
  const handleBox = await boxOf(handle)
  const menuBox = await boxOf(menu)

  // #466: 放得下时菜单以指针行为中心（中点 ≈ 手柄中点）；
  // 放不下（菜单比可用高度还高）时退回原有的顶端对齐。
  const pointerY = handleBox.y + handleBox.height / 2
  const centred = Math.abs(menuBox.y + menuBox.height / 2 - pointerY) <= 12
  const topAligned = Math.abs(menuBox.y - handleBox.y) <= 2
  expect(centred || topAligned).toBe(true)
})