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

/** 菜单行顺序与 MENU_ACTIONS 一致：转换为组 + 上移/下移/复制/删除。 */
const MENU_ROWS: ReadonlyArray<readonly [label: string, icon: string]> = [
  ['一级标题', 'H1'],
  ['二级标题', 'H2'],
  ['三级标题', 'H3'],
  ['四级标题', 'H4'],
  ['五级标题', 'H5'],
  ['六级标题', 'H6'],
  ['正文', '¶'],
  ['上移', '↑'],
  ['下移', '↓'],
  ['复制块', '⧉'],
  ['删除块', '✕'],
]

test('菜单每一项都显示图标 + 文案（#276）', async ({ page }) => {
  await openEditor(page)
  await openMenu(page)

  const items = page.locator('.mdb-block-handle-menu .mdb-block-handle-item')
  await expect(items).toHaveCount(MENU_ROWS.length)

  for (let i = 0; i < MENU_ROWS.length; i += 1) {
    const [label, icon] = MENU_ROWS[i]
    const item = items.nth(i)
    // 文案仍在
    await expect(item).toContainText(label)
    // 图标非空、可见，且对辅助技术隐藏
    const iconEl = item.locator('.mdb-block-handle-item-icon')
    await expect(iconEl).toBeVisible()
    await expect(iconEl).toHaveText(icon)
    await expect(iconEl).toHaveAttribute('aria-hidden', 'true')
  }
})

test('图标不污染按钮可访问名：每个动作仍按纯文案定位（#276）', async ({ page }) => {
  await openEditor(page)
  await openMenu(page)

  const menu = page.getByTestId('block-handle-menu')
  for (const [label] of MENU_ROWS) {
    await expect(menu.getByRole('button', { name: label, exact: true })).toHaveCount(1)
  }
})
