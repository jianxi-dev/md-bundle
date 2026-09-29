// 原型 §3（上下文工具栏）回归锁：编辑器两类工具栏的真实交互契约
// 运行：pnpm --filter @md-bundle/web exec playwright test test/proto-selection-toolbar.spec.ts --reporter=line
// 实现现状（须在报告中说明）：
//   - .mdb-floating-toolbar（floating-toolbar.ts）：选中驱动，4 键（加粗/斜体/行内代码/插入链接），无删除线
//   - .mdb-toolbar（toolbar.ts）：上下文驱动，text-selected=5 键（含删除线），code-block=仅「复制代码」
//   - 原型表：文本选中→B I S 🔗 🎨 ✨AI；代码块→📋复制 🎨语言 ✨解释
//   - 差口：实现缺 🎨 ✨AI 与 语言/解释；两工具栏在选中时可能共存，本 spec 以 floating-toolbar 为主验收「选择即操作」
import { expect, test, type Locator, type Page } from '@playwright/test'

// 文档：含独特词汇供双击/拖选、空行、普通段落、围栏代码块
// 使用唯一词汇 "UNIQUEWORD" 避免与其他段落文本冲突
const DOC = `# Toolbar Test

Target word **UNIQUEWORD** inside paragraph.

Another normal paragraph without selection.

\`\`\`ts
function demo() {
  return 42
}
\`\`\`

Empty line above, empty line below.

`

test.use({ viewport: { width: 1440, height: 900 } })

const pageErrors: string[] = []
const consoleErrors: string[] = []

test.beforeEach(async ({ page }) => {
  pageErrors.length = 0
  consoleErrors.length = 0
  page.on('pageerror', (e) => pageErrors.push(String(e)))
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })
})

test.afterEach(async () => {
  expect(pageErrors, `pageerrors: ${pageErrors.join(' | ')}`).toEqual([])
  const realConsoleErrors = consoleErrors.filter((e) => !/Failed to load resource/.test(e))
  expect(realConsoleErrors, `console errors: ${realConsoleErrors.join(' | ')}`).toEqual([])
})

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
}

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'proto-toolbar.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

async function boxOf(
  locator: Locator,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox()
  if (!box) throw new Error('element has no bounding box')
  return box
}

/** 双击单词进行真实鼠标选中。 */
async function doubleClickWord(page: Page, word: string): Promise<Locator> {
  const line = page.locator('.cm-content .cm-line').filter({ hasText: word }).first()
  await expect(line).toBeVisible()
  await line.dblclick()
  await settle(page)
  return line
}

/** 拖选文本进行真实鼠标选中。 */
async function dragSelect(page: Page, word: string): Promise<Locator> {
  const line = page.locator('.cm-content .cm-line').filter({ hasText: word })
  await expect(line).toBeVisible()
  const box = await boxOf(line)
  await page.mouse.move(box.x + 10, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2)
  await page.mouse.up()
  await settle(page)
  return line
}

/** 点击别处折叠选区：点击远离工具栏的另一行。 */
async function collapseSelection(page: Page): Promise<void> {
  const otherLine = page
    .locator('.cm-content .cm-line')
    .filter({ hasText: 'Another normal paragraph' })
    .first()
  await otherLine.click()
  await settle(page)
}

/** 切到源码态读取原始 Markdown，再切回编辑态。 */
async function readRawMarkdown(page: Page): Promise<string> {
  await page.getByTestId('mode-source-btn').click()
  await expect(page.locator('.cm-content').first()).toBeVisible()
  const text = await page.locator('.cm-content').first().innerText()
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  return text
}

/** 断言工具栏可见性（computed style display/opacity）。 */
async function assertToolbarVisible(toolbar: Locator, shouldBeVisible: boolean): Promise<void> {
  if (shouldBeVisible) {
    await expect(toolbar).toBeVisible()
    const display = await toolbar.evaluate((el) => getComputedStyle(el).display)
    const opacity = await toolbar.evaluate((el) => getComputedStyle(el).opacity)
    expect(display).not.toBe('none')
    expect(Number(opacity)).toBeGreaterThan(0)
  } else {
    await expect(toolbar).toBeHidden()
  }
}

/** 定位 floating-toolbar 的加粗按钮（title="加粗"，icon="B"）。 */
function floatingBoldBtn(page: Page): Locator {
  return page.locator('.mdb-floating-toolbar .mdb-toolbar-btn[title="加粗"]')
}

/** 定位 context-toolbar 的加粗按钮（title="加粗"，icon="B"）。 */
function contextBoldBtn(page: Page): Locator {
  return page.locator('.mdb-toolbar .mdb-toolbar-btn[title="加粗"]')
}

/** 统计两类工具栏的可见实例数。 */
async function countToolbars(page: Page): Promise<{ floating: number; context: number }> {
  const floating = await page.locator('.mdb-floating-toolbar:visible').count()
  const context = await page.locator('.mdb-toolbar:visible').count()
  return { floating, context }
}

test.describe('原型 §3：选择工具栏（floating-toolbar）', () => {
  test('1. 双击选中单词 → floating-toolbar 立即出现在选区上方', async ({ page }) => {
    await openEditor(page)
    await doubleClickWord(page, 'UNIQUEWORD')

    const floating = page.locator('.mdb-floating-toolbar')
    await assertToolbarVisible(floating, true)

    // 位置粗略校验：工具栏在选区行附近（容差 120px）
    const line = page.locator('.cm-content .cm-line').filter({ hasText: 'UNIQUEWORD' }).first()
    const lineBox = await boxOf(line)
    const toolbarBox = await boxOf(floating)
    expect(Math.abs(toolbarBox.y - (lineBox.y - 40))).toBeLessThan(120)
  })

  test('2. 点击 floating-toolbar 加粗按钮 → 源码态确认 **UNIQUEWORD**', async ({ page }) => {
    await openEditor(page)
    await doubleClickWord(page, 'UNIQUEWORD')

    const btn = floatingBoldBtn(page)
    await expect(btn).toBeVisible()
    await btn.click()
    await settle(page)

    const raw = await readRawMarkdown(page)
    expect(raw).toContain('**UNIQUEWORD**')
  })

  test('3. 点击别处折叠选区 → floating-toolbar 立即消失', async ({ page }) => {
    await openEditor(page)
    await doubleClickWord(page, 'UNIQUEWORD')

    const floating = page.locator('.mdb-floating-toolbar')
    await assertToolbarVisible(floating, true)

    await collapseSelection(page)
    await assertToolbarVisible(floating, false)
  })

  test('4. 光标在普通段落（无选中）→ floating-toolbar 不可见', async ({ page }) => {
    await openEditor(page)
    // 点击 "Another normal paragraph" 行，不选中
    const line = page
      .locator('.cm-content .cm-line')
      .filter({ hasText: 'Another normal paragraph' })
    await line.click()
    await settle(page)

    const floating = page.locator('.mdb-floating-toolbar')
    await assertToolbarVisible(floating, false)
  })

  test('5. 光标在空行 → floating-toolbar 不可见', async ({ page }) => {
    await openEditor(page)
    // 点击空行（文档中有两处空行，取第一个）
    const emptyLine = page.locator('.cm-content .cm-line').filter({ hasText: '' }).first()
    await emptyLine.click()
    await settle(page)

    const floating = page.locator('.mdb-floating-toolbar')
    await assertToolbarVisible(floating, false)
  })
})

test.describe('原型 §3：上下文工具栏（context-toolbar / mdb-toolbar）', () => {
  test('6. 光标在围栏代码块内 → context-toolbar 显示「复制代码」按钮', async ({ page }) => {
    await openEditor(page)
    // 点击代码块内部某行
    const codeLine = page.locator('.cm-content .cm-line').filter({ hasText: 'return 42' })
    await codeLine.click()
    await settle(page)

    const context = page.locator('.mdb-toolbar')
    await assertToolbarVisible(context, true)

    // 实现仅有「复制代码」一个按钮（原型表期望：复制/语言/解释）
    const buttons = context.locator('.mdb-toolbar-btn')
    await expect(buttons).toHaveCount(1)
    await expect(buttons.first()).toHaveAttribute('title', '复制代码')
    await expect(buttons.first()).toHaveText('📋')
  })
})

test.describe('工具栏共存观测（报告用，不作为阻断断言）', () => {
  test('选中文本时两类工具栏可见性记录', async ({ page }, testInfo) => {
    await openEditor(page)
    await doubleClickWord(page, 'UNIQUEWORD')

    const counts = await countToolbars(page)
    // 记录而不断言：实现若两者共存，在报告中说明
    testInfo.annotations.push({
      type: 'observation',
      description: `选中时 floating=${counts.floating}, context=${counts.context}`,
    })
    expect(counts.floating + counts.context).toBeGreaterThan(0)
  })
})
