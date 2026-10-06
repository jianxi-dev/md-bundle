// #393: 相邻同类型 callout 不应自动合并
// 运行：pnpm --filter @md-bundle/web exec playwright test test/callout-merge-fix.spec.ts
import { expect, test, type Page } from '@playwright/test'

const DOC = `> [!DANGER]
> first
> [!DANGER]
> second
`

const DOC_BLANK_LINE = `> [!DANGER]
> first

> [!DANGER]
> second
`

test.use({ viewport: { width: 1440, height: 900 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page, doc: string): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'callout-merge.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(doc),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

async function openPreview(page: Page, doc: string): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'callout-merge.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(doc),
  })
  await page.getByTestId('mode-preview-btn').click()
  await expect(page.locator('.preview-content').first()).toBeVisible()
  await settle(page)
}

test.describe('相邻同类型 callout 不合并 (#393)', () => {
  test('编辑态：直接相邻的两个 DANGER callout 应渲染为 2 个 .cm-callout', async ({ page }) => {
    await openEditor(page, DOC)

    // 应有 2 个 callout 卡片
    await expect(page.locator('.cm-callout')).toHaveCount(2)

    // 第一个 callout 内容不应包含字面量 [!DANGER]
    const firstContent = page.locator('.cm-callout').first().locator('.cm-callout-content')
    await expect(firstContent).not.toContainText('[!DANGER]')
    await expect(firstContent).toContainText('first')

    // 第二个 callout 内容不应包含字面量 [!DANGER]
    const secondContent = page.locator('.cm-callout').nth(1).locator('.cm-callout-content')
    await expect(secondContent).not.toContainText('[!DANGER]')
    await expect(secondContent).toContainText('second')
  })

  test('编辑态：空行分隔的两个 DANGER callout 应渲染为 2 个 .cm-callout', async ({ page }) => {
    await openEditor(page, DOC_BLANK_LINE)

    await expect(page.locator('.cm-callout')).toHaveCount(2)

    const firstContent = page.locator('.cm-callout').first().locator('.cm-callout-content')
    await expect(firstContent).not.toContainText('[!DANGER]')
    await expect(firstContent).toContainText('first')

    const secondContent = page.locator('.cm-callout').nth(1).locator('.cm-callout-content')
    await expect(secondContent).not.toContainText('[!DANGER]')
    await expect(secondContent).toContainText('second')
  })

  test('预览态：直接相邻的两个 DANGER callout 应渲染为 2 个 .callout', async ({ page }) => {
    await openPreview(page, DOC)

    // 应有 2 个 callout 元素
    await expect(page.locator('.callout')).toHaveCount(2)

    // 第一个 callout body 不应包含字面量 [!DANGER]
    const firstBody = page.locator('.callout').first()
    await expect(firstBody).not.toContainText('[!DANGER]')
    await expect(firstBody).toContainText('first')

    // 第二个 callout body 不应包含字面量 [!DANGER]
    const secondBody = page.locator('.callout').nth(1)
    await expect(secondBody).not.toContainText('[!DANGER]')
    await expect(secondBody).toContainText('second')
  })

  test('预览态：空行分隔的两个 DANGER callout 应渲染为 2 个 .callout', async ({ page }) => {
    await openPreview(page, DOC_BLANK_LINE)

    await expect(page.locator('.callout')).toHaveCount(2)

    const firstBody = page.locator('.callout').first()
    await expect(firstBody).not.toContainText('[!DANGER]')
    await expect(firstBody).toContainText('first')

    const secondBody = page.locator('.callout').nth(1)
    await expect(secondBody).not.toContainText('[!DANGER]')
    await expect(secondBody).toContainText('second')
  })
})