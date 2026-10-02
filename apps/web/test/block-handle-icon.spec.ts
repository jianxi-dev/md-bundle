// 块手柄图标（#274 task 2.2）e2e：悬停不同类型块时手柄显示对应图标。
// 运行：pnpm --filter @md-bundle/web exec playwright test test/block-handle-icon.spec.ts
import { expect, test, type Locator, type Page } from '@playwright/test'

// 文档包含：H2 标题、未勾选任务列表、已勾选任务列表、普通段落
// 空行分隔确保两个独立的列表块
const DOC = `## H2 Heading

- [ ] Unchecked task

Paragraph between lists.

- [x] Checked task only

Regular paragraph.`

test.use({ viewport: { width: 1440, height: 900 } })

async function settle(page: Page): Promise<void> {
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
    name: 'block-handle-icon.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

async function hoverLine(page: Page, text: string): Promise<void> {
  const line = page.locator('.cm-content .cm-line').filter({ hasText: text }).first()
  await expect(line).toBeVisible()
  const box = await line.boundingBox()
  if (!box) throw new Error('line has no box')
  await page.mouse.move(box.x + 20, box.y + box.height / 2)
  await settle(page)
}

test('悬停 H2 块时手柄显示 H2 图标', async ({ page }) => {
  await openEditor(page)
  await hoverLine(page, 'H2 Heading')

  const handle = page.getByTestId('block-handle')
  await expect(handle).toBeVisible()
  await expect(handle).toHaveText('H2')
})

test('悬停未勾选任务块时手柄显示 ☐', async ({ page }) => {
  await openEditor(page)
  await hoverLine(page, 'Unchecked task')

  const handle = page.getByTestId('block-handle')
  await expect(handle).toBeVisible()
  await expect(handle).toHaveText('☐')
})

test('悬停已勾选任务块时手柄显示 ☑', async ({ page }) => {
  await openEditor(page)
  await hoverLine(page, 'Checked task only')

  const handle = page.getByTestId('block-handle')
  await expect(handle).toBeVisible()
  await expect(handle).toHaveText('☑')
})

test('悬停普通段落时手柄保持 ⠿', async ({ page }) => {
  await openEditor(page)
  await hoverLine(page, 'Regular paragraph')

  const handle = page.getByTestId('block-handle')
  await expect(handle).toBeVisible()
  await expect(handle).toHaveText('⠿')
})
