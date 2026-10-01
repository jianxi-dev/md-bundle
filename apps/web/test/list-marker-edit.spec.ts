// #235：无序列表 active 时只显示圆点，不得回显原始 "- "。
import { expect, test, type Page } from '@playwright/test'

const DOC = `# List

- alpha item
- beta item
`

test.use({ viewport: { width: 1440, height: 900 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

test('无序列表 active 时不回显 "- "（#235）', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'list.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)

  const first = page.locator('.cm-content .cm-line').filter({ hasText: 'alpha item' }).first()
  await first.click()
  await settle(page)

  const text = await first.innerText()
  expect(text).not.toContain('- ')
  expect(text).toContain('alpha item')

  const before = await first.evaluate((el) => getComputedStyle(el, '::before').content)
  expect(before).toContain('•')
})
