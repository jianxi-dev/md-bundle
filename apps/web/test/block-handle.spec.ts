// 块手柄（#189）e2e：悬停左侧沟槽出现 ⠿ 手柄、手柄与所属块对齐（缺陷 1 的浏览器层回归锁）、
// 点击开菜单、指针移到菜单保持开启、Escape 关闭、删除块生效。
// 运行：pnpm --filter @md-bundle/web exec playwright test test/block-handle.spec.ts
import { expect, test, type Locator, type Page } from '@playwright/test'

// 三块文档：标题 + 两个段落，便于悬停定向与删除断言。
const DOC = '# Alpha\n\nBeta paragraph.\n\nGamma paragraph.'

test.use({ viewport: { width: 1440, height: 900 } })

async function settle(page: Page): Promise<void> {
  // CM6 在 requestAnimationFrame 中完成 measure；冷启动时首帧尚未测量，
  // coordsAtPos 会返回估算坐标，导致手柄被放到错误位置。
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
}

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'block-handle.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
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

/** 把鼠标移到目标段落行内，触发沟槽手柄显示。 */
async function hoverParagraph(
  page: Page,
  text: string,
): Promise<{ x: number; y: number; height: number }> {
  const line = page.locator('.cm-content .cm-line').filter({ hasText: text })
  await expect(line).toBeVisible()
  const box = await boxOf(line)
  await page.mouse.move(box.x + 20, box.y + box.height / 2)
  return box
}

test('悬停段落后手柄出现，且贴合块的左缘与行垂直中心', async ({ page }) => {
  await openEditor(page)
  const lineBox = await hoverParagraph(page, 'Beta paragraph.')

  const handle = page.getByTestId('block-handle')
  await expect(handle).toBeVisible()
  const handleBox = await boxOf(handle)

  // 坐标系回归锁：手柄左缘应贴着块的左缘（约 -26px 沟槽偏移），
  // 顶部应贴着行，而不是被 viewport 原点甩到编辑器右下方。
  expect(Math.abs(handleBox.x - lineBox.x)).toBeLessThanOrEqual(40)
  const handleCenterY = handleBox.y + handleBox.height / 2
  const lineCenterY = lineBox.y + lineBox.height / 2
  expect(Math.abs(handleCenterY - lineCenterY)).toBeLessThanOrEqual(40)
})

test('点击手柄打开菜单，指针移到菜单保持开启，Escape 关闭', async ({ page }) => {
  await openEditor(page)
  await hoverParagraph(page, 'Beta paragraph.')

  const handle = page.getByTestId('block-handle')
  await expect(handle).toBeVisible()
  await handle.click()

  const menu = page.getByTestId('block-handle-menu')
  await expect(menu).toBeVisible()
  await expect(menu).toContainText('转换为')

  const menuBox = await boxOf(menu)
  await page.mouse.move(menuBox.x + menuBox.width / 2, menuBox.y + menuBox.height / 2)
  await expect(menu).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
})

test('菜单「删除块」删除目标段落', async ({ page }) => {
  await openEditor(page)
  await hoverParagraph(page, 'Beta paragraph.')

  const handle = page.getByTestId('block-handle')
  await expect(handle).toBeVisible()
  await handle.click()

  const menu = page.getByTestId('block-handle-menu')
  await expect(menu).toBeVisible()
  await menu.getByRole('button', { name: '删除块' }).click()

  const content = page.locator('.cm-content')
  await expect(content).not.toContainText('Beta paragraph.')
  await expect(content).toContainText('Gamma paragraph.')
  await expect(content).toContainText('Alpha')
  await expect(menu).toBeHidden()
})
