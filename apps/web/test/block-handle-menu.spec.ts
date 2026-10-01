// #238：手柄菜单点击别处应关闭；指针移到手柄上时手柄不应消失（忽闪）。
import { expect, test, type Page } from '@playwright/test'

const DOC = `# Heading

paragraph one

- list item one
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
    name: 'handle-menu.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

async function revealHandle(page: Page): Promise<void> {
  const line = page.locator('.cm-content .cm-line').filter({ hasText: 'paragraph one' }).first()
  const box = await line.boundingBox()
  if (!box) throw new Error('line has no box')
  await page.mouse.move(box.x + 30, box.y + box.height / 2)
  await settle(page)
  await expect(page.locator('.mdb-block-handle')).toBeVisible()
}

test('手柄菜单点击别处关闭（#238）', async ({ page }) => {
  await openEditor(page)
  await revealHandle(page)

  await page.locator('.mdb-block-handle').click()
  const menu = page.locator('.mdb-block-handle-menu')
  await expect(menu).toBeVisible()

  await page
    .locator('.cm-content .cm-line')
    .filter({ hasText: 'Heading' })
    .first()
    .click()
  await settle(page)
  await expect(menu).toBeHidden()
})

test('指针移到手柄上时手柄保持可见（#238 忽闪）', async ({ page }) => {
  await openEditor(page)
  await revealHandle(page)

  const handle = page.locator('.mdb-block-handle')
  const box = await handle.boundingBox()
  if (!box) throw new Error('handle has no box')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await settle(page)

  await expect(handle).toBeVisible()
})
