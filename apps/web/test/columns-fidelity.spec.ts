// #327（change editor-fidelity 6.1）：分栏保真——每栏块手柄 + 可拖拽栏沟（col-resize）+ 栏宽回写源码。
// 运行：pnpm --filter @md-bundle/web exec playwright test test/columns-fidelity.spec.ts
import { expect, test, type Page } from '@playwright/test'

const DOC = `# Columns

Intro paragraph.

::: {.col-2}
Left column

Right column
:::

Outro paragraph.
`

const DOC5 = `# Columns

Intro paragraph.

::: {.col-5}
C1

C2

C3

C4

C5
:::

Outro paragraph.
`

test.use({ viewport: { width: 1200, height: 800 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page, text: string): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'columns.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(text),
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

test('AC: 编辑态分栏渲染为多列，第二栏悬停出现块手柄', async ({ page }) => {
  await openEditor(page, DOC)

  const columns = page.getByTestId('cm-columns').locator('.cm-column')
  await expect(columns).toHaveCount(2)
  await expect(columns.nth(0)).toContainText('Left column')
  await expect(columns.nth(1)).toContainText('Right column')

  // 围栏标记被 widget 替换，不再以源码出现
  await expect(page.locator('.cm-content')).not.toContainText('{.col-2}')

  // 第二栏悬停前手柄透明，悬停后显现
  const handle = columns.nth(1).getByTestId('column-block-handle')
  await expect(handle).toHaveCount(1)
  expect(await handle.evaluate((el) => getComputedStyle(el).opacity)).toBe('0')

  await columns.nth(1).hover()
  await settle(page)
  expect(await handle.evaluate((el) => getComputedStyle(el).opacity)).toBe('1')
})

test('AC: 栏沟悬停 col-resize 且高亮单条竖线', async ({ page }) => {
  await openEditor(page, DOC)

  const gutter = page.getByTestId('column-gutter').first()
  await expect(gutter).toBeVisible()
  expect(await gutter.evaluate((el) => getComputedStyle(el).cursor)).toBe('col-resize')

  const line = gutter.locator('.cm-column-gutter-line')
  const before = await line.evaluate((el) => getComputedStyle(el).backgroundColor)
  await gutter.hover()
  await settle(page)
  const after = await line.evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(before).not.toBe(after)
  expect(after).not.toBe('rgba(0, 0, 0, 0)')
})

test('AC: 拖拽栏沟改变栏宽并回写源码 cols:', async ({ page }) => {
  await openEditor(page, DOC)

  const gutter = page.getByTestId('column-gutter').first()
  const box = await gutter.boundingBox()
  if (!box) throw new Error('no gutter box')
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2

  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx + 140, cy, { steps: 8 })
  await page.mouse.up()
  await settle(page)

  // 二次拖拽（状态往返）不得损坏围栏：类名与属性间须保留空格。
  const gutter2 = page.getByTestId('column-gutter').first()
  const box2 = await gutter2.boundingBox()
  if (!box2) throw new Error('no gutter box')
  await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2)
  await page.mouse.down()
  await page.mouse.move(box2.x + box2.width / 2 - 60, box2.y + box2.height / 2, { steps: 6 })
  await page.mouse.up()
  await settle(page)

  const raw = await rawDoc(page)
  expect(raw).toMatch(/::: \{\.col-2 cols:\d+,\d+\}/)
  expect(raw).not.toMatch(/\.col-2cols/)

  // 预览态尊重栏宽（data-cols → 消毒后注入 grid 轨道），不再等宽。
  await page.getByTestId('mode-preview-btn').click()
  await expect(page.locator('.preview-content').first()).toBeVisible()
  await settle(page)
  const previewBlock = page.locator('.preview-content .layout-col-2').first()
  await expect(previewBlock).toBeVisible()
  const tracks = await previewBlock.evaluate((el) =>
    getComputedStyle(el).gridTemplateColumns.split(' ').map(parseFloat),
  )
  expect(tracks.length).toBe(2)
  expect(Math.abs(tracks[0] - tracks[1])).toBeGreaterThan(1)
})

test('AC: 2→5 栏切换后各栏按当前栏重建、无残留', async ({ page }) => {
  await openEditor(page, DOC)
  await expect(page.getByTestId('cm-columns').locator('.cm-column')).toHaveCount(2)

  // 源码态整体替换为 5 栏文档（真实源码编辑路径），切回编辑态断言重建
  await page.getByTestId('mode-source-btn').click()
  await expect(page.locator('.cm-content').first()).toBeVisible()
  await page.locator('.cm-content').first().click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+a' : 'Control+a')
  await page.keyboard.type(DOC5)
  await settle(page)
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)

  const columns = page.getByTestId('cm-columns').locator('.cm-column')
  await expect(columns).toHaveCount(5)
  await expect(columns.nth(4)).toContainText('C5')
  // 无旧手柄残留：列数即手柄数
  await expect(page.getByTestId('column-block-handle')).toHaveCount(5)
})
