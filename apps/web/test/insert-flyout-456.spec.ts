// #456：「在下方添加」应在块菜单右侧展开二级面板，而不是替换掉块菜单。
import { expect, test, type Page } from '@playwright/test'

test.use({ viewport: { width: 1440, height: 1000 } })
const DOC = `# T

第一段。

第二段。

尾。
`

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'insert-flyout-456.md',
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

async function openBlockMenu(page: Page, text: string): Promise<void> {
  const line = page.locator('.cm-content .cm-line').filter({ hasText: text }).first()
  await expect(line).toBeVisible()
  const box = await line.boundingBox()
  if (!box) throw new Error('no line box')
  await page.mouse.move(box.x + 30, box.y + box.height / 2)
  await settle(page)
  const handle = page.getByTestId('block-handle')
  await expect(handle).toBeVisible()
  const hb = await handle.boundingBox()
  if (!hb) throw new Error('no handle box')
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2)
  await expect(page.getByTestId('block-handle-menu')).toBeVisible()
  await settle(page)
}

test('hover「在下方添加」→ 块菜单保持打开，右侧出现二级面板', async ({ page }) => {
  await openEditor(page)
  await openBlockMenu(page, '第一段')

  const row = page.locator('[data-flyout="insert-menu"]').first()
  await expect(row).toBeVisible()
  await row.hover()
  await settle(page)

  // 块菜单没有被替换
  const menu = page.getByTestId('block-handle-menu')
  await expect(menu).toBeVisible()
  await expect(menu).toHaveCSS('display', 'block')

  // 二级面板在菜单右侧展开
  const flyout = page.getByTestId('block-handle-flyout')
  await expect(flyout).toBeVisible()
  const geo = await page.evaluate(() => {
    const m = document.querySelector('[data-testid="block-handle-menu"]')!.getBoundingClientRect()
    const f = document.querySelector('[data-testid="block-handle-flyout"]')!.getBoundingClientRect()
    return { menuRight: m.right, flyoutLeft: f.left, flyoutItems: document.querySelectorAll('[data-testid="block-handle-flyout"] [data-flyout-action]').length }
  })
  expect(geo.flyoutLeft).toBeGreaterThanOrEqual(geo.menuRight - 4)
  expect(geo.flyoutItems).toBeGreaterThanOrEqual(10)
})

test('在二级面板选「任务」→ 在块下方插入任务行', async ({ page }) => {
  await openEditor(page)
  await openBlockMenu(page, '第一段')

  await page.locator('[data-flyout="insert-menu"]').first().hover()
  await settle(page)
  const flyout = page.getByTestId('block-handle-flyout')
  await expect(flyout).toBeVisible()

  // 行值就是 slash 命令 id（`task` 是任务行）
  const task = flyout.locator('[data-flyout-action="task"]').first()
  await expect(task).toBeVisible()
  await task.click()
  await settle(page)

  await expect(page.getByTestId('block-handle-menu')).toBeHidden()
  const doc = await rawDoc(page)
  expect(doc).toContain('- [ ] ')
  // 插在「第一段」之后
  const first = doc.indexOf('第一段')
  const taskAt = doc.indexOf('- [ ] ')
  expect(taskAt).toBeGreaterThan(first)
})
