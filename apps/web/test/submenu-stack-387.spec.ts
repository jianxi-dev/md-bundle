// #387 二级菜单栈语义回归锁：同一时刻只有一层菜单；切换/悬停无二级行即收起旧层；
// 菜单不被编辑面板裁切；指针可从触发器移入菜单而不掉栈。
//
// 用法（真实指针链，无内部函数调用）：
//   pnpm --filter @md-bundle/web exec playwright test test/submenu-stack-387.spec.ts
import { expect, test, type Locator, type Page } from '@playwright/test'

test.use({ viewport: { width: 1440, height: 900 } })

const SLASH_DOC = '# Title\n\n'

const CALLOUT_DOC = 'Plain paragraph.\n\n> [!NOTE]\n> callout body\n\n# Heading'

const TWO_BLOCK_DOC = '# Title\n\nBody paragraph.'

/** CM6 measure 在两帧 rAF 内完成；冷启动首帧 coordsAtPos 只给估算坐标。 */
async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page, name: string, doc: string): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name,
    mimeType: 'text/markdown',
    buffer: Buffer.from(doc),
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

/** 悬停某文本行以唤起沟槽手柄。 */
async function hoverLine(page: Page, text: string): Promise<void> {
  const line = page.locator('.cm-content .cm-line').filter({ hasText: text }).first()
  await expect(line).toBeVisible()
  const box = await boxOf(line)
  await page.mouse.move(box.x + 24, box.y + box.height / 2)
  await settle(page)
}

/** 悬停行 → 悬停手柄 → 块菜单打开。 */
async function openBlockMenu(page: Page, text: string): Promise<void> {
  await hoverLine(page, text)
  const handle = page.getByTestId('block-handle')
  await expect(handle).toBeVisible()
  const hb = await boxOf(handle)
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2)
  await expect(page.getByTestId('block-handle-menu')).toBeVisible()
  await settle(page)
}

/** 真实指针悬停一个元素中心。 */
async function hoverCenter(page: Page, locator: Locator): Promise<void> {
  await expect(locator).toBeVisible()
  const box = await boxOf(locator)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await settle(page)
}

/** 在文档末尾输入 `/` 打开根菜单。 */
async function typeSlashAtDocEnd(page: Page): Promise<void> {
  await page.locator('.cm-content').click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+End' : 'Control+End')
  await settle(page)
  await page.keyboard.type('/')
  await expect(page.locator('.mdb-slash-menu')).toBeVisible()
}

function rootRow(page: Page, text: string): Locator {
  return page.locator('.mdb-slash-grid-menu .mdb-slash-item').filter({ hasText: text }).first()
}

// ---------------------------------------------------------------------------
// DEF1: 一级行有二级面板；悬停「无二级」行 → 旧面板收起（根列表保留）。
// ---------------------------------------------------------------------------
test('DEF1 网格展开后悬停无二级行 → 二级面板收起、根列表保留', async ({ page }) => {
  await openEditor(page, 'submenu-387-def1.md', SLASH_DOC)
  await typeSlashAtDocEnd(page)

  await hoverCenter(page, rootRow(page, '表格'))
  await expect(page.locator('.mdb-slash-flyout')).toBeVisible()
  await expect(page.locator('.mdb-slash-grid-cell')).toHaveCount(100)

  // 「分割线」既无 children 也无 grid：不得让表格网格残留。
  await hoverCenter(page, rootRow(page, '分割线'))

  await expect(page.locator('.mdb-slash-flyout')).toHaveCount(0)
  await expect(page.locator('.mdb-slash-grid-menu')).toHaveCount(1)
  await expect(rootRow(page, '分割线')).toBeVisible()
})

// ---------------------------------------------------------------------------
// DEF2: 网格打开后悬停另一二级行 → 该行 flyout 取代网格。
// ---------------------------------------------------------------------------
test('DEF2 网格打开后悬停另一二级行 → 该行 flyout 取代网格', async ({ page }) => {
  await openEditor(page, 'submenu-387-def2.md', SLASH_DOC)
  await typeSlashAtDocEnd(page)

  await hoverCenter(page, rootRow(page, '表格'))
  await expect(page.locator('.mdb-slash-grid-cell')).toHaveCount(100)

  await hoverCenter(page, rootRow(page, '标题'))

  const flyout = page.locator('.mdb-slash-flyout')
  await expect(flyout).toBeVisible()
  await expect(page.locator('.mdb-slash-grid-cell')).toHaveCount(0)
  await expect(flyout.locator('.mdb-slash-flyout-item')).toHaveCount(6)
  await expect(flyout.locator('.mdb-slash-flyout-item').first()).toContainText('1 级标题')
})

// ---------------------------------------------------------------------------
// DEF3: 块菜单 flyout；从「类型」移到普通动作行 → flyout 收起且无残留。
// ---------------------------------------------------------------------------
test('DEF3 块菜单 flyout：从类型行移到普通动作行 → flyout 收起', async ({ page }) => {
  await openEditor(page, 'submenu-387-def3.md', CALLOUT_DOC)
  await openBlockMenu(page, 'callout body')

  const typeRow = page.locator('.mdb-block-handle-menu [data-flyout="callout-type"]')
  await hoverCenter(page, typeRow)
  const panel = page.getByTestId('block-handle-flyout')
  await expect(panel).toBeVisible()
  await expect(panel).toHaveAttribute('data-flyout', 'callout-type')

  // 「复制」动作行没有二级入口：不得让「类型」面板残留。
  await hoverCenter(page, page.locator('.mdb-block-handle-menu [data-action="duplicate"]'))

  await expect(page.locator('.mdb-block-handle-flyout')).toHaveCount(0)
  await expect(page.getByTestId('block-handle-menu')).toBeVisible()
})

// ---------------------------------------------------------------------------
// DEF4: 悬停「在下方添加」→ 插入菜单打开且块菜单收起（同一时刻只有一个菜单可见）。
// ---------------------------------------------------------------------------
test('DEF4 在下方添加：插入菜单打开且块菜单收起（仅一个菜单可见）', async ({ page }) => {
  await openEditor(page, 'submenu-387-def4.md', TWO_BLOCK_DOC)
  await openBlockMenu(page, 'Body paragraph.')

  await hoverCenter(page, page.locator('.mdb-block-handle-menu [data-flyout="insert-menu"]'))

  await expect(page.locator('.mdb-slash-menu')).toBeVisible()
  await expect(page.locator('.mdb-slash-group').first()).toBeVisible()
  await expect(page.getByTestId('block-handle-menu')).toBeHidden()
  await expect(page.locator('.mdb-block-handle-menu:visible, .mdb-slash-menu:visible')).toHaveCount(1)
})

// ---------------------------------------------------------------------------
// DEF5: 靠右打开的菜单落在编辑面板内，不被面板 overflow 裁切。
// ---------------------------------------------------------------------------
test('DEF5 靠右菜单不被编辑面板裁切（menu.right ≤ pane.right）', async ({ page }) => {
  // 宽视口 + 展开左栏：编辑面板收缩且编辑器填满面板（右缘 == 面板右缘），
  // 靠光标右缘打开的菜单会越过面板右缘被 overflow:hidden 截断。
  await page.setViewportSize({ width: 1920, height: 900 })
  const filler = Array.from({ length: 40 }, (_, i) => `word${i}`).join(' ')
  await openEditor(page, 'submenu-387-def5.md', `${filler}\n\n`)
  await page.getByTestId('left-rail-toggle').click()
  await settle(page)
  await settle(page)

  // 在首行靠右处落光标，再输入空格 + `/` 在该处打开菜单。
  const content = await boxOf(page.locator('.cm-content').first())
  await page.mouse.click(content.x + content.width - 150, content.y + 12)
  await settle(page)
  await page.keyboard.type(' ')
  await page.keyboard.type('/')
  await expect(page.locator('.mdb-slash-menu')).toBeVisible()

  const menu = await boxOf(page.locator('.mdb-slash-menu'))
  const pane = await boxOf(page.getByTestId('workspace-modes'))
  expect(menu.x + menu.width).toBeLessThanOrEqual(pane.x + pane.width + 0.5)
  // 菜单确实贴在面板右缘（而不是退化成自由定位）。
  expect(menu.x + menu.width).toBeGreaterThan(pane.x + pane.width - 260)
})

// ---------------------------------------------------------------------------
// DEF6: 菜单翻转到锚点上方时，指针从手柄移入菜单不掉栈。
// ---------------------------------------------------------------------------
test('DEF6 菜单翻转到上方后：指针从手柄移入菜单不消失', async ({ page }) => {
  const filler = Array.from({ length: 40 }, (_, i) => `Filler paragraph ${i + 1}.`).join('\n\n')
  await openEditor(page, 'submenu-387-def6.md', `# Title\n\n${filler}`)

  // 滚到底部：最后可见块贴底 → 菜单翻到锚点上方并留出竖直间隙。
  await page.locator('.cm-scroller').first().evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })
  await settle(page)

  const lastLine = page.locator('.cm-content .cm-line').last()
  await hoverLine(page, (await lastLine.innerText()).trim())
  const handle = page.getByTestId('block-handle')
  await expect(handle).toBeVisible()
  const hb = await boxOf(handle)
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2)

  const menu = page.getByTestId('block-handle-menu')
  await expect(menu).toBeVisible()
  await settle(page)
  const mb = await boxOf(menu)
  // 前置条件：菜单确实翻到了手柄上方（否则本用例不成立）。
  expect(mb.y + mb.height).toBeLessThanOrEqual(hb.y + 2)

  // 穿越手柄与上方菜单之间那条不被横向沟槽覆盖的竖直间隙。
  const gapX = mb.x + 20
  const gapY = (hb.y + mb.y + mb.height) / 2
  await page.mouse.move(gapX, gapY)
  await expect(menu).toBeVisible()

  // 继续移入菜单本体。
  await page.mouse.move(mb.x + mb.width / 2, mb.y + mb.height / 2)
  await expect(menu).toBeVisible()
  await expect(menu).toHaveCSS('display', 'block')
})
