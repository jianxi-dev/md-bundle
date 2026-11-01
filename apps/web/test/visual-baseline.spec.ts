// 关键界面视觉基线（#500）。
//
// 这两周的显示类缺陷全部是「DOM 断言绿、肉眼不对」，所以把稳定下来的界面拍成像素基线：
// 任何一次改动若改变这些像素，diff 会要求人工确认。
//
// 默认不跑（避免 macOS/Linux 字体差异给 CI 引入假红）：
//   VISUAL=1 pnpm --filter @md-bundle/web exec playwright test test/visual-baseline.spec.ts
// 有意改样式后重建基线：
//   VISUAL=1 ... --update-snapshots
import { expect, test, type Page } from '@playwright/test'

const ENABLED = process.env.VISUAL === '1'
test.skip(!ENABLED, '视觉基线仅在 VISUAL=1 时运行')

// 固定视口 + 固定主题，避免环境差异放大 diff
test.use({ viewport: { width: 1280, height: 860 }, colorScheme: 'light' })

const DOC = `# 标题一

正文段落，用于选中后检查工具栏。

| A | B |
| --- | --- |
| 1 | 2 |
| 3 | 4 |

> [!NOTE]
> 高亮块正文。

::: {.col-2}
左栏

右栏
:::

尾。
`

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
  await page.waitForTimeout(150)
}

async function open(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'visual.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

async function hoverLine(page: Page, text: string): Promise<void> {
  const line = page.locator('.cm-content .cm-line').filter({ hasText: text }).first()
  const box = (await line.boundingBox())!
  await page.mouse.move(box.x + 30, box.y + box.height / 2)
  await settle(page)
}

async function hoverHandle(page: Page): Promise<void> {
  const handle = page.getByTestId('block-handle')
  const hb = (await handle.boundingBox())!
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2)
  await settle(page)
}

test('01 表格静止态（圆点为空心小圆）', async ({ page }) => {
  await open(page)
  await page.mouse.move(20, 20)
  await settle(page)
  // 裁到表格左上角：圆点这种小元素在全表截图里只占几百像素，全局阈值会漏掉它
  const box = (await page.getByTestId('cm-table').boundingBox())!
  await expect(page).toHaveScreenshot('01-table-rest.png', {
    clip: { x: box.x - 12, y: box.y - 24, width: 280, height: 150 },
  })
})

test('02 表格锚点 hover（圆点变 +）', async ({ page }) => {
  await open(page)
  await page.locator('.cm-table-anchor').hover()
  await page.waitForTimeout(400)
  const box = (await page.getByTestId('cm-table').boundingBox())!
  await expect(page).toHaveScreenshot('02-table-anchor-hover.png', {
    clip: { x: box.x - 12, y: box.y - 24, width: 280, height: 150 },
  })
})

test('03 单元格插入面板（贴手柄 + 分组）', async ({ page }) => {
  await open(page)
  const cell = page.getByTestId('cm-table').locator('td[data-row="1"][data-col="0"]')
  await cell.hover()
  await settle(page)
  await cell.locator('.cm-table-cell-handle').click()
  await expect(page.getByTestId('slash-menu')).toBeVisible()
  await settle(page)
  await expect(page.locator('.mdb-slash-menu')).toHaveScreenshot('03-cell-insert-menu.png')
})

test('04 块菜单（行图标一致）', async ({ page }) => {
  await open(page)
  await hoverLine(page, '正文段落')
  await hoverHandle(page)
  await expect(page.getByTestId('block-handle-menu')).toBeVisible()
  await expect(page.getByTestId('block-handle-menu')).toHaveScreenshot('04-block-menu.png')
})

test('05 在下方添加 · 二级面板（图标 + 文案）', async ({ page }) => {
  await open(page)
  await hoverLine(page, '正文段落')
  await hoverHandle(page)
  await page.locator('[data-flyout="insert-menu"]').hover()
  await expect(page.getByTestId('block-handle-flyout')).toBeVisible()
  await settle(page)
  // 菜单与面板一起入镜：两者是同一个可视栈
  const menu = page.getByTestId('block-handle-menu')
  const box = (await menu.boundingBox())!
  await page.screenshot({
    path: 'test-results/visual/05-insert-flyout.png',
    clip: { x: box.x - 8, y: box.y - 8, width: box.width + 220, height: box.height + 16 },
  })
  await expect(page.getByTestId('block-handle-flyout')).toHaveScreenshot('05-insert-flyout-panel.png')
})

test('06 callout（头部仅 emoji）', async ({ page }) => {
  await open(page)
  await page.mouse.move(20, 20)
  await settle(page)
  await expect(page.locator('.cm-callout').first()).toHaveScreenshot('06-callout.png')
})

test('07 选中工具栏', async ({ page }) => {
  await open(page)
  await page.locator('.cm-content .cm-line').filter({ hasText: '正文段落' }).first().dblclick()
  await expect(page.locator('.mdb-floating-toolbar')).toBeVisible()
  await settle(page)
  await expect(page.locator('.mdb-floating-toolbar')).toHaveScreenshot('07-toolbar.png')
})

test('08 分栏', async ({ page }) => {
  await open(page)
  await page.mouse.move(20, 20)
  await settle(page)
  await expect(page.locator('[data-testid="cm-columns"]').first()).toHaveScreenshot('08-columns.png')
})
