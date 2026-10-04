// 块菜单上下文分型 + 二级 flyout（#330）e2e：转为图标网格、缩进和对齐/颜色/类型二级面板、
// 悬停切换无残留、移出即关闭。
// 运行：pnpm --filter @md-bundle/web exec playwright test test/block-menu-flyout.spec.ts
import { expect, test, type Locator, type Page } from '@playwright/test'

const DOC = `Plain paragraph target.

> [!NOTE]
> callout body text

# Heading block`

test.use({ viewport: { width: 1440, height: 900 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'block-menu-flyout.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

async function boxOf(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox()
  if (!box) throw new Error('element has no bounding box')
  return box
}

/** Hover a block line, then the handle (which auto-opens the menu since #325). */
async function openMenuOn(page: Page, text: string): Promise<void> {
  const line = page.locator('.cm-content .cm-line').filter({ hasText: text }).first()
  await expect(line).toBeVisible()
  const lb = await boxOf(line)
  await page.mouse.move(lb.x + 20, lb.y + lb.height / 2)
  await settle(page)
  const handle = page.getByTestId('block-handle')
  await expect(handle).toBeVisible()
  const hb = await boxOf(handle)
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2)
  await settle(page)
  await expect(page.getByTestId('block-handle-menu')).toBeVisible()
}

function flyoutRow(page: Page, key: string): Locator {
  return page.locator(`.mdb-block-handle-menu [data-flyout="${key}"]`)
}

async function hoverFlyoutRow(page: Page, key: string): Promise<void> {
  const row = flyoutRow(page, key)
  await expect(row).toBeVisible()
  const rb = await boxOf(row)
  await page.mouse.move(rb.x + rb.width / 2, rb.y + rb.height / 2)
  await settle(page)
}

test('段落菜单含「转为」图标网格与 `缩进和对齐`/`颜色` 项', async ({ page }) => {
  await openEditor(page)
  await openMenuOn(page, 'Plain paragraph target.')

  const grid = page.getByTestId('block-handle-convert-grid')
  await expect(grid).toBeVisible()
  await expect(grid.locator('.mdb-block-handle-grid-item')).toHaveCount(7)

  await expect(flyoutRow(page, 'indent-align')).toContainText('缩进和对齐')
  await expect(flyoutRow(page, 'color')).toContainText('颜色')
})

test('悬停 `缩进和对齐` 展开的二级选项文本严格相等', async ({ page }) => {
  await openEditor(page)
  await openMenuOn(page, 'Plain paragraph target.')
  await hoverFlyoutRow(page, 'indent-align')

  const panel = page.getByTestId('block-handle-flyout')
  await expect(panel).toBeVisible()
  const texts = await panel.locator('.mdb-block-handle-flyout-item').allTextContents()
  expect(texts).toEqual(['左对齐', '居中', '右对齐', '增加缩进', '减少缩进'])
})

test('在二级项间切换无残留旧面板', async ({ page }) => {
  await openEditor(page)
  await openMenuOn(page, 'Plain paragraph target.')

  await hoverFlyoutRow(page, 'color')
  await expect(page.getByTestId('block-handle-flyout')).toHaveAttribute('data-flyout', 'color')

  await hoverFlyoutRow(page, 'indent-align')
  await expect(page.locator('.mdb-block-handle-menu .mdb-block-handle-flyout')).toHaveCount(1)
  await expect(page.getByTestId('block-handle-flyout')).toHaveAttribute('data-flyout', 'indent-align')
  const texts = await page.locator('.mdb-block-handle-flyout-item').allTextContents()
  expect(texts).toEqual(['左对齐', '居中', '右对齐', '增加缩进', '减少缩进'])
})

test('移出后 flyout 关闭且无残留节点', async ({ page }) => {
  await openEditor(page)
  await openMenuOn(page, 'Plain paragraph target.')
  await hoverFlyoutRow(page, 'indent-align')
  await expect(page.getByTestId('block-handle-flyout')).toBeVisible()

  await page.mouse.move(1300, 500)
  await settle(page)
  await expect(page.locator('.mdb-block-handle-flyout')).toHaveCount(0)
})

test('高亮块菜单含 `类型` 二级入口并可切换类型（旧样式无残留）', async ({ page }) => {
  await openEditor(page)
  await openMenuOn(page, 'callout body text')

  const typeRow = flyoutRow(page, 'callout-type')
  await expect(typeRow).toBeVisible()
  await expect(typeRow).toContainText('类型')

  // #333：类型二级同时承载 emoji（每型一个图标），即 W7 的「emoji 二级」。
  await hoverFlyoutRow(page, 'callout-type')
  const panel = page.getByTestId('block-handle-flyout')
  await expect(panel).toBeVisible()
  await expect(panel).toContainText('注释')
  await expect(panel.locator('.mdb-block-handle-flyout-icon').first()).toBeVisible()

  // #333：切换类型后旧 tone 类无残留（widget 重建，而非类名叠加）。
  await panel.locator('[data-flyout-action="callout-tip"]').click()
  await settle(page)
  const card = page.locator('.cm-callout').first()
  await expect(card).toHaveClass(/cm-callout-tone-green/)
  await expect(card).not.toHaveClass(/cm-callout-tone-blue/)
})
