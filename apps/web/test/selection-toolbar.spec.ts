// Ticket #260 (selection-toolbar/1.1): 选区浮条数据驱动 + 基础内联格式 + 切换语义。
// 覆盖：7 控件出现 / 删除线 toggle / 下划线 <u> / 复制剪贴板。
import { expect, test, type Page } from '@playwright/test'

test.use({ viewport: { width: 1200, height: 800 } })

// UNIQUEMARKER sits alone on its line so dblclick reliably selects the whole
// word (the line center is the word center). BOTTOMMARKER likewise.
const DOC = `# Selection Toolbar Test

UNIQUEMARKER

Another normal paragraph here.

BOTTOMMARKER near end.
`

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'selection-toolbar.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

/** Double-click the single-word line to select the whole word. */
async function selectWord(page: Page, word: string): Promise<void> {
  const line = page.locator('.cm-content .cm-line').filter({ hasText: word }).first()
  await expect(line).toBeVisible()
  await line.dblclick()
  await settle(page)
}

/** Switch to source mode, read raw Markdown, switch back to edit mode. */
async function rawDoc(page: Page): Promise<string> {
  await page.getByTestId('mode-source-btn').click()
  await expect(page.locator('.cm-content').first()).toBeVisible()
  const text = await page.locator('.cm-content').first().innerText()
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
  return text
}

test.describe('选区浮条：7 控件 + 切换（#260）', () => {
  test('选中文本后浮条出现 7 个控件', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    const toolbar = page.locator('.mdb-floating-toolbar')
    await expect(toolbar).toBeVisible()
    const buttons = toolbar.locator('.mdb-toolbar-btn')
    await expect(buttons).toHaveCount(7)
    const titles = await buttons.evaluateAll((els) =>
      els.map((e) => (e as HTMLButtonElement).title),
    )
    expect(titles).toEqual(['加粗', '斜体', '删除线', '下划线', '行内代码', '插入链接', '复制'])
  })

  test('删除线 applies ~~…~~ and toggles off on second click', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    const strikeBtn = page.locator('.mdb-floating-toolbar .mdb-toolbar-btn[title="删除线"]')
    await expect(strikeBtn).toBeVisible()
    await strikeBtn.click()
    await settle(page)

    let raw = await rawDoc(page)
    expect(raw).toContain('~~UNIQUEMARKER~~')

    // Re-select the (now decorated) word and toggle off. In edit mode the ~~
    // markers are hidden by decorations, so dblclick selects the inner content
    // and toggle Case 2 detects the surrounding ~~ and strips them.
    await selectWord(page, 'UNIQUEMARKER')
    await expect(strikeBtn).toBeVisible()
    await strikeBtn.click()
    await settle(page)

    raw = await rawDoc(page)
    expect(raw).not.toContain('~~')
    expect(raw).toContain('UNIQUEMARKER')
  })

  test('下划线 applies <u>…</u>', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    const underlineBtn = page.locator('.mdb-floating-toolbar .mdb-toolbar-btn[title="下划线"]')
    await expect(underlineBtn).toBeVisible()
    await underlineBtn.click()
    await settle(page)

    const raw = await rawDoc(page)
    expect(raw).toContain('<u>UNIQUEMARKER</u>')
  })

  test('复制 puts the selected text on the clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await openEditor(page)
    await selectWord(page, 'UNIQUEMARKER')

    const copyBtn = page.locator('.mdb-floating-toolbar .mdb-toolbar-btn[title="复制"]')
    await expect(copyBtn).toBeVisible()
    await copyBtn.click()
    await settle(page)

    const clip = await page.evaluate(() => navigator.clipboard.readText())
    expect(clip).toContain('UNIQUEMARKER')
  })
})
