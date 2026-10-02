import { expect, test, type Page } from '@playwright/test'

test.use({ viewport: { width: 1200, height: 800 } })

const DOC = `# Turn Into Test

## Heading with **partial** selection

Multi-line paragraph here.
Second line of the same block.
Third line continues.

Another normal paragraph.

\`\`\`ts
function demo() {
  return 42
}
\`\`\`

Bottom marker **ENDMARKER** near end.
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
    name: 'turn-into.md',
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

/** Drag-select a portion of text within a line. */
async function dragSelectPartial(page: Page, word: string): Promise<void> {
  const line = page.locator('.cm-content .cm-line').filter({ hasText: word }).first()
  await expect(line).toBeVisible()
  const box = await line.boundingBox()
  if (!box) throw new Error('element has no bounding box')
  await page.mouse.move(box.x + 10, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2)
  await page.mouse.up()
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

/** Click the 转换 dropdown and select an option by label. */
async function clickTurnIntoOption(page: Page, optionLabel: string): Promise<void> {
  const dropdownBtn = page.locator('.mdb-floating-toolbar .mdb-toolbar-dropdown-btn[title="转换"]')
  await expect(dropdownBtn).toBeVisible()
  await dropdownBtn.click()
  await settle(page)

  const option = page.locator('.mdb-toolbar-dropdown-menu .mdb-toolbar-dropdown-option', { hasText: optionLabel }).first()
  await expect(option).toBeVisible()
  await option.click()
  await settle(page)
}

test.describe('选区浮条：转换下拉（turn-into）#277 task 3.1', () => {
  test('AC-A: 选中标题内几个字符，转换→任务 → 整行变成 - [ ] …', async ({ page }) => {
    await openEditor(page)
    // Select partial text inside the heading "Heading with **partial** selection"
    await dragSelectPartial(page, 'partial')

    // Click 转换 dropdown and choose 任务
    await clickTurnIntoOption(page, '任务')

    // Verify the whole block became a task list item
    // Inline markdown (**partial**) is preserved — only block-level markers are stripped
    const raw = await rawDoc(page)
    expect(raw).toContain('- [ ] Heading with **partial** selection')
    // The heading marker should be gone
    expect(raw).not.toContain('## Heading')
  })

  test('AC-B: 选中多行段落，转换→二级标题 → 整块逐行加 ##', async ({ page }) => {
    await openEditor(page)
    // Select partial text in the multi-line paragraph
    await dragSelectPartial(page, 'Second line')

    // Click 转换 dropdown and choose 二级标题
    await clickTurnIntoOption(page, '二级标题')

    // Verify the whole block was converted line by line
    const raw = await rawDoc(page)
    // Should have ## on each non-blank line of the original block
    expect(raw).toContain('## Multi-line paragraph here.')
    expect(raw).toContain('## Second line of the same block.')
    expect(raw).toContain('## Third line continues.')
    // Should NOT have just the first line converted
    expect(raw).not.toMatch(/^## Multi-line paragraph here\.\nSecond line/)
  })

  test('转换→一级标题 applies # to each line of multi-line block', async ({ page }) => {
    await openEditor(page)
    await dragSelectPartial(page, 'Second line')
    await clickTurnIntoOption(page, '一级标题')

    const raw = await rawDoc(page)
    expect(raw).toContain('# Multi-line paragraph here.')
    expect(raw).toContain('# Second line of the same block.')
    expect(raw).toContain('# Third line continues.')
  })

  test('转换→三级标题 applies ### to each line', async ({ page }) => {
    await openEditor(page)
    await dragSelectPartial(page, 'Second line')
    await clickTurnIntoOption(page, '三级标题')

    const raw = await rawDoc(page)
    expect(raw).toContain('### Multi-line paragraph here.')
    expect(raw).toContain('### Second line of the same block.')
    expect(raw).toContain('### Third line continues.')
  })

  test('转换→四级标题 applies #### to each line', async ({ page }) => {
    await openEditor(page)
    await dragSelectPartial(page, 'Second line')
    await clickTurnIntoOption(page, '四级标题')

    const raw = await rawDoc(page)
    expect(raw).toContain('#### Multi-line paragraph here.')
    expect(raw).toContain('#### Second line of the same block.')
    expect(raw).toContain('#### Third line continues.')
  })

  test('转换→五级标题 applies ##### to each line', async ({ page }) => {
    await openEditor(page)
    await dragSelectPartial(page, 'Second line')
    await clickTurnIntoOption(page, '五级标题')

    const raw = await rawDoc(page)
    expect(raw).toContain('##### Multi-line paragraph here.')
    expect(raw).toContain('##### Second line of the same block.')
    expect(raw).toContain('##### Third line continues.')
  })

  test('转换→六级标题 applies ###### to each line', async ({ page }) => {
    await openEditor(page)
    await dragSelectPartial(page, 'Second line')
    await clickTurnIntoOption(page, '六级标题')

    const raw = await rawDoc(page)
    expect(raw).toContain('###### Multi-line paragraph here.')
    expect(raw).toContain('###### Second line of the same block.')
    expect(raw).toContain('###### Third line continues.')
  })

  test('转换→正文 strips heading markers from each line', async ({ page }) => {
    await openEditor(page)
    // Select partial text in the heading
    await dragSelectPartial(page, 'partial')
    await clickTurnIntoOption(page, '正文')

    const raw = await rawDoc(page)
    // Inline markdown (**partial**) is preserved — only block-level markers are stripped
    expect(raw).toContain('Heading with **partial** selection')
    expect(raw).not.toContain('## Heading')
  })

  test('转换→列表 applies - to each line of multi-line block', async ({ page }) => {
    await openEditor(page)
    await dragSelectPartial(page, 'Second line')
    await clickTurnIntoOption(page, '列表')

    const raw = await rawDoc(page)
    expect(raw).toContain('- Multi-line paragraph here.')
    expect(raw).toContain('- Second line of the same block.')
    expect(raw).toContain('- Third line continues.')
  })

  test('转换→引用 applies > to each line of multi-line block', async ({ page }) => {
    await openEditor(page)
    await dragSelectPartial(page, 'Second line')
    await clickTurnIntoOption(page, '引用')

    const raw = await rawDoc(page)
    expect(raw).toContain('> Multi-line paragraph here.')
    expect(raw).toContain('> Second line of the same block.')
    expect(raw).toContain('> Third line continues.')
  })

  test('转换→代码 wraps the whole block in ``` fence', async ({ page }) => {
    await openEditor(page)
    await dragSelectPartial(page, 'Second line')
    await clickTurnIntoOption(page, '代码')

    const raw = await rawDoc(page)
    // Should wrap the entire block in a fenced code block
    expect(raw).toContain('```')
    expect(raw).toContain('Multi-line paragraph here.')
    expect(raw).toContain('Second line of the same block.')
    expect(raw).toContain('Third line continues.')
    // Should have opening and closing fences
    const fenceCount = (raw.match(/```/g) || []).length
    expect(fenceCount).toBeGreaterThanOrEqual(2)
  })

  test('转换→高亮 wraps first line as > [!NOTE] and rest as > ', async ({ page }) => {
    await openEditor(page)
    await dragSelectPartial(page, 'Second line')
    await clickTurnIntoOption(page, '高亮')

    const raw = await rawDoc(page)
    expect(raw).toContain('> [!NOTE] Multi-line paragraph here.')
    expect(raw).toContain('> Second line of the same block.')
    expect(raw).toContain('> Third line continues.')
  })

  test('转换→表格 constructs a GFM table from block lines', async ({ page }) => {
    await openEditor(page)
    await dragSelectPartial(page, 'Second line')
    await clickTurnIntoOption(page, '表格')

    const raw = await rawDoc(page)
    // Should have a GFM table with header separator
    expect(raw).toContain('|')
    expect(raw).toContain('---')
    expect(raw).toContain('Multi-line paragraph here')
    expect(raw).toContain('Second line of the same block')
    expect(raw).toContain('Third line continues')
  })

  test('转换 dropdown exists in toolbar with correct label and icon', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'partial')

    const toolbar = page.locator('.mdb-floating-toolbar')
    await expect(toolbar).toBeVisible()

    const dropdownBtn = page.locator('.mdb-floating-toolbar .mdb-toolbar-dropdown-btn[title="转换"]')
    await expect(dropdownBtn).toBeVisible()
    // Icon should be ⇄ or similar
    await expect(dropdownBtn).toContainText('⇄')
  })

  test('转换 dropdown contains all expected options', async ({ page }) => {
    await openEditor(page)
    await selectWord(page, 'partial')

    const dropdownBtn = page.locator('.mdb-floating-toolbar .mdb-toolbar-dropdown-btn[title="转换"]')
    // Close any other open dropdowns first by clicking outside
    await page.locator('body').click({ position: { x: 0, y: 0 } })
    await settle(page)
    await dropdownBtn.click()
    await settle(page)

    // Find the menu that belongs to the 转换 dropdown (the one with "一级标题")
    const menu = page.locator('.mdb-toolbar-dropdown-menu').filter({ hasText: '一级标题' })
    await expect(menu).toBeVisible()

    const options = [
      '一级标题', '二级标题', '三级标题', '四级标题', '五级标题', '六级标题',
      '正文', '列表', '任务', '引用', '代码', '高亮', '表格'
    ]

    for (const opt of options) {
      const option = menu.locator('.mdb-toolbar-dropdown-option', { hasText: opt }).first()
      await expect(option).toBeVisible()
    }
  })

  test('empty selection or no block → no-op (no crash)', async ({ page }) => {
    await openEditor(page)
    // Click on empty line (no selection)
    const emptyLine = page.locator('.cm-content .cm-line').filter({ hasText: '' }).first()
    await emptyLine.click()
    await settle(page)

    // Toolbar should not be visible
    const toolbar = page.locator('.mdb-floating-toolbar')
    await expect(toolbar).toBeHidden()

    // Click somewhere to create a caret but no selection
    const line = page.locator('.cm-content .cm-line').filter({ hasText: 'Another normal paragraph' }).first()
    await line.click()
    await settle(page)

    // Toolbar should still be hidden (no selection)
    await expect(toolbar).toBeHidden()
  })
})