// #468（第一段）：callout 头部只保留前置 emoji 图标；emoji 面板贴着 emoji；
// 正文为空时提交会删掉空行。
//
// 红证据：修复前头部有 `.cm-callout-badge`（「信息」）和 `data-placeholder`
// （「添加标题」），picker 挂在卡片上、坐标在卡片下边框之外。
import { expect, test, type Page } from '@playwright/test'

test.use({ viewport: { width: 1440, height: 1000 } })

const DOC = `# T

> [!NOTE]
> 第一段正文。

尾。
`

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page, doc = DOC): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'callout-468.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(doc),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

// 源码态读取真实 markdown（编辑态里 callout 是 widget，innerText 不含 `>`）。
async function rawDoc(page: Page): Promise<string> {
  await page.getByTestId('mode-source-btn').click()
  await expect(page.locator('.cm-content').first()).toBeVisible()
  const text = await page.locator('.cm-content').first().innerText()
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  return text
}

test('头部只有 emoji 图标，没有徽标与占位', async ({ page }) => {
  await openEditor(page)
  const card = page.locator('.cm-callout').first()
  await expect(card).toBeVisible()
  const header = card.locator('.cm-callout-header')
  await expect(header.locator('.cm-callout-icon')).toHaveCount(1)
  await expect(header.locator('.cm-callout-badge')).toHaveCount(0)
  await expect(header.locator('[data-placeholder]')).toHaveCount(0)
  // 头部不应出现「信息 / 提示 / 添加标题」这类文字
  const text = (await header.innerText()).replace(/\s/g, '')
  expect(text).not.toContain('信息')
  expect(text).not.toContain('添加标题')
})

test('emoji 面板挂在头部下沿（贴着 emoji）', async ({ page }) => {
  await openEditor(page)
  const card = page.locator('.cm-callout').first()
  const icon = card.locator('.cm-callout-icon')
  await icon.click()
  await settle(page)
  const picker = page.getByTestId('cm-callout-emoji-picker')
  await expect(picker).toBeVisible()

  const geo = await page.evaluate(() => {
    const pickerEl = document.querySelector('.cm-callout-emoji-picker') as HTMLElement
    const headerEl = document.querySelector('.cm-callout-header') as HTMLElement
    const iconEl = document.querySelector('.cm-callout-icon') as HTMLElement
    const cardEl = document.querySelector('.cm-callout') as HTMLElement
    return {
      parentIsHeader: pickerEl.parentElement === headerEl,
      pickerTop: Math.round(pickerEl.getBoundingClientRect().top),
      headerBottom: Math.round(headerEl.getBoundingClientRect().bottom),
      iconBottom: Math.round(iconEl.getBoundingClientRect().bottom),
      cardBottom: Math.round(cardEl.getBoundingClientRect().bottom),
    }
  })
  expect(geo.parentIsHeader, 'picker 应挂在 header 下').toBe(true)
  // 面板顶边贴着头部下沿（±8px），而不是贴着卡片下边框
  expect(Math.abs(geo.pickerTop - geo.headerBottom)).toBeLessThanOrEqual(8)
  expect(geo.pickerTop).toBeLessThan(geo.cardBottom)
})

test('正文为空时提交会删掉空行', async ({ page }) => {
  await openEditor(page, '# T\n\n> [!NOTE]\n> 有内容。\n\n尾。\n')
  const card = page.locator('.cm-callout').first()
  await card.click()
  await settle(page)
  const editor = page.getByTestId('cm-callout-editor')
  await expect(editor).toBeVisible()
  await page.keyboard.press('Meta+A')
  await page.keyboard.press('Backspace')
  await settle(page)
  // 鼠标移出卡片 → 空内容应提交并删掉正文行
  await page.mouse.move(20, 20)
  await settle(page)
  await page.mouse.move(900, 900)
  await settle(page)
  await page.locator('.cm-content').click({ position: { x: 5, y: 5 } })
  await settle(page)
  const doc = await rawDoc(page)
  expect(doc).toContain('[!NOTE]')
  expect(doc, `提交后不应残留空引用行: ${JSON.stringify(doc)}`).not.toMatch(/\[!NOTE\]\s*\n\s*>/)
})
