// #468（第二段）：callout 正文里输入 `/` 打开卡片内插入菜单，各项插到正文里，
// 不再落到卡片外的文档行。
import { expect, test, type Page } from '@playwright/test'

test.use({ viewport: { width: 1440, height: 1000 } })
const DOC = `# T

> [!NOTE]
> 正文。

尾。
`

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'callout-insert-468.md',
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

test('/ 在 callout 内打开卡片本地插入菜单（不是文档外的 slash 菜单）', async ({ page }) => {
  await openEditor(page)
  await page.locator('.cm-callout').first().click()
  const editor = page.getByTestId('cm-callout-editor')
  await expect(editor).toBeVisible()

  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('/')
  await settle(page)

  const menu = page.getByTestId('cm-callout-insert-menu')
  await expect(menu).toBeVisible()
  // 文档级 slash 菜单不应出现
  await expect(page.getByTestId('slash-menu')).toHaveCount(0)
  await expect(menu.locator('.cm-callout-insert-item').first()).toBeVisible()
})

test('菜单里选「任务」会插入到正文里，且不落到卡片外', async ({ page }) => {
  await openEditor(page)
  await page.locator('.cm-callout').first().click()
  const editor = page.getByTestId('cm-callout-editor')
  await expect(editor).toBeVisible()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('/任务')
  await settle(page)

  const menu = page.getByTestId('cm-callout-insert-menu')
  await expect(menu).toBeVisible()
  await menu.locator('[data-insert-id="task"]').click()
  await settle(page)

  const value = await editor.inputValue()
  expect(value).toContain('- [ ] ')
  expect(value).not.toContain('/任务')

  // 提交后源码里任务行在 callout 内（有 `> ` 前缀），文档没有独立的 `- [ ]` 行
  await page.mouse.move(20, 20)
  await page.mouse.click(5, 5)
  await settle(page)
  const doc = await rawDoc(page)
  expect(doc).toContain('> - [ ]')
  expect(doc.split('\n').some((line) => line.startsWith('- [ ]'))).toBe(false)
})
