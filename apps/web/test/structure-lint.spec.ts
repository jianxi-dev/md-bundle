// 结构体检（#206）e2e：默认关闭内联标记 → 命令面板「结构体检」开启 → 标记出现 → 再次执行关闭 → 标记消失。
// 运行：pnpm --filter @md-bundle/web exec playwright test test/structure-lint.spec.ts
import { expect, test, type Page } from '@playwright/test'
import { PALETTE_KEY } from './keys'

// 包含跳级标题（### 跳级标题）和结论段（因此…）的文档，确保至少触发一条 lint 规则。
const DOC = '# 标题一\n\n## 小节\n\n因此，这是结论段。\n\n普通段落。\n\n### 跳级标题\n\n内容。\n'

test.use({ viewport: { width: 1440, height: 900 } })

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'structure-lint.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-content')).toBeVisible()
  await page.locator('.cm-content').click()
  await page.waitForTimeout(300)
}

async function runStructureCheck(page: Page): Promise<void> {
  await page.locator('.cm-content').click()
  await page.waitForTimeout(200)
  await page.keyboard.press(PALETTE_KEY)
  const input = page.getByTestId('command-palette-input')
  await expect(input).toBeVisible()
  await input.fill('结构体检')
  await input.press('Enter')
  await expect(page.getByTestId('command-palette')).toBeHidden()
}

test('结构体检默认不显示内联标记，命令开启后出现，再次执行关闭', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (e) => pageErrors.push(String(e)))

  await openEditor(page)

  const lintMarks = page.locator('.cm-lint-mark')
  await expect(lintMarks).toHaveCount(0)

  await runStructureCheck(page)
  await expect(lintMarks.first()).toBeVisible()

  await runStructureCheck(page)
  await expect(lintMarks).toHaveCount(0)

  expect(pageErrors).toEqual([])
})
