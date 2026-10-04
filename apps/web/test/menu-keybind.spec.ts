// #335（change editor-fidelity 8.1 / W11a）：命令面板与浮动工具栏的快捷键显示规则。
// 1. 有绑定的项显示格式化后的快捷键（Mac 上 ⌘B，非 Mac 上 Ctrl+B）。
// 2. 无绑定的项（如 复制代码）不显示 kbd。
// 3. 浮动选择工具栏的「复制」控件无绑定，不显示 kbd。
// 运行：pnpm --filter @md-bundle/web exec playwright test test/menu-keybind.spec.ts
import { expect, test, type Page } from '@playwright/test'
import { PALETTE_KEY } from './keys'

const DOC = '# 标题\n\n正文段落 UNIQUEMARKER 这里。\n\n'

test.use({ viewport: { width: 1440, height: 900 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page): Promise<void> {
  // Pin platform to Mac for deterministic kbd assertions (CI runs on Ubuntu)
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true });
  });
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'menu-keybind-test.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await page.locator('.cm-content').click()
  await page.waitForTimeout(200)
}

/** Double-click the single-word line to select the whole word. */
async function selectWord(page: Page, word: string): Promise<void> {
  const line = page.locator('.cm-content .cm-line').filter({ hasText: word }).first()
  await expect(line).toBeVisible()
  await line.dblclick()
  await settle(page)
}

test('命令面板：加粗项显示格式化快捷键 ⌘B，复制代码项不显示 kbd', async ({ page }) => {
  await openEditor(page)
  await page.keyboard.press(PALETTE_KEY)

  const palette = page.getByTestId('command-palette')
  await expect(palette).toBeVisible()

  // 加粗项：有绑定，显示 ⌘B
  const boldItem = page.locator('.mdb-palette-item').filter({ hasText: '加粗' }).first()
  await expect(boldItem).toBeVisible()
  await expect(boldItem.locator('kbd')).toBeVisible()
  await expect(boldItem.locator('kbd')).toHaveText('⌘B')

  // 复制代码项：无绑定，不显示 kbd
  const copyCodeItem = page.locator('.mdb-palette-item').filter({ hasText: '复制代码' }).first()
  await expect(copyCodeItem).toBeVisible()
  await expect(copyCodeItem.locator('kbd')).toHaveCount(0)
})

test('浮动选择工具栏：复制控件无绑定，不显示 kbd', async ({ page }) => {
  await openEditor(page)
  await selectWord(page, 'UNIQUEMARKER')

  const toolbar = page.locator('.mdb-floating-toolbar')
  await expect(toolbar).toBeVisible()

  // 复制按钮：无 keyBinding，不显示 kbd
  const copyBtn = toolbar.getByRole('button', { name: '复制' })
  await expect(copyBtn).toBeVisible()
  await expect(copyBtn.locator('kbd')).toHaveCount(0)
})