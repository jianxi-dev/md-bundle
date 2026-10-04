// #239：通过块手柄菜单转换块类型后，正文（视口）不应跳动。
import { expect, test, type Page } from '@playwright/test'

const DOC = `${'paragraph filler line.\n\n'.repeat(40)}TARGETBLOCK near bottom.\n`

test.use({ viewport: { width: 1440, height: 900 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

test('转换块类型后视口不跳动（#239）', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'convert.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)

  const scroller = page.locator('.cm-scroller').first()
  await scroller.evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })
  await settle(page)
  const before = await scroller.evaluate((el) => el.scrollTop)

  const line = page.locator('.cm-content .cm-line').filter({ hasText: 'TARGETBLOCK' }).first()
  const box = await line.boundingBox()
  if (!box) throw new Error('target line has no box')
  await page.mouse.move(box.x + 30, box.y + box.height / 2)
  await settle(page)
  await page.locator('.mdb-block-handle').click()
  await page
    .getByTestId('block-handle-menu')
    .getByRole('button', { name: '一级标题', exact: true })
    .click()
  await settle(page)

  const after = await scroller.evaluate((el) => el.scrollTop)
  // A whole-document replace resets the viewport; a local change keeps it.
  expect(Math.abs(after - before)).toBeLessThan(40)
  await expect(line).toBeVisible()
  await expect(page.locator('.cm-content').first()).toContainText('TARGETBLOCK')
})
