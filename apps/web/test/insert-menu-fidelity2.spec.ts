// #358（change editor-fidelity-2 / 2.3）：插入菜单分类列表保真。
// 覆盖 A-12.1 三入口共用 `.mdb-slash-menu`、A-13.1 七大分类、A-14.1/2 表格与分栏
// 悬停展开二级、A-15.1/2 /fN 命令码语义、A-16.1 取消无残留、A-17.1 空行「+」与
// 块手柄同 gutter。
// 运行：pnpm --filter @md-bundle/web exec playwright test test/insert-menu-fidelity2.spec.ts
import { expect, test, type Locator, type Page } from '@playwright/test'

const DOC = '# Title\n\nBody paragraph.\n'
const EMPTY_DOC = '# Title\n\nBody paragraph.\n'

test.use({ viewport: { width: 1440, height: 900 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page, doc: string = DOC): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'insert-menu-fidelity2.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(doc),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

async function placeEnd(page: Page): Promise<void> {
  await page.locator('.cm-content').click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+End' : 'Control+End')
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

/** Open the menu at the doc end and type a filter query after the trigger. */
async function typeQuery(page: Page, query: string): Promise<void> {
  await placeEnd(page)
  await page.keyboard.type('/')
  await expect(page.locator('.mdb-slash-menu')).toBeVisible()
  if (query) {
    await page.keyboard.type(query)
    await settle(page)
  }
}

/** Visible root rows, in registry order. */
function rows(page: Page): Locator {
  return page.locator('.mdb-slash-grid-menu .mdb-slash-item')
}

/** Visible second-level flyout rows. */
function flyoutRows(page: Page): Locator {
  return page.locator('.mdb-slash-flyout-item')
}

async function boxOf(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox()
  if (!box) throw new Error('element has no bounding box')
  return box
}

async function revealAddOnEmptyLine(page: Page, index: number): Promise<void> {
  const box = await boxOf(page.locator('.cm-line').nth(index))
  await page.mouse.move(box.x + 20, box.y + box.height / 2)
  await settle(page)
  await expect(page.getByTestId('empty-line-add')).toBeVisible()
}

/** Reveal the block handle on a content line; the gutter handle needs a real move. */
async function revealHandleOnLine(page: Page, text: string): Promise<void> {
  const line = page.locator('.cm-content .cm-line').filter({ hasText: text }).first()
  const box = await boxOf(line)
  await page.mouse.move(box.x + 30, box.y + box.height / 2)
  await settle(page)
  await expect(page.locator('.mdb-block-handle')).toBeVisible()
}

/**
 * Hover 在下方添加› with a single real pointer move. `.hover()` retries until
 * the element receives pointer events, but the insert menu it opens covers the
 * row, so the actionability check can never settle. The move still fires the
 * same mouseover the handler listens for.
 */
async function hoverInsertMenuRow(page: Page): Promise<void> {
  const box = await boxOf(page.locator('.mdb-block-handle-item', { hasText: '在下方添加' }))
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await settle(page)
}

// A-12.1：三入口共用同一 `.mdb-slash-menu`。
test('A-12.1a 入口一：空行「+」点击打开 .mdb-slash-menu', async ({ page }) => {
  await openEditor(page, EMPTY_DOC)
  await revealAddOnEmptyLine(page, 1)
  await page.getByTestId('empty-line-add').click()
  await expect(page.locator('.mdb-slash-menu')).toBeVisible()
})

test('A-12.1b 入口二：块菜单「在下方添加›」悬停打开 .mdb-slash-menu', async ({ page }) => {
  await openEditor(page)
  await revealHandleOnLine(page, 'Body paragraph.')

  await page.locator('.mdb-block-handle').hover()
  await expect(page.locator('.mdb-block-handle-menu')).toBeVisible()

  await hoverInsertMenuRow(page)
  await expect(page.locator('.mdb-slash-menu')).toBeVisible()
  // 与 `/` 入口同一根实例：分类标题同样存在。
  await expect(page.locator('.mdb-slash-group').first()).toBeVisible()
})

test('A-12.1c 入口三：输入 / 打开 .mdb-slash-menu', async ({ page }) => {
  await openEditor(page)
  await typeQuery(page, '')
  await expect(page.locator('.mdb-slash-menu')).toBeVisible()
})

// A-13.1：分类列表形态（七大分类）。
test('A-13.1 菜单为七大分类纵向列表', async ({ page }) => {
  await openEditor(page)
  await typeQuery(page, '')
  await expect(rows(page)).toHaveCount(17)

  const groups = await page.locator('.mdb-slash-group').allInnerTexts()
  expect(groups).toEqual(['基础', '常用', '数据', '绘图', '团队协作', '进阶', '更多小组件'])

  await page.screenshot({ path: '../../.artifacts/358/01-seven-categories.png' })
})

// A-14.1：表格悬停展开 10×10 尺寸选择器。
test('A-14.1 悬停「表格」展开 10×10 选择器并带标题', async ({ page }) => {
  await openEditor(page)
  await typeQuery(page, '')

  await rows(page).filter({ hasText: '表格' }).hover()
  await expect(page.locator('.mdb-slash-grid-title')).toHaveText('插入支持富文本的表格')
  await expect(page.locator('.mdb-slash-grid-cell')).toHaveCount(100)

  await page.screenshot({ path: '../../.artifacts/358/02-table-grid.png' })
})

// A-14.2：分栏悬停展开栏数选择器。
test('A-14.2 悬停「分栏」展开 1–5 栏选择器', async ({ page }) => {
  await openEditor(page)
  await typeQuery(page, '')

  await rows(page).filter({ hasText: '分栏' }).hover()
  await expect(flyoutRows(page)).toHaveCount(5)
  await expect(flyoutRows(page).first()).toContainText('1 栏')
  await expect(flyoutRows(page).last()).toContainText('5 栏')
})

// A-15.1：/f3 命中 3 栏并插入 fenced div。
test('A-15.1 /f3 命中「3 栏」且插入 col-3', async ({ page }) => {
  await openEditor(page)
  await typeQuery(page, 'f3')

  await expect(rows(page)).toHaveCount(1)
  await expect(rows(page).first()).toContainText('3 栏')

  await page.screenshot({ path: '../../.artifacts/358/03-f3-match.png' })

  await page.keyboard.press('Enter')
  await settle(page)
  await expect(page.locator('.mdb-slash-menu')).toHaveCount(0)

  const raw = await rawDoc(page)
  expect(raw).toContain('{.col-3}')
  expect(raw).not.toContain('/f3')
})

// A-15.2：/fl3 无匹配且显示空态。
test('A-15.2 /fl3 无匹配并显示「无匹配项」', async ({ page }) => {
  await openEditor(page)
  await typeQuery(page, 'fl3')

  await expect(rows(page)).toHaveCount(0)
  await expect(page.locator('.mdb-slash-empty')).toHaveText('无匹配项')
  await expect(page.locator('.mdb-slash-menu')).toBeVisible()
})

// A-16.1：三条取消路径都不留 `/`、`、` 残留。
test('A-16.1a Escape 后无 / 、 残留', async ({ page }) => {
  await openEditor(page)
  await placeEnd(page)
  await page.keyboard.insertText('、')
  await expect(page.locator('.mdb-slash-menu')).toBeVisible()

  await page.keyboard.press('Escape')
  await settle(page)
  await expect(page.locator('.mdb-slash-menu')).toHaveCount(0)

  const raw = await rawDoc(page)
  expect(raw).not.toContain('/')
  expect(raw).not.toContain('、')
  expect(raw).toContain('# Title')

  await page.screenshot({ path: '../../.artifacts/358/04-cancel-no-residue.png' })
})

test('A-16.1b 外部点击后无 / 残留', async ({ page }) => {
  await openEditor(page)
  await typeQuery(page, 'f3')
  await expect(rows(page)).toHaveCount(1)

  await page.locator('.cm-content').click({ position: { x: 10, y: 10 } })
  await settle(page)
  await expect(page.locator('.mdb-slash-menu')).toHaveCount(0)

  const raw = await rawDoc(page)
  expect(raw).not.toContain('/')
})

test('A-16.1c caret 离开后无 / 残留', async ({ page }) => {
  await openEditor(page)
  await typeQuery(page, 'f3')

  await page.keyboard.press('ArrowLeft')
  await settle(page)
  await expect(page.locator('.mdb-slash-menu')).toHaveCount(0)

  const raw = await rawDoc(page)
  expect(raw).not.toContain('/')
})

async function openBelowMenu(page: Page): Promise<void> {
  await revealHandleOnLine(page, 'Body paragraph.')
  await page.locator('.mdb-block-handle').hover()
  await expect(page.locator('.mdb-block-handle-menu')).toBeVisible()
  await hoverInsertMenuRow(page)
  await expect(page.locator('.mdb-slash-menu')).toBeVisible()
}

test('below: 在下方添加› → 代码块插入独立围栏块（新行，不压扁）', async ({ page }) => {
  await openEditor(page)
  await openBelowMenu(page)
  await page.screenshot({ path: '../../.artifacts/358/05-below-menu.png' })

  await page.locator('.mdb-slash-grid-menu .mdb-slash-item', { hasText: '代码块' }).click()
  await settle(page)
  await expect(page.locator('.mdb-slash-menu')).toHaveCount(0)

  const raw = await rawDoc(page)
  const fenceLines = raw.split('\n').filter((line) => line.trim() === '```')
  expect(fenceLines.length).toBe(2)
  expect(raw.indexOf('Body paragraph.')).toBeLessThan(raw.indexOf('```'))
  expect(raw).not.toContain('Body paragraph. ```')
})

test('below: 在下方添加› → 表格插入真实 GFM 表格（含管道符）', async ({ page }) => {
  await openEditor(page)
  await openBelowMenu(page)

  await page.locator('.mdb-slash-grid-menu .mdb-slash-item', { hasText: '表格' }).hover()
  await expect(page.locator('.mdb-slash-grid-cell')).toHaveCount(100)
  await page.locator('.mdb-slash-grid-cell[data-r="2"][data-c="3"]').click()
  await settle(page)
  await expect(page.locator('.mdb-slash-menu')).toHaveCount(0)

  const raw = await rawDoc(page)
  const tableLines = raw.split('\n').filter((line) => line.includes('|'))
  expect(tableLines).toHaveLength(4)
  expect(tableLines[0]).toContain('| A | B | C |')
  expect(raw.indexOf('Body paragraph.')).toBeLessThan(raw.indexOf('| A | B | C |'))
})

// A-17.1：空行「+」与块手柄同 gutter x 差 < 2px。
test('A-17.1 空行「+」与块手柄 x 差 < 2px', async ({ page }) => {
  await openEditor(page)

  await revealAddOnEmptyLine(page, 1)
  const addBox = await boxOf(page.getByTestId('empty-line-add'))

  await revealHandleOnLine(page, 'Body paragraph.')
  const handleBox = await boxOf(page.locator('.mdb-block-handle'))

  expect(Math.abs(addBox.x - handleBox.x)).toBeLessThan(2)
})
