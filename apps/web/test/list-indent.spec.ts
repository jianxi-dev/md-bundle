// 列表缩进/取消缩进：Tab / Shift-Tab 在列表项上增减一层缩进（真实键盘路径）。
// AC: (A) Tab 增加缩进；(B) Shift-Tab 减少缩进；标题 Tab 行为保留。
import { expect, test, type Page } from '@playwright/test'

const LIST_DOC = `- item one
- item two
`

const HEADING_DOC = `# H1
`

test.use({ viewport: { width: 1440, height: 900 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page, doc = LIST_DOC): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'list-indent.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(doc),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

async function clickFirstListLine(page: Page): Promise<void> {
  const first = page.locator('.cm-content .cm-line').filter({ hasText: 'item one' }).first()
  await first.click()
  await settle(page)
}

async function clickHeadingLine(page: Page): Promise<void> {
  const heading = page.locator('.cm-content .cm-line').filter({ hasText: 'H1' }).first()
  await heading.click()
  await settle(page)
}

async function getSource(page: Page): Promise<string> {
  await page.getByTestId('mode-source-btn').click()
  await expect(page.locator('.cm-content').first()).toBeVisible()
  const lines = await page.locator('.cm-content .cm-line').allTextContents()
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  return lines.join('\n')
}

test.describe('列表缩进/取消缩进（真实键盘路径）', () => {
  test('Tab 在列表项上增加一层缩进（2 空格）', async ({ page }) => {
    await openEditor(page)
    await clickFirstListLine(page)

    await page.keyboard.press('Tab')
    await settle(page)

    const source = await getSource(page)
    console.log('SOURCE AFTER TAB:', JSON.stringify(source))
    // 期望：第一行变为 "  - item one"（以 2 空格开头）
    expect(source).toMatch(/^  - item one/)
    // 第二行保持不变
    expect(source).toContain('\n- item two')
  })

  test('Shift-Tab 在已缩进列表项上减少一层缩进', async ({ page }) => {
    await openEditor(page)
    await clickFirstListLine(page)

    // 先 Tab 缩进
    await page.keyboard.press('Tab')
    await settle(page)

    // 再 Shift-Tab 取消缩进
    await page.keyboard.press('Shift+Tab')
    await settle(page)

    const source = await getSource(page)
    console.log('SOURCE AFTER SHIFT+TAB:', JSON.stringify(source))
    // 期望：恢复为 "- item one"（无前导空格）
    expect(source).toMatch(/^- item one/)
    expect(source).toContain('\n- item two')
  })

  test('Tab 在标题行上仍然降级（H1 → H2），标题行为保留', async ({ page }) => {
    await openEditor(page, HEADING_DOC)
    await clickHeadingLine(page)

    await page.keyboard.press('Tab')
    await settle(page)

    const source = await getSource(page)
    console.log('SOURCE AFTER TAB ON HEADING:', JSON.stringify(source))
    // 期望：标题从 "# H1" 变为 "## H1"
    expect(source).toBe('## H1\n')
  })
})