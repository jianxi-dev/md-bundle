// #456 回归锁：块菜单里的「在下方添加›」向右展开二级面板，父菜单保留。
//
// 旧行为：hover 直接把父菜单换成插入菜单，与「类型 / 缩进和对齐」的下钻语法不一致。
//
// 运行：pnpm --filter @md-bundle/web exec playwright test test/add-below-flyout-456.spec.ts
import { expect, test, type Page } from '@playwright/test'

const DOC = `# 标题

正文段落。

结尾段落。
`

test.use({ viewport: { width: 1440, height: 1000 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openMenu(page: Page) {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'add-below-456.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)

  const line = page.locator('.cm-content .cm-line').filter({ hasText: '正文段落' }).first()
  const box = await line.boundingBox()
  if (!box) throw new Error('no line box')
  await page.mouse.move(box.x + 10, box.y + box.height / 2)
  await settle(page)
  await page.locator('.mdb-block-handle').click()
  await settle(page)
  return page.getByTestId('block-handle-menu')
}

test('hover「在下方添加」：父菜单保留，插入面板在右侧展开', async ({ page }) => {
  const menu = await openMenu(page)
  const row = menu.getByRole('button', { name: '在下方添加' })
  const menuBox = await menu.boundingBox()
  await row.hover()
  await settle(page)
  await settle(page)

  // 父菜单仍在
  await expect(menu).toBeVisible()
  const panel = page.locator('.mdb-slash-menu')
  await expect(panel).toBeVisible()

  const panelBox = await panel.boundingBox()
  if (!menuBox || !panelBox) throw new Error('missing boxes')
  expect(panelBox.x, '二级面板应在父菜单右侧').toBeGreaterThanOrEqual(menuBox.x + menuBox.width - 8)
})

test('二级面板里选一项可完成插入，且父菜单不再残留', async ({ page }) => {
  const menu = await openMenu(page)
  await menu.getByRole('button', { name: '在下方添加' }).hover()
  await settle(page)
  await settle(page)

  const panel = page.locator('.mdb-slash-menu')
  await expect(panel).toBeVisible()
  await panel.locator('.mdb-slash-item').filter({ hasText: '分割线' }).first().click()
  await settle(page)

  await expect(page.locator('.mdb-slash-menu')).toHaveCount(0)
  await expect(menu).toBeHidden()
})
