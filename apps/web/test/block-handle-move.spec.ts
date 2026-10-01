// #252：块手柄菜单「上移 / 下移」应交换当前块与其相邻块。
import { expect, test, type Page } from '@playwright/test'

const DOC = `# Heading

A body

B body
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
    name: 'move.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

async function openHandleMenu(page: Page, text: string): Promise<void> {
  const line = page.locator('.cm-content .cm-line').filter({ hasText: text }).first()
  const box = await line.boundingBox()
  if (!box) throw new Error('line has no box')
  await page.mouse.move(box.x + 30, box.y + box.height / 2)
  await settle(page)
  await page.locator('.mdb-block-handle').click()
  await expect(page.locator('.mdb-block-handle-menu')).toBeVisible()
}

async function rawDoc(page: Page): Promise<string> {
  await page.getByTestId('mode-source-btn').click()
  await expect(page.locator('.cm-content').first()).toBeVisible()
  const text = await page.locator('.cm-content').first().innerText()
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
  return text
}

test('块手柄菜单「上移」把块移到上一块之前（#252）', async ({ page }) => {
  await openEditor(page)
  await openHandleMenu(page, 'B body')
  await page.locator('.mdb-block-handle-item').filter({ hasText: '上移' }).click()
  await settle(page)

  const text = await rawDoc(page)
  expect(text.indexOf('B body')).toBeLessThan(text.indexOf('A body'))
})

test('块手柄菜单「下移」把块移到下一块之后（#252）', async ({ page }) => {
  await openEditor(page)
  await openHandleMenu(page, 'A body')
  await page.locator('.mdb-block-handle-item').filter({ hasText: '下移' }).click()
  await settle(page)

  const text = await rawDoc(page)
  expect(text.indexOf('B body')).toBeLessThan(text.indexOf('A body'))
})
