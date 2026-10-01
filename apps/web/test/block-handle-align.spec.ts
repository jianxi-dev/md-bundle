// #237：块手柄对无序列表偏右（落到页边框内），应与段落/标题对齐同一 gutter 列。
import { expect, test, type Page } from '@playwright/test'

const DOC = `# Heading

paragraph one

- list item one
- list item two
`

test.use({ viewport: { width: 1440, height: 900 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'handle-align.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

async function hoverHandleX(page: Page, text: string): Promise<number> {
  const line = page.locator('.cm-content .cm-line').filter({ hasText: text }).first()
  const lineBox = await line.boundingBox()
  if (!lineBox) throw new Error('line has no box')
  await page.mouse.move(lineBox.x + 30, lineBox.y + lineBox.height / 2)
  await settle(page)
  const handle = page.locator('.mdb-block-handle')
  await expect(handle).toBeVisible()
  const box = await handle.boundingBox()
  if (!box) throw new Error('handle has no box')
  return box.x
}

test('块手柄对列表与段落对齐同一列（#237）', async ({ page }) => {
  await openEditor(page)

  const paraX = await hoverHandleX(page, 'paragraph one')
  const listX = await hoverHandleX(page, 'list item one')

  expect(Math.abs(listX - paraX)).toBeLessThan(4)
})
