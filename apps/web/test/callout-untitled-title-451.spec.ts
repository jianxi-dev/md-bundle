// #451 回归锁：没有标题的高亮块也能补标题。
//
// 旧行为：CalloutWidget 只在源码已有标题时才渲染 .cm-callout-title，
// 无标题卡片没有可点的标题区，标题永远加不上。
//
// 运行：pnpm --filter @md-bundle/web exec playwright test test/callout-untitled-title-451.spec.ts
import { expect, test, type Page } from '@playwright/test'

const DOC = `# T

> [!NOTE]
> 正文

结尾段落。
`

test.use({ viewport: { width: 1440, height: 1000 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'callout-451.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

async function readSource(page: Page): Promise<string> {
  await page.getByTestId('mode-source-btn').click()
  await expect(page.locator('.cm-content').first()).toBeVisible()
  await settle(page)
  const text = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.cm-content .cm-line'))
      .map((el) => (el as HTMLElement).textContent ?? '')
      .join('\n'),
  )
  await page.getByTestId('mode-edit-btn').click()
  await settle(page)
  return text
}

test('无标题卡片有「添加标题」占位，点开可写回源码', async ({ page }) => {
  await openEditor(page)
  const title = page.locator('.cm-callout-title').first()
  await expect(title).toHaveCount(1)
  // #468：头部不再打印「添加标题」；空标题槽仍存在且可点开编辑。
  await expect(title).toHaveCount(1)
  await expect(title).toHaveAttribute('data-callout-empty-title', 'true')
  expect((await title.innerText()).trim()).toBe('')
  await expect(title).not.toHaveAttribute('data-placeholder', '添加标题')

  await title.click()
  await settle(page)
  const input = page.locator('.cm-callout-title-editor')
  await expect(input).toHaveCount(1)
  await expect(input).toBeFocused()

  await page.keyboard.type('新标题')
  await page.keyboard.press('Enter')
  await settle(page)

  const source = await readSource(page)
  expect(source).toContain('> [!NOTE] 新标题')
  expect(source).toContain('> 正文')
})
