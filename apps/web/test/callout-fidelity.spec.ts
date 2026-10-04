// #333（change editor-fidelity 5.1）：高亮块保真——卡片内联编辑（不坍缩）+ 标头不重复 + 末字符续输。
// 运行：pnpm --filter @md-bundle/web exec playwright test test/callout-fidelity.spec.ts
import { expect, test, type Page } from '@playwright/test'

const DOC = `# Callout

Intro paragraph.

> [!NOTE]
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
    name: 'callout-fidelity.md',
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

test('AC: 标头文本严格含一次「注释」，不出现「注释 注释」', async ({ page }) => {
  await openEditor(page)

  const header = page.locator('.cm-callout .cm-callout-header').first()
  await expect(header).toBeVisible()
  const text = await header.innerText()
  expect(text).not.toContain('注释 注释')
  expect((text.match(/注释/g) ?? []).length).toBe(1)
})

test('AC: 点击卡片后卡片保持渲染且出现可编辑区（不坍缩源码）', async ({ page }) => {
  await openEditor(page)

  await expect(page.locator('.cm-callout')).toHaveCount(1)
  await page.locator('.cm-callout').first().click()
  await settle(page)

  await expect(page.locator('.cm-callout')).toHaveCount(1)
  await expect(page.getByTestId('cm-callout-editor')).toBeFocused()
  await expect(page.locator('.cm-content')).not.toContainText('[!NOTE]')
})

test('AC: 末字符后输入被追加（末字符不被吞）', async ({ page }) => {
  await openEditor(page)

  await page.locator('.cm-callout').first().click()
  await expect(page.getByTestId('cm-callout-editor')).toBeFocused()
  await page.keyboard.type('XYZ')
  await settle(page)

  expect(await rawDoc(page)).toContain('callout body text hereXYZ')
})

test('AC: 光标移入再移出后卡片保持渲染、无源码残留', async ({ page }) => {
  await openEditor(page)

  await page.locator('.cm-callout').first().click()
  await settle(page)
  await page
    .locator('.cm-content .cm-line')
    .filter({ hasText: 'Intro paragraph.' })
    .first()
    .click()
  await settle(page)

  await expect(page.locator('.cm-callout')).toHaveCount(1)
  await expect(page.locator('.cm-content')).not.toContainText('[!NOTE]')
})
