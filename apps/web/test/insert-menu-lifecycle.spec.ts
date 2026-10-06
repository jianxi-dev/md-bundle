// #331（change editor-fidelity/3.2）：插入菜单二级面板生命周期。
// 根列表在flyout / 表格网格展开期间保持挂载；三条取消路径（Escape /外部
// mousedown / caret 离开）必须同时清掉根、二级面板与 `/query` 残留。
// 运行：pnpm --filter @md-bundle/web exec playwright test test/insert-menu-lifecycle.spec.ts
import { expect, test, type Page } from '@playwright/test'

const DOC = '# Title\n\n'

test.use({ viewport: { width: 1440, height: 900 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'insert-menu-lifecycle.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

async function rawDoc(page: Page): Promise<string> {
  await page.getByTestId('mode-source-btn').click()
  await expect(page.locator('.cm-content').first()).toBeVisible()
  const text = await page.locator('.cm-content').first().innerText()
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  return text
}

async function focusEditorEnd(page: Page): Promise<void> {
  await page.locator('.cm-content').click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+End' : 'Control+End')
  await settle(page)
}

/** Open the root menu at the doc end with `query` typed after the trigger. */
async function typeQuery(page: Page, query: string): Promise<void> {
  await focusEditorEnd(page)
  await page.keyboard.type('/')
  await expect(page.locator('.mdb-slash-menu')).toBeVisible()
  if (query) {
    await page.keyboard.type(query)
    await settle(page)
  }
}

function rootRows(page: Page) {
  return page.locator('.mdb-slash-grid-menu .mdb-slash-item')
}

/** Nothing from the menu survives: no root panel, no flyout layer, no query text. */
async function expectFullyDismissed(page: Page): Promise<void> {
  await expect(page.locator('.mdb-slash-menu')).toHaveCount(0)
  await expect(page.locator('.mdb-slash-flyout')).toHaveCount(0)
  const raw = await rawDoc(page)
  expect(raw).not.toContain('/')
  expect(raw).not.toContain('、')
  expect(raw).toContain('# Title')
}

/** 列统计：按 `|` 切分并去掉首尾空段；不过滤空单元格（#386 空模板）。 */
function tableCells(line: string): string[] {
  return line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim())
}

test('flyout 展开时根列表保持挂载', async ({ page }) => {
  await openEditor(page)
  await typeQuery(page, 'bt')

  const before = await rootRows(page).count()
  expect(before).toBe(1)

  await rootRows(page).first().click()
  await expect(page.locator('.mdb-slash-flyout')).toBeVisible()
  // #331：二级面板是叠加层，不是替换——根列表仍在文档里
  await expect(page.locator('.mdb-slash-grid-menu')).toHaveCount(1)
  await expect(rootRows(page)).toHaveCount(before)
})

test('表格网格展开时根列表保持挂载且单元格完整', async ({ page }) => {
  await openEditor(page)
  await typeQuery(page, '')

  await rootRows(page).filter({ hasText: '表格' }).click()
  const cells = page.locator('.mdb-slash-grid-cell')
  await expect(cells).toHaveCount(100)
  // #331：网格在共享 flyout 层里，根列表不卸载
  await expect(page.locator('.mdb-slash-grid-menu')).toHaveCount(1)
  await expect(rootRows(page)).toHaveCount(17)
})

test('取消：flyout 展开时 Escape 清掉根+二级+query', async ({ page }) => {
  await openEditor(page)
  await typeQuery(page, 'bt')

  await rootRows(page).first().click()
  await expect(page.locator('.mdb-slash-flyout')).toBeVisible()

  await page.keyboard.press('Escape')
  await settle(page)
  await expectFullyDismissed(page)
})

test('取消：表格网格展开时 Escape 清掉根+网格+query', async ({ page }) => {
  await openEditor(page)
  await typeQuery(page, '')

  await rootRows(page).filter({ hasText: '表格' }).click()
  await expect(page.locator('.mdb-slash-grid-cell')).toHaveCount(100)

  await page.keyboard.press('Escape')
  await settle(page)
  await expectFullyDismissed(page)
})

test('取消：flyout 展开时点击编辑器空白处清掉全部', async ({ page }) => {
  await openEditor(page)
  await typeQuery(page, 'bt')

  await rootRows(page).first().click()
  await expect(page.locator('.mdb-slash-flyout')).toBeVisible()

  await page.locator('.cm-content').click({ position: { x: 10, y: 10 } })
  await settle(page)
  await expectFullyDismissed(page)
})

test('取消：网格展开时点击编辑器空白处清掉全部', async ({ page }) => {
  await openEditor(page)
  await typeQuery(page, '')

  await rootRows(page).filter({ hasText: '表格' }).click()
  await expect(page.locator('.mdb-slash-grid-cell')).toHaveCount(100)

  await page.locator('.cm-content').click({ position: { x: 10, y: 10 } })
  await settle(page)
  await expectFullyDismissed(page)
})

test('ArrowLeft 从 flyout 回根：只收二级、根列表仍在', async ({ page }) => {
  await openEditor(page)
  await typeQuery(page, 'bt')

  const before = await rootRows(page).count()
  await rootRows(page).first().click()
  await expect(page.locator('.mdb-slash-flyout')).toBeVisible()

  // ArrowLeft 归 slashMenuSubmenuBack 所有（Prec.high），此时是「返回」而非「取消」
  await page.keyboard.press('ArrowLeft')
  await settle(page)
  await expect(page.locator('.mdb-slash-flyout')).toHaveCount(0)
  await expect(page.locator('.mdb-slash-menu')).toHaveCount(1)
  await expect(rootRows(page)).toHaveCount(before)

  // caret 真正离开 query 末尾后，第二下 ArrowLeft 走取消路径
  await page.keyboard.press('ArrowLeft')
  await settle(page)
  await expectFullyDismissed(page)
})

test('ArrowLeft 从网格回根：只收网格、根列表仍在', async ({ page }) => {
  await openEditor(page)
  await typeQuery(page, '')

  await rootRows(page).filter({ hasText: '表格' }).click()
  await expect(page.locator('.mdb-slash-grid-cell')).toHaveCount(100)

  await page.keyboard.press('ArrowLeft')
  await settle(page)
  await expect(page.locator('.mdb-slash-flyout')).toHaveCount(0)
  await expect(page.locator('.mdb-slash-grid-menu')).toHaveCount(1)
  await expect(rootRows(page)).toHaveCount(17)

  await page.keyboard.press('ArrowLeft')
  await settle(page)
  await expectFullyDismissed(page)
})

test('二级返回根：Esc 后再输入 `/` 重新展开且无残留', async ({ page }) => {
  await openEditor(page)
  await typeQuery(page, 'bt')

  await rootRows(page).first().click()
  await expect(page.locator('.mdb-slash-flyout')).toBeVisible()

  await page.keyboard.press('Escape')
  await settle(page)
  await expectFullyDismissed(page)

  // 同一位置重新打开：根列表重建、二级层不复活
  await focusEditorEnd(page)
  await page.keyboard.type('/')
  await expect(page.locator('.mdb-slash-menu')).toBeVisible()
  await expect(rootRows(page)).toHaveCount(17)
  await expect(page.locator('.mdb-slash-flyout')).toHaveCount(0)
})

test('表格：选 4 列 × 3 行插入精确的 GFM 表格', async ({ page }) => {
  await openEditor(page)
  await typeQuery(page, '')

  await rootRows(page).filter({ hasText: '表格' }).click()
  await expect(page.locator('.mdb-slash-grid-menu')).toHaveCount(1)
  await expect(page.locator('.mdb-slash-grid-cell')).toHaveCount(100)

  await page.locator('.mdb-slash-grid-cell[data-r="3"][data-c="4"]').click()
  await settle(page)
  await expect(page.locator('.mdb-slash-menu')).toHaveCount(0)

  const rows = (await rawDoc(page))
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|'))

  // #386：模板改为空单元格；4 列 × 3 行 = header + separator + 3 body rows
  expect(rows).toHaveLength(5)
  // 每行恰好 4 列——tableCells 不再丢空单元格
  expect(rows.map((row) => tableCells(row).length)).toEqual([4, 4, 4, 4, 4])
  expect(rows.map(tableCells)).toEqual([
    ['', '', '', ''],
    ['---', '---', '---', '---'],
    ['', '', '', ''],
    ['', '', '', ''],
    ['', '', '', ''],
  ])
  // 原始行契约与 table-empty-template.spec.ts 对齐
  expect(rows[0]).toBe('|  |  |  |  |')
  expect(rows[1]).toBe('| --- | --- | --- | --- |')
  // 不再写入 A/B/C/D 或 1/2/3/4 占位文字
  const inserted = rows.join('\n')
  expect(inserted).not.toMatch(/\| [A-Z] \|/)
  expect(inserted).not.toMatch(/\| \d+ \|/)
})
