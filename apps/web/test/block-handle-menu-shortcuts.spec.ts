// #292（change editor-doubao-parity 8.2）：块手柄菜单在已绑定快捷键的项右侧显示快捷键弦，
// 无绑定的项不显示。标题项映射命令注册表 heading-1..6（chord Mod-Alt-1..6，来自 #291）。
// 快捷键 chip 对辅助技术隐藏（aria-hidden），按钮可访问名保持纯文案（#276 契约）。
// 运行：pnpm --filter @md-bundle/web exec playwright test test/block-handle-menu-shortcuts.spec.ts
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
    name: 'block-handle-menu-shortcuts.md',
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

const GRID_LABELS: readonly string[] = [
  '正文',
  '一级标题',
  '二级标题',
  '三级标题',
  '有序',
  '无序',
  '待办',
  '代码',
  '引用',
  '高亮',
]

test('转为 图标网格为纯图标项，不显示快捷键（#330 / #292）', async ({ page }) => {
  await openEditor(page)
  await openMenu(page)

  const menu = page.getByTestId('block-handle-menu')
  for (const label of GRID_LABELS) {
    const item = menu.getByRole('button', { name: label, exact: true })
    await expect(item).toHaveCount(1)
    await expect(item.locator('kbd')).toHaveCount(0)
  }
})

test('块手柄菜单无绑定的项不显示快捷键（#292）', async ({ page }) => {
  await openEditor(page)
  await openMenu(page)

  const menu = page.getByTestId('block-handle-menu')
  for (const label of ['缩进和对齐', '颜色', '上移', '下移', '复制', '删除']) {
    const item = menu.getByRole('button', { name: label, exact: true })
    await expect(item).toHaveCount(1)
    await expect(item.locator('kbd')).toHaveCount(0)
  }
})
