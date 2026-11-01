// #498：`<!--w=N-->` 在预览里生效、且编辑态不把注释渲染成正文。
import { expect, test, type Page } from '@playwright/test'

test.use({ viewport: { width: 1440, height: 1000 } })

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function open(page: Page, body: string): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'imgw.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(`# T\n\n${body}\n\n尾。\n`),
  })
  await page.getByTestId('mode-preview-btn').click()
  await expect(page.locator('.preview-content').first()).toBeVisible()
  await settle(page)
}

test('预览按注释宽度渲染图片', async ({ page }) => {
  await open(page, `![图](${PNG})<!--w=120-->`)
  const info = await page.evaluate(() => {
    const img = document.querySelector('.preview-content img') as HTMLImageElement | null
    return img ? { width: img.style.width, attr: img.getAttribute('width') } : null
  })
  expect(info, '预览应渲染 img').not.toBeNull()
  expect(info!.width).toBe('120px')
  expect(info!.attr).toBe('120')
})

test('无注释时保持自适应（不写死宽度）', async ({ page }) => {
  await open(page, `![图](${PNG})`)
  const info = await page.evaluate(() => {
    const img = document.querySelector('.preview-content img') as HTMLImageElement | null
    return img ? { width: img.style.width, attr: img.getAttribute('width') } : null
  })
  expect(info).not.toBeNull()
  expect(info!.attr).toBeNull()
})
