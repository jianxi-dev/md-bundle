// #234：命令面板与斜杠菜单必须跟随主题（切换 data-theme 后背景应变化）。
import { expect, test, type Locator, type Page } from '@playwright/test'
import { PALETTE_KEY } from './keys'

const DOC = '# 标题\n\n正文段落。\n\n'

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
    name: 'overlay-theme.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await page.locator('.cm-content').click()
  await settle(page)
}

const setTheme = (page: Page, theme: 'dark' | 'light') =>
  page.evaluate((t) => {
    document.documentElement.dataset.theme = t
  }, theme)

const background = (locator: Locator) =>
  locator.evaluate((el) => getComputedStyle(el).backgroundColor)

test('命令面板跟随主题（#234）', async ({ page }) => {
  await openEditor(page)

  await setTheme(page, 'dark')
  await page.keyboard.press(PALETTE_KEY)
  const panel = page.getByTestId('command-palette')
  await expect(panel).toBeVisible()
  const dark = await background(panel)

  await setTheme(page, 'light')
  const light = await background(panel)
  expect(light).not.toBe(dark)
})

test('斜杠菜单跟随主题（#234）', async ({ page }) => {
  await openEditor(page)

  await setTheme(page, 'dark')
  const lines = page.locator('.cm-content .cm-line')
  await lines.last().click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+End' : 'Control+End')
  await settle(page)
  await page.keyboard.type('/')
  const menu = page.locator('.mdb-slash-menu')
  await expect(menu).toBeVisible()
  const dark = await background(menu)

  await setTheme(page, 'light')
  const light = await background(menu)
  expect(light).not.toBe(dark)
})
