// 块手柄菜单图标（#276 task 2.4）e2e：打开手柄菜单后，每一项都显示图标 + 文案，
// 且图标 aria-hidden 不污染按钮可访问名（getByRole name 仍能按纯文案定位）。
// 运行：pnpm --filter @md-bundle/web exec playwright test test/block-handle-menu-icons.spec.ts
import { expect, test, type Page } from '@playwright/test'

const DOC = `# Heading

paragraph one

- list item one
`

test.use({ viewport: { width: 1440, height: 900 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'block-handle-menu-icons.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

async function openMenu(page: Page): Promise<void> {
  const line = page.locator('.cm-content .cm-line').filter({ hasText: 'paragraph one' }).first()
  const box = await line.boundingBox()
  if (!box) throw new Error('line has no box')
  await page.mouse.move(box.x + 30, box.y + box.height / 2)
  await settle(page)
  const handle = page.locator('.mdb-block-handle')
  await expect(handle).toBeVisible()
  await handle.click()
  await expect(page.getByTestId('block-handle-menu')).toBeVisible()
}

const CONVERT_GRID_ROWS: ReadonlyArray<readonly [label: string, icon: string]> = [
  ['正文', 'TextOutlined'],
  ['一级标题', 'H1Outlined'],
  ['二级标题', 'H2Outlined'],
  ['三级标题', 'H3Outlined'],
  ['有序', 'OrderListOutlined'],
  ['无序', 'DisorderListOutlined'],
  ['待办', 'TodoOutlined'],
  ['代码', 'CodeblockOutlined'],
  ['引用', 'ReferenceOutlined'],
  ['高亮', 'CalloutOutlined'],
]

const ACTION_ROWS: ReadonlyArray<readonly [label: string, icon: string]> = [
  ['上移', 'ArrowUpwardOutlined'],
  ['下移', 'ArrowDownwardOutlined'],
  ['复制', 'CopyOutlined'],
  ['删除', 'DeleteOutlined'],
  ['评论', 'AddCommentOutlined'],
  ['剪切', 'FeishuclipOutlined'],
  ['翻译', 'TranslateOutlined'],
  ['分享', 'SharewordsOutlined'],
  ['复制链接', 'BlocklinkOutlined'],
  ['在下方添加', 'NewJoinMeetingOutlined'],
]

test('转为 图标网格每一项都显示对应图标（#276 / #330）', async ({ page }) => {
  await openEditor(page)
  await openMenu(page)

  const gridItems = page.locator('.mdb-block-handle-menu .mdb-block-handle-grid-item')
  await expect(gridItems).toHaveCount(CONVERT_GRID_ROWS.length)

  for (let i = 0; i < CONVERT_GRID_ROWS.length; i += 1) {
    const [label, icon] = CONVERT_GRID_ROWS[i]
    const item = gridItems.nth(i)
    await expect(item).toHaveAttribute('aria-label', label)
    const svg = item.locator('svg')
    await expect(svg).toHaveCount(1)
    await expect(svg).toHaveAttribute('aria-hidden', 'true')
    await expect(svg).toHaveAttribute('data-icon', icon)
  }
})

test('底部动作行显示图标 + 文案（#276）', async ({ page }) => {
  await openEditor(page)
  await openMenu(page)

  const menu = page.getByTestId('block-handle-menu')
  for (const [label, icon] of ACTION_ROWS) {
    const item = menu.getByRole('button', { name: label, exact: true })
    await expect(item).toHaveCount(1)
    await expect(item).toContainText(label)
    const iconEl = item.locator('.mdb-block-handle-item-icon')
    await expect(iconEl).toBeVisible()
    await expect(iconEl).toHaveAttribute('aria-hidden', 'true')
    await expect(iconEl.locator('svg')).toHaveAttribute('data-icon', icon)
  }
})

test('图标不污染按钮可访问名：每项仍按文案/aria-label 定位（#276 / #330）', async ({ page }) => {
  await openEditor(page)
  await openMenu(page)

  const menu = page.getByTestId('block-handle-menu')
  for (const [label] of CONVERT_GRID_ROWS) {
    await expect(menu.getByRole('button', { name: label, exact: true })).toHaveCount(1)
  }
  for (const [label] of ACTION_ROWS) {
    await expect(menu.getByRole('button', { name: label, exact: true })).toHaveCount(1)
  }
  for (const label of ['缩进和对齐', '颜色']) {
    await expect(menu.getByRole('button', { name: label, exact: true })).toHaveCount(1)
  }
})
