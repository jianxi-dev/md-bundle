// 块手柄保真度二期（#356 task 2.1）e2e：
// 1. 手柄尺寸 42×26 两段式药丸
// 2. 表格块手柄 data-icon === DataSheetOutlined
// 3. 悬停文本不开菜单；悬停手柄开菜单（hover-intent 140ms）
// 4. 空行 "+" 与手柄 left 差值 ≤ 2px
// 运行：pnpm --filter @md-bundle/web exec playwright test test/block-handle-fidelity2.spec.ts
import { expect, test, type Locator, type Page } from '@playwright/test'

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

// --- 1. 手柄尺寸与结构 ---
const SIMPLE_PARA_DOC = `Paragraph one.

Paragraph two.`

test('手柄尺寸为 42×26 两段式药丸', async ({ page }) => {
  await openEditorWith(page, 'handle-dimensions.md', SIMPLE_PARA_DOC)
  await hoverLine(page, 'Paragraph one')

  const handle = page.getByTestId('block-handle')
  await expect(handle).toBeVisible()
  const handleBox = await boxOf(handle)

  // 宽度 42px，高度 26px（允许 1px 亚像素误差）
  expect(handleBox.width).toBeGreaterThanOrEqual(41)
  expect(handleBox.width).toBeLessThanOrEqual(43)
  expect(handleBox.height).toBeGreaterThanOrEqual(25)
  expect(handleBox.height).toBeLessThanOrEqual(27)

  // 两段式结构：左侧类型图标 + 右侧拖拽手柄
  const typeIcon = handle.locator('.mdb-block-type-icon')
  const dragHandle = handle.locator('.mdb-drag-handle')
  await expect(typeIcon).toBeVisible()
  await expect(dragHandle).toBeVisible()

  // 左段 22×22，右段 16×22（允许 1px 误差）
  const typeBox = await boxOf(typeIcon)
  expect(typeBox.width).toBeGreaterThanOrEqual(21)
  expect(typeBox.width).toBeLessThanOrEqual(23)
  expect(typeBox.height).toBeGreaterThanOrEqual(21)
  expect(typeBox.height).toBeLessThanOrEqual(23)

  const dragBox = await boxOf(dragHandle)
  expect(dragBox.width).toBeGreaterThanOrEqual(15)
  expect(dragBox.width).toBeLessThanOrEqual(17)
  expect(dragBox.height).toBeGreaterThanOrEqual(21)
  expect(dragBox.height).toBeLessThanOrEqual(23)

  // 容器样式：border-radius 6px, border 1px solid var(--mdb-border), padding 0 3px
  await expect(handle).toHaveCSS('border-radius', '6px')
  await expect(handle).toHaveCSS('padding-left', '3px')
  await expect(handle).toHaveCSS('padding-right', '3px')
})

// --- 2. 表格块图标 ---
const TABLE_DOC = `\n| H1 | H2 |
| --- | --- |
| a | b |`

test('表格块手柄 data-icon 为 DataSheetOutlined', async ({ page }) => {
  await openEditorWith(page, 'handle-table.md', TABLE_DOC)
  await hoverLine(page, 'H1') // 表格表头单元格

  const handle = page.getByTestId('block-handle')
  await expect(handle).toBeVisible()
  await expect(handle).toHaveAttribute('data-icon', 'DataSheetOutlined')
})

// --- 3. 悬停编排（F-05）---
const HOVER_DOC = `Paragraph for hover test.

Another paragraph.`

test('悬停文本不开菜单；悬停手柄开菜单（hover-intent 140ms）', async ({ page }) => {
  await openEditorWith(page, 'handle-hover.md', HOVER_DOC)

  // 1. 悬停文本行 — 手柄出现但菜单不开
  await hoverLine(page, 'Paragraph for hover test')
  const handle = page.getByTestId('block-handle')
  await expect(handle).toBeVisible()

  const menu = page.getByTestId('block-handle-menu')
  await expect(menu).toBeHidden()

  // 2. 悬停手柄 — hover-intent 后菜单打开
  await hoverHandle(page)
  await expect(menu).toBeVisible()
  await expect(menu).toContainText('转换为')

  // 3. 从手柄移入文本 — 菜单保持开启（不瞬间关闭）
  await hoverLine(page, 'Paragraph for hover test')
  await expect(menu).toBeVisible()

  // 4. 离开编辑器区域 — 菜单关闭
  await page.mouse.move(100, 100) // 移到编辑器外
  await settle(page)
  await expect(menu).toBeHidden()
})

// --- 4. 空行 "+" 对齐（F-06）---
const EMPTY_LINE_DOC = `Paragraph with content.

Another paragraph.`

test('空行 "+" 与手柄 left 差值 ≤ 2px', async ({ page }) => {
  await openEditorWith(page, 'handle-empty-line.md', EMPTY_LINE_DOC)

  // 先悬停一个有内容的行，让手柄显示并记录位置
  await hoverLine(page, 'Paragraph with content')
  const handle = page.getByTestId('block-handle')
  await expect(handle).toBeVisible()
  const handleBox = await boxOf(handle)
  const handleLeft = handleBox.x

  // 移到空行（段落间的空行）
  const content = page.locator('.cm-content')
  const contentBox = await boxOf(content)
  // 移到第一段落下方的空行位置
  await page.mouse.move(contentBox.x + 20, contentBox.y + 40)
  await settle(page)

  const emptyLineAdd = page.getByTestId('empty-line-add')
  await expect(emptyLineAdd).toBeVisible()
  const addBox = await boxOf(emptyLineAdd)
  const addLeft = addBox.x

  // 差值 ≤ 2px
  const diff = Math.abs(addLeft - handleLeft)
  expect(diff).toBeLessThanOrEqual(2)
})

// --- 5. 各块型图标映射 ---
const ORDERED_LIST_DOC = `1. Ordered item one
2. Ordered item two

Paragraph.`

test('有序列表块手柄 data-icon 为 OrderListOutlined', async ({ page }) => {
  await openEditorWith(page, 'handle-ordered-list.md', ORDERED_LIST_DOC)
  await hoverLine(page, 'Ordered item one')

  const handle = page.getByTestId('block-handle')
  await expect(handle).toBeVisible()
  await expect(handle).toHaveAttribute('data-icon', 'OrderListOutlined')
})

const UNORDERED_LIST_DOC = `- Unordered item one
- Unordered item two

Paragraph.`

test('无序列表块手柄 data-icon 为 DisorderListOutlined', async ({ page }) => {
  await openEditorWith(page, 'handle-unordered-list.md', UNORDERED_LIST_DOC)
  await hoverLine(page, 'Unordered item one')

  const handle = page.getByTestId('block-handle')
  await expect(handle).toBeVisible()
  await expect(handle).toHaveAttribute('data-icon', 'DisorderListOutlined')
})

const TASK_LIST_DOC = `- [ ] Unchecked task

Paragraph.`

test('任务列表块手柄 data-icon 为 TodoOutlined', async ({ page }) => {
  await openEditorWith(page, 'handle-task-list.md', TASK_LIST_DOC)
  await hoverLine(page, 'Unchecked task')

  const handle = page.getByTestId('block-handle')
  await expect(handle).toBeVisible()
  await expect(handle).toHaveAttribute('data-icon', 'TodoOutlined')
})

const BLOCKQUOTE_DOC = `> Regular blockquote

Paragraph.`

test('引用块手柄 data-icon 为 ReferenceOutlined', async ({ page }) => {
  await openEditorWith(page, 'handle-blockquote.md', BLOCKQUOTE_DOC)
  await hoverLine(page, 'Regular blockquote')

  const handle = page.getByTestId('block-handle')
  await expect(handle).toBeVisible()
  await expect(handle).toHaveAttribute('data-icon', 'ReferenceOutlined')
})

const CODE_BLOCK_DOC = `\`\`\`ts
const code = 1
\`\`\`

Paragraph.`

test('代码块手柄 data-icon 为 CodeblockOutlined', async ({ page }) => {
  await openEditorWith(page, 'handle-code-block.md', CODE_BLOCK_DOC)
  await hoverLine(page, 'const code = 1')

  const handle = page.getByTestId('block-handle')
  await expect(handle).toBeVisible()
  await expect(handle).toHaveAttribute('data-icon', 'CodeblockOutlined')
})

const THEMATIC_BREAK_DOC = `---

Paragraph.`

test('分割线块手柄 data-icon 为 DividerOutlined', async ({ page }) => {
  await openEditorWith(page, 'handle-thematic-break.md', THEMATIC_BREAK_DOC)
  await hoverLine(page, '---')

  const handle = page.getByTestId('block-handle')
  await expect(handle).toBeVisible()
  await expect(handle).toHaveAttribute('data-icon', 'DividerOutlined')
})

const CALLOUT_DOC = `> [!NOTE]
> This is a callout.

Paragraph.`

test('Callout 块手柄 data-icon 为 CalloutOutlined（而非 ReferenceOutlined）', async ({ page }) => {
  await openEditorWith(page, 'handle-callout.md', CALLOUT_DOC)
  await hoverLine(page, 'This is a callout')

  const handle = page.getByTestId('block-handle')
  await expect(handle).toBeVisible()
  await expect(handle).toHaveAttribute('data-icon', 'CalloutOutlined')
  await expect(handle).not.toHaveAttribute('data-icon', 'ReferenceOutlined')
})

const PARAGRAPH_DOC = `Regular paragraph.

Another paragraph.`

test('普通段落手柄 data-icon 为 TextOutlined', async ({ page }) => {
  await openEditorWith(page, 'handle-paragraph.md', PARAGRAPH_DOC)
  await hoverLine(page, 'Regular paragraph')

  const handle = page.getByTestId('block-handle')
  await expect(handle).toBeVisible()
  await expect(handle).toHaveAttribute('data-icon', 'TextOutlined')
})