// #281（change editor-doubao-parity 4.3）：命令面板改为网格展示，每项显示快捷键。
// 运行：pnpm --filter @md-bundle/web exec playwright test test/command-palette-grid.spec.ts
import { expect, test, type Page } from '@playwright/test'
import { PALETTE_KEY } from './keys'

const DOC = '# 标题\n\n正文段落。\n\n'

// Expected formatted chord for the RUNNER platform (matches browser's real platform).
// CM6 resolves Mod- from the browser platform; the runner platform is the same.
const MOD = process.platform === 'darwin' ? '⌘' : 'Ctrl+'
const BOLD_CHORD = `${MOD}B`

test.use({ viewport: { width: 1440, height: 900 } })

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'palette-grid-test.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await page.locator('.cm-content').click()
  await page.waitForTimeout(200)
}

test('命令面板以网格展示，且带快捷键的命令项显示快捷键', async ({ page }) => {
  await openEditor(page)
  await page.keyboard.press(PALETTE_KEY)

  const palette = page.getByTestId('command-palette')
  await expect(palette).toBeVisible()

  const list = page.locator('.mdb-palette-list')
  await expect(list).toBeVisible()

  // 网格：计算样式 display:grid，且列轨道不止一条。
  const gridInfo = await list.evaluate((el) => {
    const cs = getComputedStyle(el)
    return { display: cs.display, columns: cs.gridTemplateColumns }
  })
  expect(gridInfo.display).toBe('grid')
  expect(gridInfo.columns.trim().split(/\s+/).length).toBeGreaterThan(1)

  // 每项显示快捷键：至少一项含 kbd，且加粗项显示平台格式化的快捷键。
  const items = page.locator('.mdb-palette-item')
  await expect(items.first()).toBeVisible()
  const kbdCount = await page.locator('.mdb-palette-item kbd').count()
  expect(kbdCount).toBeGreaterThan(0)

  const boldItem = items.filter({ hasText: '加粗' }).first()
  await expect(boldItem.locator('kbd')).toHaveText(BOLD_CHORD)
})

// #292（change editor-doubao-parity 8.2）AC A：命令面板显式展示 加粗 的绑定弦。
// 与上面的 #281 网格测试同源，但独立成条，锁定本票「命令面板快捷键显示」不被回归。
test('命令面板网格中 加粗 项显示快捷键（#292 AC A）', async ({ page }) => {
  await openEditor(page)
  await page.keyboard.press(PALETTE_KEY)

  const palette = page.getByTestId('command-palette')
  await expect(palette).toBeVisible()

  const boldItem = page.locator('.mdb-palette-item').filter({ hasText: '加粗' }).first()
  await expect(boldItem).toBeVisible()
  await expect(boldItem.locator('kbd')).toBeVisible()
  await expect(boldItem.locator('kbd')).toHaveText(BOLD_CHORD)
})
