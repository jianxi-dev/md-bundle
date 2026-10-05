// #332（change editor-fidelity 4.1）：表格保真：不坍缩源码 + 格内手柄插入菜单 + 格间线锚点（W6）
// 运行：pnpm --filter @md-bundle/web exec playwright test test/table-fidelity.spec.ts
import { expect, test, type Page } from '@playwright/test'
import { PALETTE_KEY } from './keys'

const DOC = `Intro paragraph.

| A | B |
| --- | --- |
| 1 | 2 |
| 3 | 4 |
`

test.use({ viewport: { width: 1440, height: 900 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'table-fidelity.md',
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

test('AC: 点击单元格后表格不坍缩为原始 | 源码（无连续 | 行）', async ({ page }) => {
  await openEditor(page)

  const table = page.getByTestId('cm-table')
  await expect(table).toBeVisible()

  const cell = table.locator('td[data-row="0"][data-col="0"]')
  await expect(cell).toBeVisible()
  await cell.click()
  await settle(page)

  // 严格：编辑区内容不包含连续两个 | 的行（原始源码行）
  const content = await page.locator('.cm-content').first().innerText()
  const hasRawPipeLine = content.split('\n').some((line) => /\|\s*\|/.test(line))
  expect(hasRawPipeLine).toBe(false)

  // 表格仍然渲染
  await expect(page.getByTestId('cm-table')).toBeVisible()
})

test('AC: 点击单元格后仍可编辑并回写源码', async ({ page }) => {
  await openEditor(page)

  const cell = page.getByTestId('cm-table').locator('td[data-row="0"][data-col="0"]')
  await expect(cell).toBeVisible()
  await cell.click()
  await settle(page)

  await page.keyboard.type('A1')
  await settle(page)

  expect(await rawDoc(page)).toContain('A1')
})

test('AC: 格内手柄悬停打开插入菜单（基础图标组）', async ({ page }) => {
  await openEditor(page)

  const cell = page.getByTestId('cm-table').locator('td[data-row="0"][data-col="0"]')
  await expect(cell).toBeVisible()
  await cell.hover()
  await settle(page)

  const handle = page.getByTestId('cm-table-cell-handle').first()
  await expect(handle).toBeVisible()
  await handle.hover()
  await settle(page)

  // 展开的是插入菜单（含「基础」图标网格），而非块菜单。
  const slashMenu = page.getByTestId('slash-menu')
  await expect(slashMenu).toBeVisible()
  await expect(slashMenu).toContainText('基础')
  await expect(slashMenu.locator('.mdb-slash-item').first()).toBeVisible()
})

test('AC: 格间线热点悬停高亮单一边界线', async ({ page }) => {
  await openEditor(page)

  // 先悬停单元格浮现热点，再悬停热点 → 仅对应边界进入 active（边界层自身不接管指针）。
  await page.getByTestId('cm-table').locator('td[data-row="0"][data-col="0"]').hover()
  const hotspot = page.getByTestId('cm-table-hotspot').first()
  await expect(hotspot).toBeVisible()
  await hotspot.hover()
  await settle(page)

  await expect(page.locator('.cm-table-boundary-active')).toHaveCount(1)
})

test('AC: 直接插入表格默认 2×3 且单元格为空', async ({ page }) => {
  // 先上传一个不含表格的文档，否则编辑模式按钮不可用（无文档时无工作区）
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'empty.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('no table here\n'),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await page.locator('.cm-content').click()
  await page.waitForTimeout(200)

  // 真实用户路径：命令面板 →「插入表格」。该命令无尺寸选择器，走默认 2×3 空表。
  await page.keyboard.press(PALETTE_KEY)
  const paletteInput = page.getByTestId('command-palette-input')
  await expect(paletteInput).toBeVisible()
  await paletteInput.fill('插入表格')
  await page.getByTestId('command-palette-item').filter({ hasText: '插入表格' }).click()
  await settle(page)

  const table = page.getByTestId('cm-table')
  await expect(table).toBeVisible()
  await expect(table.locator('th')).toHaveCount(2)
  await expect(table.locator('td')).toHaveCount(4)

  const source = await rawDoc(page)
  // 不应包含占位符 A/B/1/2/3/4
  expect(source).not.toContain('| A |')
  expect(source).not.toContain('| B |')
  expect(source).not.toContain('| 1 |')
  expect(source).not.toContain('| 2 |')
  expect(source).not.toContain('| 3 |')
  expect(source).not.toContain('| 4 |')
})

test('AC: 点击单元格后输入框获得焦点（不坍缩即可编辑的前提）', async ({ page }) => {
  await openEditor(page)

  const cell = page.getByTestId('cm-table').locator('td[data-row="0"][data-col="0"]')
  await cell.click()

  await expect(page.getByTestId('cm-table-cell-input')).toBeFocused()
})

test('AC: 编辑 A 格后直接点 B 格，两格输入都写回', async ({ page }) => {
  await openEditor(page)

  const table = page.getByTestId('cm-table')
  const a = table.locator('td[data-row="0"][data-col="0"]')
  const b = table.locator('td[data-row="0"][data-col="1"]')

  await a.click()
  await expect(page.getByTestId('cm-table-cell-input')).toBeFocused()
  await page.keyboard.type('X')
  await settle(page)

  await b.click()
  await expect(page.getByTestId('cm-table-cell-input')).toBeFocused()
  await page.keyboard.type('Y')

  const source = await rawDoc(page)
  expect(source).toContain('1X')
  expect(source).toContain('2Y')
})

test('AC: 编辑中直接切换源码模式，未提交的输入不丢', async ({ page }) => {
  await openEditor(page)

  const cell = page.getByTestId('cm-table').locator('td[data-row="0"][data-col="0"]')
  await cell.click()
  await expect(page.getByTestId('cm-table-cell-input')).toBeFocused()
  await page.keyboard.type('X')
  await settle(page)

  await page.getByTestId('mode-source-btn').click()
  await expect(page.locator('.cm-content').first()).toBeVisible()
  const text = await page.locator('.cm-content').first().innerText()
  expect(text).toContain('1X')
})
