// #382：引用块 / 高亮块（callout）内的列表必须在编辑态渲染为列表（所见即所得）。
import { expect, test, type Page } from '@playwright/test'

const DOC = `# Nested lists

> 引用
> - 阿尔法
> - 贝塔

> [!NOTE] 标题
> - 甲
> - 乙
> 1. 一
> 2. 二
`

test.use({ viewport: { width: 1440, height: 900 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEdit(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'nested-lists.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

test.describe('#382 容器内列表编辑态渲染', () => {
  test('引用块内的无序列表渲染为列表（不再回显 "- "）', async ({ page }) => {
    await openEdit(page)

    const quotedItems = page.locator('.cm-content .cm-line.cm-quote.cm-list')
    await expect(quotedItems).toHaveCount(2)

    const first = quotedItems.first()
    await expect(first).toContainText('阿尔法')
    await expect(first).not.toContainText('- ')

    const bullet = await first.evaluate((el) => getComputedStyle(el, '::before').content)
    expect(bullet).toContain('•')
  })

  test('高亮块内的无序列表渲染为列表，有序列表渲染为数字标记', async ({ page }) => {
    await openEdit(page)

    const calloutBody = page.locator('.cm-callout-content')
    await expect(calloutBody).toBeVisible()

    await expect(calloutBody.locator('.cm-list:not(.cm-list-ordered)')).toHaveCount(2)
    await expect(calloutBody.locator('.cm-list-ordered')).toHaveCount(2)
    await expect(calloutBody).toContainText('甲')
    await expect(calloutBody).not.toContainText('- ')

    const bullet = await calloutBody
      .locator('.cm-list:not(.cm-list-ordered)')
      .first()
      .evaluate((el) => getComputedStyle(el, '::before').content)
    expect(bullet).toContain('•')

    const orderedMarker = calloutBody.locator('.cm-list-marker').first()
    await expect(orderedMarker).toHaveText('1. ')
  })

  test('预览态：高亮块仍正常渲染且含列表文本（不回归）', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('file-input').setInputFiles({
      name: 'nested-lists.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from(DOC),
    })
    await page.getByTestId('mode-preview-btn').click()
    await expect(page.locator('.preview-content').first()).toBeVisible()
    await settle(page)

    const callout = page.locator('.preview-content .callout').first()
    await expect(callout).toBeVisible()
    await expect(callout).toContainText('甲')
    await expect(page.locator('.preview-content blockquote').first()).toContainText('阿尔法')
  })
})
