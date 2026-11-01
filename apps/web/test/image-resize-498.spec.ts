// #498：图片可拖动改宽，宽度持久化为紧随其后的 `<!--w=N-->`，预览按同宽度渲染。
import { expect, test, type Page } from '@playwright/test'

test.use({ viewport: { width: 1440, height: 1000 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

/** Seed a doc with a real (data-URL) image so the widget renders an <img>. */
async function openWithImage(page: Page, tail = ''): Promise<void> {
  await page.goto('/')
  // 1×1 red PNG
  const png =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  const doc = `# T\n\n![图](${png})${tail}\n\n尾。\n`
  await page.getByTestId('file-input').setInputFiles({
    name: 'img-498.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(doc),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

async function sourceText(page: Page): Promise<string> {
  await page.getByTestId('mode-source-btn').click()
  await expect(page.locator('.cm-content').first()).toBeVisible()
  const text = await page.locator('.cm-content').first().innerText()
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  return text
}

test('图片右下角有缩放手柄', async ({ page }) => {
  await openWithImage(page)
  await expect(page.getByTestId('cm-image-resize')).toHaveCount(1)
})

test('拖动手柄后源码出现 <!--w=N-->，且宽度生效', async ({ page }) => {
  await openWithImage(page)
  const handle = page.getByTestId('cm-image-resize')
  const hb = (await handle.boundingBox())!
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2)
  await page.mouse.down()
  await page.mouse.move(hb.x + hb.width / 2 + 120, hb.y + hb.height / 2, { steps: 6 })
  await page.mouse.up()
  await settle(page)

  const src = await sourceText(page)
  const match = /<!--w=(\d+)-->/.exec(src)
  expect(match, `源码: ${src.slice(0, 120)}`).not.toBeNull()
  const width = Number(match![1])
  expect(width).toBeGreaterThanOrEqual(40)
  expect(width).toBeLessThanOrEqual(2000)

  // 编辑态 img 使用该宽度
  const styleWidth = await page.evaluate(() => {
    const img = document.querySelector('.cm-image-widget img') as HTMLImageElement | null
    return img?.getAttribute('data-width') ?? null
  })
  expect(Number(styleWidth)).toBe(width)
})

test('已有注释按该宽度渲染（编辑态 + 预览态）', async ({ page }) => {
  await openWithImage(page, '<!--w=120-->')
  const editWidth = await page.evaluate(() => {
    const img = document.querySelector('.cm-image-widget img') as HTMLImageElement | null
    return img ? img.style.width : null
  })
  expect(editWidth).toBe('120px')

  await page.getByTestId('mode-preview-btn').click()
  await settle(page)
  const preview = await page.evaluate(() => {
    const img = document.querySelector('.preview img, [data-testid="preview"] img') as HTMLImageElement | null
    return img ? { width: img.style.width, attr: img.getAttribute('width') } : null
  })
  expect(preview, '预览应渲染 img').not.toBeNull()
  expect(preview!.width).toBe('120px')
  expect(preview!.attr).toBe('120')
})
