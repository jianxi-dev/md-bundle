// #288（change editor-doubao-parity 6.2）：插入高亮块时可选择类型（note/info/…/danger）。
// 运行：pnpm --filter @md-bundle/web exec playwright test test/callout-type-picker.spec.ts
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
    name: 'callout-type.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
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

test('AC: 插入高亮块选危险类型 → 源码 > [!DANGER] 且预览渲染危险样式', async ({ page }) => {
  await openEditor(page)

  await page.locator('.cm-content').click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+End' : 'Control+End')
  await settle(page)
  await page.keyboard.type('/')
  await settle(page)

  // 标注 is a type flyout opener (#288).
  await page.locator('.mdb-slash-item').filter({ hasText: '标注' }).first().click()
  const flyout = page.locator('.mdb-slash-flyout')
  await expect(flyout).toBeVisible()
  await flyout.locator('.mdb-slash-flyout-item').filter({ hasText: '危险' }).first().click()
  await settle(page)

  await page.keyboard.type('boom')
  await settle(page)

  expect(await rawDoc(page)).toContain('> [!DANGER]')

  await page.getByTestId('mode-preview-btn').click()
  await expect(page.locator('.preview-content').first()).toBeVisible()
  await expect(page.locator('.preview-content [data-callout="danger"]')).toHaveCount(1)
})
