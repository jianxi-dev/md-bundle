// 块手柄悬停即显 + 悬停开菜单 + 选中态 + 命中桥接（#325）的浏览器层回归锁。
// 运行：pnpm --filter @md-bundle/web exec playwright test test/block-handle-hover.spec.ts
import { expect, test, type Locator, type Page } from '@playwright/test'

const DOC = '# Alpha\n\n- one\n- two\n- three\n\nBeta paragraph.\n\nGamma paragraph.'

test.use({ viewport: { width: 1440, height: 900 } })

async function settle(page: Page): Promise<void> {
  // CM6 在 requestAnimationFrame 中完成 measure，冷启动首帧 coordsAtPos 只会给出估算坐标。
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
    name: 'block-handle-hover.md',
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

/** 把鼠标移到匹配文本的行内，触发沟槽手柄显示。 */
async function hoverLine(page: Page, text: string): Promise<void> {
  const line = page.locator('.cm-content .cm-line').filter({ hasText: text })
  await expect(line).toBeVisible()
  const box = await boxOf(line)
  await page.mouse.move(box.x + 20, box.y + box.height / 2)
  await settle(page)
}

/**
 * 把鼠标移到某一行的手柄列（与当前手柄同一条固定竖列），而不是行内文字。
 * 菜单展开时占据 x>=菜单左缘，落在行内文字上的落点会被菜单挡住，
 * 事件根本到不了内容块，测的就不是「从菜单移到另一个块」而是「停在菜单上」。
 */
async function hoverHandleColumn(page: Page, text: string): Promise<void> {
  const line = page.locator('.cm-content .cm-line').filter({ hasText: text })
  await expect(line).toBeVisible()
  const lineBox = await boxOf(line)
  const handleBox = await boxOf(page.getByTestId('block-handle'))
  await page.mouse.move(handleBox.x + handleBox.width / 2, lineBox.y + lineBox.height / 2)
  await settle(page)
}

async function centerOf(
  page: Page,
  locator: Locator,
): Promise<{ x: number; y: number }> {
  const box = await boxOf(locator)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

test('悬停行即显示手柄与选中态，离开后一并消失', async ({ page }) => {
  await openEditor(page)
  const handle = page.getByTestId('block-handle')
  await expect(handle).toBeHidden()

  await hoverLine(page, 'Beta paragraph.')
  await expect(handle).toBeVisible()
  await expect(
    page.locator('.cm-content .cm-line.cm-block-selected').filter({ hasText: 'Beta paragraph.' }),
  ).toHaveCount(1)

  await page.mouse.move(900, 60)
  await expect(handle).toBeHidden()
  await expect(page.locator('.cm-content .cm-line.cm-block-selected')).toHaveCount(0)
})

test('多行块的每一行都带选中态类', async ({ page }) => {
  await openEditor(page)
  await hoverLine(page, 'two')

  await expect(
    page.locator('.cm-content .cm-line.cm-block-selected').filter({ hasText: 'one' }),
  ).toHaveCount(1)
  await expect(
    page.locator('.cm-content .cm-line.cm-block-selected').filter({ hasText: 'two' }),
  ).toHaveCount(1)
  await expect(
    page.locator('.cm-content .cm-line.cm-block-selected').filter({ hasText: 'three' }),
  ).toHaveCount(1)
})

test('悬停手柄即打开菜单，无需点击', async ({ page }) => {
  await openEditor(page)
  await hoverLine(page, 'Beta paragraph.')

  const menu = page.getByTestId('block-handle-menu')
  await expect(menu).toBeHidden()

  const handleCenter = await centerOf(page, page.getByTestId('block-handle'))
  await page.mouse.move(handleCenter.x, handleCenter.y)
  await expect(menu).toBeVisible()
  await expect(menu).toContainText('转换为')
})

test('行 → 手柄 → 菜单跨沟槽移动全程可用且菜单不闪断', async ({ page }) => {
  await openEditor(page)
  await hoverLine(page, 'Beta paragraph.')
  const handleCenter = await centerOf(page, page.getByTestId('block-handle'))
  await page.mouse.move(handleCenter.x, handleCenter.y)

  const menu = page.getByTestId('block-handle-menu')
  await expect(menu).toBeVisible()

  // 手柄与菜单之间存在 8px 沟槽：经过间隙时菜单应保持可见（可变暗但不断开）。
  // 沟槽是 [手柄右缘, 手柄右缘 + 8)：不能拿 .cm-content 左缘当基准——.cm-content 自带
  // 32px 左内边距，其左缘落在手柄左侧约 20px 处，指针根本进不了沟槽判定分支。
  const handleBox = await boxOf(page.getByTestId('block-handle'))
  await page.mouse.move(handleBox.x + handleBox.width + 4, handleCenter.y)
  await expect(menu).toBeVisible()

  const menuCenter = await centerOf(page, menu)
  await page.mouse.move(menuCenter.x, menuCenter.y)
  await expect(menu).toBeVisible()
  await expect(page.getByTestId('block-handle')).toBeVisible()

  // 菜单仍可操作（而不是仅仅 DOM 存在）。
  await menu.getByRole('button', { name: '删除块' }).click()
  await expect(page.locator('.cm-content')).not.toContainText('Beta paragraph.')
  await expect(menu).toBeHidden()
})

test('经过间隙时手柄变暗，进入菜单后恢复', async ({ page }) => {
  await openEditor(page)
  await hoverLine(page, 'Beta paragraph.')
  const handle = page.getByTestId('block-handle')
  const handleCenter = await centerOf(page, handle)
  await page.mouse.move(handleCenter.x, handleCenter.y)

  const menu = page.getByTestId('block-handle-menu')
  await expect(menu).toBeVisible()
  await expect(handle).not.toHaveClass(/mdb-block-handle-dimmed/)

  const handleBox = await boxOf(handle)
  await page.mouse.move(handleBox.x + handleBox.width + 4, handleCenter.y)
  await expect(handle).toHaveClass(/mdb-block-handle-dimmed/)
  await expect(menu).toBeVisible()

  const menuCenter = await centerOf(page, menu)
  await page.mouse.move(menuCenter.x, menuCenter.y)
  await expect(handle).not.toHaveClass(/mdb-block-handle-dimmed/)
})

test('菜单已开时移到另一个块的手柄会改指向该块', async ({ page }) => {
  await openEditor(page)
  await hoverLine(page, 'Beta paragraph.')
  let handleCenter = await centerOf(page, page.getByTestId('block-handle'))
  await page.mouse.move(handleCenter.x, handleCenter.y)
  await expect(page.getByTestId('block-handle-menu')).toBeVisible()

  await hoverHandleColumn(page, 'Gamma paragraph.')
  const selected = page.locator('.cm-content .cm-line.cm-block-selected')
  await expect(selected.filter({ hasText: 'Gamma paragraph.' })).toHaveCount(1)
  await expect(selected.filter({ hasText: 'Beta paragraph.' })).toHaveCount(0)

  handleCenter = await centerOf(page, page.getByTestId('block-handle'))
  await page.mouse.move(handleCenter.x, handleCenter.y)
  await expect(page.getByTestId('block-handle-menu')).toBeVisible()

  await page.getByTestId('block-handle-menu').getByRole('button', { name: '删除块' }).click()
  await expect(page.locator('.cm-content')).not.toContainText('Gamma paragraph.')
  await expect(page.locator('.cm-content')).toContainText('Beta paragraph.')
})

test('Escape 关闭菜单并清掉选中态', async ({ page }) => {
  await openEditor(page)
  await hoverLine(page, 'Beta paragraph.')
  const handleCenter = await centerOf(page, page.getByTestId('block-handle'))
  await page.mouse.move(handleCenter.x, handleCenter.y)

  await expect(page.getByTestId('block-handle-menu')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('block-handle-menu')).toBeHidden()
  await expect(page.locator('.cm-content .cm-line.cm-block-selected')).toHaveCount(0)
})

test('菜单动作用完后清掉选中态', async ({ page }) => {
  await openEditor(page)
  await hoverLine(page, 'Beta paragraph.')
  const handleCenter = await centerOf(page, page.getByTestId('block-handle'))
  await page.mouse.move(handleCenter.x, handleCenter.y)

  const menu = page.getByTestId('block-handle-menu')
  await expect(menu).toBeVisible()
  await menu.getByRole('button', { name: '复制块' }).click()

  await expect(page.locator('.cm-content')).toContainText('Beta paragraph.', { useInnerText: true })
  const selected = page.locator('.cm-content .cm-line.cm-block-selected')
  await expect(selected).toHaveCount(0)
  await expect(menu).toBeHidden()
})