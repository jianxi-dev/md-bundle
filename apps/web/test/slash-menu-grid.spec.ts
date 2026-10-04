// #326（change editor-fidelity）：单列分组插入菜单 + 二级 flyout + 打字筛选。
// AC(A) 空行输入 / → 单列分组列表；AC(B) 输入筛选 → 「标题」flyout 旁展开 → 选 H2 插入。
// 运行：pnpm --filter @md-bundle/web exec playwright test test/slash-menu-grid.spec.ts
import { expect, test, type Locator, type Page } from '@playwright/test'

test.use({ viewport: { width: 1440, height: 900 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page, doc: string): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'slash-menu-grid.md',
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

async function boxOf(
  locator: Locator,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox()
  if (!box) throw new Error('element has no bounding box')
  return box
}

async function expectSingleColumnStack(cells: Locator, grid: Locator): Promise<void> {
  const boxes = await cells.evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect()
      return { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width) }
    }),
  )
  const gridWidth = (await boxOf(grid)).width
  for (const box of boxes) {
    expect(box.x).toBe(boxes[0].x)
    expect(box.width).toBe(boxes[0].width)
    expect(box.width).toBeGreaterThan(gridWidth / 2)
  }
  for (let i = 1; i < boxes.length; i++) {
    expect(boxes[i].y).toBeGreaterThan(boxes[i - 1].y)
  }
}

test('AC(A)：空行输入 / 后菜单以单列分组列表展示', async ({ page }) => {
  await openEditor(page, '# Title\n\n')
  await typeSlashAtDocEnd(page)

  const grid = page.locator('.mdb-slash-grid-menu')
  await expect(grid).toBeVisible()
  await expect(grid).toHaveCSS('display', 'grid')

  const cells = grid.locator('.mdb-slash-item')
  await expect(cells).toHaveCount(10)
  await expect(grid).toContainText('标题')
  await expect(grid).toContainText('标注')
  await expect(grid).toContainText('代码块')

  await expectSingleColumnStack(cells, grid)

  // 分组标题仍在（#250 行为不回退）
  const groups = await page.locator('.mdb-slash-group').allInnerTexts()
  expect(groups).toEqual(['基础', '常用', '绘图'])
})

test('AC(B)：输入筛选列表 → 标题 flyout 旁展开 → 选 H2 插入 ## ', async ({ page }) => {
  await openEditor(page, '# Title\n\n')
  await typeSlashAtDocEnd(page)

  const cells = page.locator('.mdb-slash-grid-menu .mdb-slash-item')
  await expect(cells).toHaveCount(10)

  // 真实键盘输入筛选：'b' 命中 标题/表格/标注，'bt' 收窄到 标题
  await page.keyboard.type('b')
  await expect(cells).toHaveCount(3)
  await page.keyboard.type('t')
  await expect(cells).toHaveCount(1)
  await expect(cells.first()).toContainText('标题')

  // 点击「标题」→ 旁边展开 H1–H6 flyout（根网格保持）
  await cells.first().click()
  const flyout = page.locator('.mdb-slash-flyout')
  await expect(flyout).toBeVisible()
  const flyoutItems = flyout.locator('.mdb-slash-flyout-item')
  await expect(flyoutItems).toHaveCount(6)
  await expect(flyoutItems.first()).toContainText('1 级标题')
  await expect(flyoutItems.last()).toContainText('6 级标题')

  // flyout 与父项相邻（右侧），而不是替换根列表
  const parentBox = await boxOf(cells.first())
  const flyoutBox = await boxOf(flyout)
  expect(flyoutBox.x).toBeGreaterThanOrEqual(parentBox.x + parentBox.width - 2)
  const overlapsVertically =
    flyoutBox.y < parentBox.y + parentBox.height && parentBox.y < flyoutBox.y + flyoutBox.height
  expect(overlapsVertically).toBe(true)
  await expect(cells).toHaveCount(1) // 根列表未被替换

  // 选 2 级标题 → 替换 /bt 整段，写入 ##
  await flyoutItems.filter({ hasText: '2 级标题' }).click()
  await settle(page)
  await expect(page.locator('.mdb-slash-menu')).toHaveCount(0)

  const raw = await rawDoc(page)
  expect(raw).toContain('## ')
  expect(raw).not.toContain('/bt')
})
