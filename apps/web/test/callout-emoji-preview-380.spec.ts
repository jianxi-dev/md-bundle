// #380 回归锁：编辑态选的自定义标注 emoji 必须传进预览态，不能回落类型默认。
//
// Markdown 没有存 emoji 的槽位，覆盖值是会话态；旧实现只在编辑态的 widget 里生效，
// 预览走另一个 renderMarkdown，读不到覆盖值。现在编辑器把快照通过 `mdb:callout-emoji`
// 事件交给宿主，预览按文档序号带进渲染器。
//
// 运行：pnpm --filter @md-bundle/web exec playwright test test/callout-emoji-preview-380.spec.ts
import { expect, test, type Page } from '@playwright/test'

const DOC = `# 标注

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
    name: 'callout-emoji-380.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

test('自定义 emoji 在预览态生效；恢复默认后回落类型图标', async ({ page }) => {
  await openEditor(page)

  // 编辑态：点 header emoji → 选择 🎉
  await page.locator('.cm-callout-icon').first().click()
  const picker = page.getByTestId('cm-callout-emoji-picker')
  await expect(picker).toBeVisible()
  await picker.locator('[data-testid="cm-callout-emoji-option"][data-emoji="🎉"]').click()
  await settle(page)
  await expect(page.locator('.cm-callout').first()).toHaveAttribute('data-callout-emoji', '🎉')

  // 预览态：卡片头部的 icon 必须是同一个 emoji
  await page.getByTestId('mode-preview-btn').click()
  await expect(page.locator('.preview-content').first()).toBeVisible()
  await settle(page)
  const previewIcon = page.locator('.preview-content .callout-icon').first()
  await expect(previewIcon).toHaveText('🎉')

  // 恢复默认 → 预览回落类型默认（NOTE = 📝）
  await page.getByTestId('mode-edit-btn').click()
  await settle(page)
  await page.locator('.cm-callout-icon').first().click()
  await page.getByTestId('cm-callout-emoji-reset').click()
  await settle(page)
  await page.getByTestId('mode-preview-btn').click()
  await settle(page)
  await expect(page.locator('.preview-content .callout-icon').first()).toHaveText('📝')
})
