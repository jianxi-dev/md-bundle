// #363（change editor-fidelity-2 / 2.8）：块手柄交互编排保真 e2e。
// 覆盖 conformance R-CHOREO-01..04：
//   R-CHOREO-01 指针移出「手柄+菜单+flyout」合并栈 → 菜单与 flyout 均消失
//   R-CHOREO-02 近底部块菜单完整落在视口内（menu.bottom ≤ innerHeight）
//   R-CHOREO-03 scroll 事件 → 手柄/菜单 display:none
//   R-CHOREO-04 悬停文本不弹菜单；悬停手柄展开缓冲过后弹菜单
// 运行：pnpm --filter @md-bundle/web exec playwright test test/menu-choreography-fidelity2.spec.ts
import { expect, test, type Locator, type Page } from '@playwright/test'
import * as path from 'path'

// Playwright cwd = apps/web；证据落仓库根 .artifacts/363/（QG-5 机检约定）。
const ARTIFACTS_DIR = path.resolve(process.cwd(), '..', '..', '.artifacts', '363')

const DOC = `# Title

Body paragraph.

Another body.`

// 可滚动文档：滚动消退需要真实 scroll 事件。
const LONG_DOC = `# Title

Body paragraph.

${Array.from({ length: 60 }, (_, i) => `Filler ${i + 1}.`).join('\n\n')}`

test.use({ viewport: { width: 1440, height: 900 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
}

async function openEditor(page: Page, fileName: string, source: string): Promise<void> {
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

/** Hover a line then the handle; the 120ms hover-intent delay is covered by auto-wait. */
async function openMenuOn(page: Page, text: string): Promise<void> {
  await hoverLine(page, text)
  const handle = page.getByTestId('block-handle')
  await expect(handle).toBeVisible()
  const hb = await boxOf(handle)
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2)
  await expect(page.getByTestId('block-handle-menu')).toBeVisible()
}

async function screenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, name) })
}

// --- R-CHOREO-01 离栈即收 ------------------------------------------------------
test('R-CHOREO-01 指针移出「手柄+菜单+flyout」合并栈 → 菜单与 flyout 均消失', async ({ page }) => {
  await openEditor(page, 'choreo-leave-stack.md', DOC)
  await openMenuOn(page, 'Body paragraph.')

  // 展开一个二级 flyout，确认它也在合并栈内、可被鼠标到达。
  const indentRow = page.locator('.mdb-block-handle-menu [data-flyout="indent-align"]')
  const rb = await boxOf(indentRow)
  await page.mouse.move(rb.x + rb.width / 2, rb.y + rb.height / 2)
  await expect(page.getByTestId('block-handle-flyout')).toBeVisible()

  // 移到菜单上方的标题行：该点不在菜单栈内（菜单覆盖块本身的文本区，
  // 所以不能拿块内文字当离栈点），指针一离开合并栈即收。
  const titleLine = page.locator('.cm-content .cm-line').filter({ hasText: 'Title' }).first()
  const tb = await boxOf(titleLine)
  await page.mouse.move(tb.x + 40, tb.y + tb.height / 2)
  await settle(page)

  await expect(page.getByTestId('block-handle-menu')).toHaveCSS('display', 'none')
  await expect(page.locator('.mdb-block-handle-flyout')).toHaveCount(0)
  await expect(page.getByTestId('block-handle')).toHaveCSS('display', 'none')
  await screenshot(page, 'state1-leave-stack.png')
})

// --- R-CHOREO-01b 插入面板同属合并栈 -------------------------------------------
test('R-CHOREO-01b 在下方添加› 插入面板同属合并栈：移入面板不掉栈，离全栈才全收', async ({ page }) => {
  await openEditor(page, 'choreo-insert-stack.md', DOC)
  await openMenuOn(page, 'Body paragraph.')

  const handle = page.getByTestId('block-handle')
  const menu = page.getByTestId('block-handle-menu')

  // 悬停「在下方添加›」打开插入面板（.mdb-slash-menu 挂在 view.dom，而非 chrome.menu）。
  const addRow = menu.locator('.mdb-block-handle-item', { hasText: '在下方添加' })
  const rb = await boxOf(addRow)
  await page.mouse.move(rb.x + rb.width / 2, rb.y + rb.height / 2)
  const slashMenu = page.locator('.mdb-slash-menu')
  await expect(slashMenu).toBeVisible()

  // 把指针移到插入面板上：面板取代块菜单（#387 同一时刻仅一层菜单），手柄保留
  // （仍是同一合并栈），面板不因移入而关闭。
  const sb = await boxOf(slashMenu)
  await page.mouse.move(sb.x + sb.width / 2, sb.y + 20)
  await settle(page)
  await expect(slashMenu).toBeVisible()
  await expect(menu).toHaveCSS('display', 'none')
  await expect(handle).toHaveCSS('display', 'flex')

  // 移出整个栈（块手柄 + 菜单 + 插入面板）：块 chrome 与插入面板一并消失。
  const titleLine = page.locator('.cm-content .cm-line').filter({ hasText: 'Title' }).first()
  const tb = await boxOf(titleLine)
  await page.mouse.move(tb.x + 40, tb.y + tb.height / 2)
  await settle(page)
  await expect(menu).toHaveCSS('display', 'none')
  await expect(handle).toHaveCSS('display', 'none')
  await expect(slashMenu).toHaveCount(0)
  await screenshot(page, 'state5-insert-stack.png')
})

// --- R-CHOREO-02 视口夹取/翻转 -------------------------------------------------
test('R-CHOREO-02 近底部块菜单完整落在视口内（menu.bottom ≤ innerHeight）', async ({ page }) => {
  // 矮视口保证默认「菜单顶=块顶」会从底部溢出，从而真正走到翻转/夹取分支。
  await page.setViewportSize({ width: 1440, height: 600 })
  await openEditor(page, 'choreo-clamp.md', DOC)
  await openMenuOn(page, 'Another body.')

  const menu = page.getByTestId('block-handle-menu')
  await expect(menu).toBeVisible()

  const rect = await boxOf(menu)
  const innerHeight = await page.evaluate(() => window.innerHeight)
  expect(rect.y + rect.height).toBeLessThanOrEqual(innerHeight)
  expect(rect.y).toBeGreaterThanOrEqual(0)
  await expect(menu).toBeInViewport()
  await screenshot(page, 'state2-clamp-bottom.png')
})

// --- R-CHOREO-03 滚动消退 ------------------------------------------------------
test('R-CHOREO-03 scroll 事件 → 手柄/菜单 display:none', async ({ page }) => {
  await openEditor(page, 'choreo-scroll.md', LONG_DOC)
  await openMenuOn(page, 'Body paragraph.')

  const handle = page.getByTestId('block-handle')
  const menu = page.getByTestId('block-handle-menu')
  await expect(handle).toHaveCSS('display', 'flex')
  await expect(menu).toHaveCSS('display', 'block')

  // 直接滚 `.cm-scroller`（CM6 的 scrollDOM），保证触发真实 scroll 事件。
  await page.locator('.cm-scroller').first().evaluate((el) => {
    el.scrollTop = 300
  })
  await settle(page)

  await expect(handle).toHaveCSS('display', 'none')
  await expect(menu).toHaveCSS('display', 'none')
  await screenshot(page, 'state3-scroll-dismiss.png')
})

// --- R-CHOREO-04 展开缓冲 ------------------------------------------------------
test('R-CHOREO-04 悬停文本不弹菜单；悬停手柄延迟后弹菜单', async ({ page }) => {
  await openEditor(page, 'choreo-hover-intent.md', DOC)
  const handle = page.getByTestId('block-handle')
  const menu = page.getByTestId('block-handle-menu')

  // A-34.1：悬停文本 500ms，手柄出现但菜单始终不弹。
  await hoverLine(page, 'Body paragraph.')
  await expect(handle).toBeVisible()
  await page.waitForTimeout(500)
  await expect(menu).toHaveCSS('display', 'none')

  // A-34.2：悬停手柄，展开缓冲过后菜单打开（auto-wait 覆盖 120ms 延迟）。
  const hb = await boxOf(handle)
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2)
  await expect(menu).toHaveCSS('display', 'block')
  await expect(menu).toContainText('转换为')
  await screenshot(page, 'state4-hover-intent.png')
})
