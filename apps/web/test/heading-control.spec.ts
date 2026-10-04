// #253：标题级别可从块手柄菜单切换；Backspace 于标题行首逐级降级（H1 → 正文）。
import { expect, test, type Page } from '@playwright/test'

test.use({ viewport: { width: 1440, height: 900 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page, doc: string): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'heading.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(doc),
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
  await settle(page)
  return text
}

async function hoverHeadingHandle(page: Page, text: string): Promise<void> {
  const line = page.locator('.cm-content .cm-line').filter({ hasText: text }).first()
  const box = await line.boundingBox()
  if (!box) throw new Error('line has no box')
  await page.mouse.move(box.x + 30, box.y + box.height / 2)
  await settle(page)
  await page.locator('.mdb-block-handle').click()
  await expect(page.locator('.mdb-block-handle-menu')).toBeVisible()
}

test('块手柄菜单切换标题级别到 H3（#253）', async ({ page }) => {
  await openEditor(page, '# Title\n\nA body\n')
  await hoverHeadingHandle(page, 'Title')
  await page
    .getByTestId('block-handle-menu')
    .getByRole('button', { name: '三级标题', exact: true })
    .click()
  await settle(page)

  expect(await rawDoc(page)).toContain('### Title')
})

test('Backspace 于标题行首逐级降级（#253）', async ({ page }) => {
  await openEditor(page, '## Title\n')

  // Re-focus the heading line before each keystroke: rawDoc() round-trips modes.
  const focusHeading = async (): Promise<void> => {
    const line = page.locator('.cm-content .cm-line').filter({ hasText: 'Title' }).first()
    await line.click()
    await settle(page)
  }

  await focusHeading()
  await page.keyboard.press('Home')
  await page.keyboard.press('Backspace')
  await settle(page)
  const afterFirst = await rawDoc(page)
  expect(afterFirst).toContain('# Title')
  expect(afterFirst).not.toContain('## Title')

  await focusHeading()
  await page.keyboard.press('Home')
  await page.keyboard.press('Backspace')
  await settle(page)
  const afterSecond = await rawDoc(page)
  expect(afterSecond.trim()).toBe('Title')
})
