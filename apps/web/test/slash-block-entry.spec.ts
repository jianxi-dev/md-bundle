// #250：斜杠菜单按分组渲染 + 「标题」二级浮层（H1–H6）+ 右/下边界自适应。
import { expect, test, type Page } from '@playwright/test'

test.use({ viewport: { width: 1200, height: 700 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page, doc: string): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'slash-entry.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(doc),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

async function typeSlashAtDocEnd(page: Page): Promise<void> {
  await page.locator('.cm-content').click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+End' : 'Control+End')
  await settle(page)
  await page.keyboard.type('/')
  await expect(page.locator('.mdb-slash-menu')).toBeVisible()
}

async function rawDoc(page: Page): Promise<string> {
  await page.getByTestId('mode-source-btn').click()
  await expect(page.locator('.cm-content').first()).toBeVisible()
  const text = await page.locator('.cm-content').first().innerText()
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  return text
}

test('斜杠菜单按分组渲染（#250）', async ({ page }) => {
  await openEditor(page, '# Title\n\n')
  await typeSlashAtDocEnd(page)

  // #279：分组标题挂在图标网格内部，根命令仍是 8 个图标单元格。
  await expect(page.locator('.mdb-slash-grid-menu')).toBeVisible()
  await expect(page.locator('.mdb-slash-grid-menu .mdb-slash-item')).toHaveCount(10)
  const groups = await page.locator('.mdb-slash-group').allInnerTexts()
  expect(groups).toContain('基础')
  expect(groups).toContain('常用')
  expect(groups).toContain('小组件')
})

test('「标题」打开 H1–H6 flyout 并插入所选级别（#279）', async ({ page }) => {
  await openEditor(page, '# Title\n\n')
  await typeSlashAtDocEnd(page)

  await page.locator('.mdb-slash-item').filter({ hasText: '标题' }).first().click()
  const flyout = page.locator('.mdb-slash-flyout')
  await expect(flyout).toBeVisible()
  const flyoutItems = flyout.locator('.mdb-slash-flyout-item')
  await expect(flyoutItems).toHaveCount(6)
  // 根网格未被替换（二级项以 flyout 展开，而不是就地替换根列表）。
  await expect(page.locator('.mdb-slash-grid-menu .mdb-slash-item')).toHaveCount(10)

  await flyoutItems.filter({ hasText: '2 级标题' }).first().click()
  await settle(page)

  const raw = await rawDoc(page)
  expect(raw).toContain('## ')
})

test('菜单在窗口右下缘不溢出（#250）', async ({ page }) => {
  const tall = `${'filler line.\n\n'.repeat(30)}`
  await openEditor(page, tall)
  await typeSlashAtDocEnd(page)

  const menu = page.locator('.mdb-slash-menu')
  const box = await menu.boundingBox()
  if (!box) throw new Error('menu has no box')
  const viewport = page.viewportSize()
  if (!viewport) throw new Error('no viewport')
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
})

test('「表格」网格选择器插入 GFM 表格（#251）', async ({ page }) => {
  await openEditor(page, '# Title\n\n')
  await typeSlashAtDocEnd(page)

  await page.locator('.mdb-slash-item').filter({ hasText: '表格' }).first().click()
  await expect(page.locator('.mdb-slash-grid')).toBeVisible()
  await expect(page.locator('.mdb-slash-grid-cell')).toHaveCount(100)

  await page.locator('.mdb-slash-grid-cell[data-r="3"][data-c="7"]').click()
  await settle(page)

  const raw = await rawDoc(page)
  expect(raw).toContain('| A | B | C | D | E | F | G |')
  expect(raw.split('\n').filter((line) => line.includes('|')).length).toBe(5)
})
