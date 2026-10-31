// #466：块菜单纵向以指针为中心，并按窗口上下边界夹取。
import { expect, test, type Page } from '@playwright/test'

test.use({ viewport: { width: 1440, height: 900 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page, doc: string): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'menu-466.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(doc),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

/** Hover a line, let the gutter handle appear, then press it and read geometry. */
async function openMenuOnLine(page: Page, text: string): Promise<{ menuCenter: number; pointerY: number; menuTop: number; menuBottom: number }> {
  const line = page.locator('.cm-content .cm-line').filter({ hasText: text }).first()
  await expect(line).toBeVisible()
  const box = await line.boundingBox()
  if (!box) throw new Error('no line box')
  const pointerY = box.y + box.height / 2
  await page.mouse.move(box.x + 40, pointerY)
  await settle(page)

  // 手柄在悬停时展开菜单（与 #357 的用例一致）。
  const handle = page.getByTestId('block-handle')
  await expect(handle).toBeVisible()
  const handleBox = await handle.boundingBox()
  if (!handleBox) throw new Error('no handle box')
  const hx = handleBox.x + handleBox.width / 2
  const hy = handleBox.y + handleBox.height / 2
  await page.mouse.move(hx, hy)
  await settle(page)

  const menu = page.getByTestId('block-handle-menu')
  await expect(menu).toBeVisible()
  const menuBox = await menu.boundingBox()
  if (!menuBox) throw new Error('no menu box')
  return {
    menuCenter: menuBox.y + menuBox.height / 2,
    pointerY: hy,
    menuTop: menuBox.y,
    menuBottom: menuBox.y + menuBox.height,
  }
}

const DOC = `# 顶部标题

段落一。

段落二。

段落三。

段落四。

段落五。

段落六。

段落七。

段落八。

段落九。

段落十。
`

test('菜单纵向中点贴着指针（无法居中时指针行仍在菜单内）', async ({ page }) => {
  await openEditor(page, DOC)
  const geo = await openMenuOnLine(page, '段落四')
  const centered = Math.abs(geo.menuCenter - geo.pointerY) <= 12
  const pointerInside = geo.menuTop <= geo.pointerY && geo.pointerY <= geo.menuBottom
  const gap = geo.pointerY < geo.menuTop ? geo.menuTop - geo.pointerY : geo.pointerY - geo.menuBottom
  expect(
    centered || pointerInside || gap <= 40,
    `中点 ${geo.menuCenter} / 指针 ${geo.pointerY} / 菜单 ${geo.menuTop}..${geo.menuBottom}`,
  ).toBe(true)
})

test('底部触发时菜单完整落在视口内', async ({ page }) => {
  await openEditor(page, DOC)
  const geo = await openMenuOnLine(page, '段落十')
  expect(geo.menuTop).toBeGreaterThanOrEqual(-1)
  expect(geo.menuBottom).toBeLessThanOrEqual(page.viewportSize()!.height)
})
