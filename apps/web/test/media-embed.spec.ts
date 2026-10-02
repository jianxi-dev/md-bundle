// #284（change editor-doubao-parity 4.6）：视频/文件引用渲染 + 消毒边界。
// 运行：pnpm --filter @md-bundle/web exec playwright test test/media-embed.spec.ts
import { expect, test, type Page } from '@playwright/test'

const DOC = `# Media

![clip](clip.mp4)

[report](report.zip)
`

test.use({ viewport: { width: 1440, height: 900 } })

async function openPreview(page: Page, doc: string): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'media.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(doc),
  })
  await page.getByTestId('mode-preview-btn').click()
  await expect(page.locator('.preview-content').first()).toBeVisible()
}

test('AC: 视频引用渲染为 <video>，文件引用渲染为链接', async ({ page }) => {
  await openPreview(page, DOC)

  const preview = page.locator('.preview-content').first()
  await expect(preview.locator('video')).toHaveCount(1)
  await expect(preview.locator('a[href="report.zip"]')).toBeVisible()
})

test('AC: 危险内容被消毒器拦截（不产生 javascript: 链接）', async ({ page }) => {
  await openPreview(page, '<video src="javascript:alert(1)"></video>\n')

  const html = await page.locator('.preview-content').first().innerHTML()
  expect(html).not.toContain('javascript:')
})
