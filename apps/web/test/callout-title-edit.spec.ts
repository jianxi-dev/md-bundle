// #395：callout 标题此前是只读 textContent，无写入路径。本 spec 驱动真实路径：
// 打开文档 → 点击标题 → 输入 → 断言源码行 `> [!TYPE] <新标题>` 落盘。
import { expect, test, type Page } from '@playwright/test'

const DOC = `# Callout

Intro paragraph.

> [!NOTE] 原始标题
> callout body text here

Outro paragraph.
`

test.use({ viewport: { width: 1440, height: 900 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'callout-title.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

async function rawDoc(page: Page): Promise<string> {
  await page.getByTestId('mode-source-btn').click()
  await expect(page.locator('.cm-content').first()).toBeVisible()
  const text = await page.locator('.cm-content').first().innerText()
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  return text
}

test('AC: 点击标题进入内联编辑并写回源码（#395）', async ({ page }) => {
  await openEditor(page)

  await expect(page.locator('.cm-callout')).toHaveCount(1)
  await expect(page.locator('.cm-callout-title')).toHaveText('原始标题')

  // 点击标题（而非卡片主体）→ 出现标题输入框并获得焦点
  await page.locator('.cm-callout-title').first().click()
  await settle(page)
  const input = page.getByTestId('cm-callout-title-editor')
  await expect(input).toBeVisible()
  await expect(input).toBeFocused()

  await input.fill('自定义标题')
  await page.keyboard.press('Enter')
  await settle(page)

  const source = await rawDoc(page)
  expect(source).toContain('> [!NOTE] 自定义标题')
  expect(source).not.toContain('原始标题')
})

test('AC: 清空标题回退为类型默认标头，不残留标题文本（#395）', async ({ page }) => {
  await openEditor(page)

  await page.locator('.cm-callout-title').first().click()
  await settle(page)
  const input = page.getByTestId('cm-callout-title-editor')
  await expect(input).toBeFocused()

  await input.fill('')
  await page.keyboard.press('Enter')
  await settle(page)

  const source = await rawDoc(page)
  expect(source).toContain('> [!NOTE]')
  expect(source).not.toContain('原始标题')

  // 卡片仍渲染，标题节点消失（无重复/幽灵标题，回退到徽标）
  await expect(page.locator('.cm-callout')).toHaveCount(1)
  await expect(page.locator('.cm-callout-title')).toHaveCount(0)
})
