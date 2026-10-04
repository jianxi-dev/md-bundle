// #329（change editor-fidelity 8.2 / W11b）：命令面板单列重设计。
// 现状（#281）是 190px CSS 网格 + 键位被挤；本票改回单列列表，每行「图标 | 名称 | 简介 | 快捷键（右对齐）」。
// 运行：pnpm --filter @md-bundle/web exec playwright test test/command-palette-single-column.spec.ts
import { expect, test, type Page } from '@playwright/test'
import { PALETTE_KEY } from './keys'

const DOC = '# 标题\n\n正文段落。\n\n'

// #335：快捷键显示平台化（Mac ⌘B / 其他 Ctrl+B），由 RUNNER 平台计算，浏览器平台一致。
const MOD = process.platform === 'darwin' ? '⌘' : 'Ctrl+'
const BOLD_CHORD = `${MOD}B`

test.use({ viewport: { width: 1440, height: 900 } })

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'palette-single-column-test.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await page.locator('.cm-content').click()
  await page.waitForTimeout(200)
}

async function openPalette(page: Page): Promise<void> {
  await openEditor(page)
  await page.keyboard.press(PALETTE_KEY)
  await expect(page.getByTestId('command-palette')).toBeVisible()
  await expect(page.getByTestId('command-palette-input')).toBeVisible()
}

test('命令面板为单列布局：列表非网格，各行同列对齐', async ({ page }) => {
  await openPalette(page)

  const list = page.locator('.mdb-palette-list')
  await expect(list).toBeVisible()

  const layout = await list.evaluate((el) => {
    const cs = getComputedStyle(el)
    return { display: cs.display, columns: cs.gridTemplateColumns }
  })
  // 回归 #281 网格：必须是 flex 单列，且不再有网格列轨道。
  expect(layout.display).toBe('flex')
  expect(layout.display).not.toBe('grid')
  expect(layout.columns === 'none' || layout.columns === '').toBe(true)

  const rows = page.locator('.mdb-palette-item')
  await expect(rows.first()).toBeVisible()
  expect(await rows.count()).toBeGreaterThan(1)

  // 单列：前若干行的左边界与宽度完全一致（网格时代会跨列错位）。
  const boxes = await Promise.all([0, 1, 2].map((i) => rows.nth(i).boundingBox()))
  for (const box of boxes) expect(box).not.toBeNull()
  const [first, second, third] = boxes as NonNullable<(typeof boxes)[number]>[]
  expect(second.x).toBeCloseTo(first.x, 0)
  expect(third.x).toBeCloseTo(first.x, 0)
  expect(second.width).toBeCloseTo(first.width, 0)
})

test('每行显示快捷键，且 加粗 的快捷键右对齐并平台格式化（#335/#329）', async ({ page }) => {
  await openPalette(page)

  const boldRow = page.locator('.mdb-palette-item').filter({ hasText: '加粗' }).first()
  await expect(boldRow).toBeVisible()
  await expect(boldRow.locator('kbd')).toBeVisible()
  await expect(boldRow.locator('kbd')).toHaveText(BOLD_CHORD)

  const rowBox = await boldRow.boundingBox()
  const kbdBox = await boldRow.locator('kbd').boundingBox()
  expect(rowBox).not.toBeNull()
  expect(kbdBox).not.toBeNull()
  // 键位贴着行右缘（行内右边距 10px；允许少量抖动）。
  const gapRight = rowBox!.x + rowBox!.width - (kbdBox!.x + kbdBox!.width)
  expect(gapRight).toBeLessThan(24)
})

test('↓ 在单列内顺序移动选中，不跨列；选中态带高亮类与左侧 2px 强调条', async ({ page }) => {
  await openPalette(page)
  const input = page.getByTestId('command-palette-input')
  const selected = page.locator('[data-testid="command-palette-item"][data-selected="true"]')

  // 初始选中第一行（索引 0）。
  expect(await selected.count()).toBe(1)
  const firstBox = await selected.boundingBox()
  const firstName = (await selected.textContent()) ?? ''

  await input.press('ArrowDown')
  expect(await selected.count()).toBe(1)
  const secondBox = await selected.boundingBox()
  const secondName = (await selected.textContent()) ?? ''

  // 向下移动一行：x 不变（同一列），y 增大；且确实换了一行。
  expect(secondName).not.toBe(firstName)
  expect(secondBox!.x).toBeCloseTo(firstBox!.x, 0)
  expect(secondBox!.y).toBeGreaterThan(firstBox!.y)

  // 选中态：高亮类 + data-selected + 左侧 2px 强调条。
  await expect(selected).toHaveClass(/mdb-palette-item--selected/)
  const accentWidth = await selected
    .locator('[data-testid="command-palette-accent"]')
    .evaluate((el) => getComputedStyle(el).width)
  expect(accentWidth).toBe('2px')

  // 未选中的行不带强调条。
  const unselectedAccents = await page
    .locator('.mdb-palette-item:not([data-selected="true"]) [data-testid="command-palette-accent"]')
    .count()
  expect(unselectedAccents).toBe(0)
})

test('拼音首字母 jc 匹配 加粗（命中字符高亮）', async ({ page }) => {
  await openPalette(page)
  const input = page.getByTestId('command-palette-input')
  await input.fill('jc')

  const boldRow = page.locator('.mdb-palette-item').filter({ hasText: '加粗' }).first()
  await expect(boldRow).toBeVisible()
  // 匹配高亮：命中字符包在 <b> 中。
  expect(await boldRow.locator('.mdb-palette-label b').count()).toBeGreaterThan(0)
})

test('底部快捷键提示条可见', async ({ page }) => {
  await openPalette(page)
  const footer = page.getByTestId('command-palette-footer')
  await expect(footer).toBeVisible()
  await expect(footer).toContainText('选择')
  await expect(footer).toContainText('执行')
  await expect(footer).toContainText('关闭')
})

test('无匹配时显示空态与建议 chip，Escape 可关闭且无残留', async ({ page }) => {
  await openPalette(page)
  const input = page.getByTestId('command-palette-input')
  await input.fill('zzzzz')

  const empty = page.getByTestId('command-palette-empty')
  await expect(empty).toBeVisible()
  const suggestions = page.getByTestId('command-palette-suggestion')
  await expect(suggestions.first()).toBeVisible()
  await expect(suggestions.filter({ hasText: '表格' })).toBeVisible()

  await input.press('Escape')
  await expect(page.getByTestId('command-palette')).toBeHidden()
  await expect(page.getByTestId('command-palette-backdrop')).toHaveCount(0)
})
