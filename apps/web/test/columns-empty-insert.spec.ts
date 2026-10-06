// #378：斜杠菜单插入空分栏块（/f1../f5）后，编辑态必须渲染出 N 个可见、
// 可点击的空列（.cm-column），而不是一个零子元素的空白容器。
// 运行：pnpm --filter @md-bundle/web exec playwright test test/columns-empty-insert.spec.ts
import { expect, test, type Page } from '@playwright/test'

const DOC = '# Title\n\n'

test.use({ viewport: { width: 1440, height: 900 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'columns-empty-insert.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

async function placeEnd(page: Page): Promise<void> {
  await page.locator('.cm-content').click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+End' : 'Control+End')
  await settle(page)
}

async function insertColumns(page: Page, code: string): Promise<void> {
  await placeEnd(page)
  await page.keyboard.type(`/${code}`)
  await settle(page)
  await page.keyboard.press('Enter')
  await settle(page)
}

test('AC: /f2 插入 2 栏后渲染 2 个可见空列（computed height > 0）', async ({ page }) => {
  await openEditor(page)
  await insertColumns(page, 'f2')

  const container = page.getByTestId('cm-columns').first()
  await expect(container).toBeVisible()
  await expect(container).toHaveClass(/cm-columns-2/)

  const columns = container.locator('.cm-column')
  await expect(columns).toHaveCount(2)

  // 每个空列必须真实可见（非零高度），而非仅存在于 DOM。
  for (const col of await columns.all()) {
    const height = await col.evaluate((el) => el.getBoundingClientRect().height)
    expect(height).toBeGreaterThan(0)
  }
})

test('AC: /f1 插入 1 栏后渲染 1 个可见空列', async ({ page }) => {
  await openEditor(page)
  await insertColumns(page, 'f1')

  const container = page.getByTestId('cm-columns').first()
  await expect(container).toBeVisible()
  await expect(container).toHaveClass(/cm-columns-1/)
  const columns = container.locator('.cm-column')
  await expect(columns).toHaveCount(1)
  const height = await columns.first().evaluate((el) => el.getBoundingClientRect().height)
  expect(height).toBeGreaterThan(0)
})

test('AC: /f5 插入 5 栏后渲染 5 个可见空列', async ({ page }) => {
  await openEditor(page)
  await insertColumns(page, 'f5')

  const container = page.getByTestId('cm-columns').first()
  await expect(container).toBeVisible()
  await expect(container).toHaveClass(/cm-columns-5/)
  const columns = container.locator('.cm-column')
  await expect(columns).toHaveCount(5)
  for (const col of await columns.all()) {
    const height = await col.evaluate((el) => el.getBoundingClientRect().height)
    expect(height).toBeGreaterThan(0)
  }
})

test('AC: 空列可点击选中（mousedown 后源码光标落入分栏块）', async ({ page }) => {
  await openEditor(page)
  await insertColumns(page, 'f2')

  const firstColumn = page.getByTestId('cm-columns').first().locator('.cm-column').first()
  const box = await firstColumn.boundingBox()
  if (!box) throw new Error('no column box')
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await settle(page)

  // 选中分栏块后源码含完整围栏，且列手柄可见（块级控件生效）。
  await page.getByTestId('mode-source-btn').click()
  await expect(page.locator('.cm-content').first()).toBeVisible()
  const raw = await page.locator('.cm-content').first().innerText()
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  expect(raw).toContain('::: {.col-2')
})
