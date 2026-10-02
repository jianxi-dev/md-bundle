// 键盘快捷键验收 e2e（ticket #291）：真实键盘路径驱动 CM6 keymap。
// AC (A): `## ` → H2（行内快捷，已由 smart-input 处理，锁定回归）
// AC (B): Mod-Alt-3 → 当前行变 `### `；Mod-Shift-7/8/9 → `- ` / `1. ` / `- [ ] `
import { expect, test, type Page } from '@playwright/test'

test.use({ viewport: { width: 1440, height: 900 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
}

async function openEditor(page: Page, doc = ''): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'shortcuts.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(doc),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

async function exactDoc(page: Page): Promise<string> {
  await page.getByTestId('mode-source-btn').click()
  await expect(page.locator('.cm-content').first()).toBeVisible()
  const lines = await page.locator('.cm-content .cm-line').allTextContents()
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  return lines.join('\n').replace(/\n+$/, '')
}

async function placeCaretAtLineStart(page: Page): Promise<void> {
  await page.locator('.cm-content').click()
  await page.keyboard.press('Home')
  await settle(page)
}

async function pressModAlt(page: Page, key: string): Promise<void> {
  const isMac = process.platform === 'darwin'
  await page.keyboard.press(`${isMac ? 'Meta' : 'Control'}+Alt+${key}`)
  await settle(page)
}

async function pressModShift(page: Page, key: string): Promise<void> {
  const isMac = process.platform === 'darwin'
  await page.keyboard.press(`${isMac ? 'Meta' : 'Control'}+Shift+${key}`)
  await settle(page)
}

test.describe('键盘快捷键：标题与列表（真实键盘路径）', () => {
  test('AC (A): ## + Space → 二级标题（行内快捷）', async ({ page }) => {
    await openEditor(page)
    await placeCaretAtLineStart(page)

    await page.keyboard.type('## ')
    await page.keyboard.type('二级标题')
    await settle(page)

    // 验证编辑态出现 H2 装饰信号
    const h2 = page.locator('.cm-content .cm-heading.cm-h2')
    await expect(h2, '编辑态应出现 .cm-heading.cm-h2 装饰').toHaveCount(1)
    await expect(h2.first()).toContainText('二级标题')

    // 源码往返验证
    const source = await exactDoc(page)
    expect(source).toContain('## 二级标题')
  })

  test('AC (B): Mod-Alt-3 → 当前行变为三级标题 ### ', async ({ page }) => {
    await openEditor(page, 'Plain line')
    await placeCaretAtLineStart(page)

    await pressModAlt(page, '3')
    await settle(page)

    const source = await exactDoc(page)
    expect(source).toBe('### Plain line')
  })

  test('AC (B): Mod-Alt-1..6 循环切换标题级别不嵌套 #', async ({ page }) => {
    await openEditor(page, 'Plain line')
    await placeCaretAtLineStart(page)

    // Mod-Alt-2 → ##
    await pressModAlt(page, '2')
    let source = await exactDoc(page)
    expect(source).toBe('## Plain line')

    await placeCaretAtLineStart(page)
    await pressModAlt(page, '4')
    source = await exactDoc(page)
    expect(source).toBe('#### Plain line')

    await placeCaretAtLineStart(page)
    await pressModAlt(page, '1')
    source = await exactDoc(page)
    expect(source).toBe('# Plain line')
  })

  test('AC (B): Mod-Shift-7 → 无序列表 - ', async ({ page }) => {
    await openEditor(page, 'Plain line')
    await placeCaretAtLineStart(page)

    await pressModShift(page, '7')
    await settle(page)

    const source = await exactDoc(page)
    expect(source).toBe('- Plain line')
  })

  test('AC (B): Mod-Shift-8 → 有序列表 1. ', async ({ page }) => {
    await openEditor(page, 'Plain line')
    await placeCaretAtLineStart(page)

    await pressModShift(page, '8')
    await settle(page)

    const source = await exactDoc(page)
    expect(source).toBe('1. Plain line')
  })

  test('AC (B): Mod-Shift-9 → 任务列表 - [ ] ', async ({ page }) => {
    await openEditor(page, 'Plain line')
    await placeCaretAtLineStart(page)

    await pressModShift(page, '9')
    await settle(page)

    const source = await exactDoc(page)
    expect(source).toBe('- [ ] Plain line')
  })

})

test.describe('页面错误收集', () => {
  test('全套快捷键交互 0 pageerror', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (e) => pageErrors.push(String(e)))

    await openEditor(page)
    await placeCaretAtLineStart(page)

    await page.keyboard.type('## Heading')
    await page.keyboard.press('Enter')
    await pressModAlt(page, '3')
    await page.keyboard.press('Enter')
    await pressModShift(page, '7')
    await page.keyboard.press('Enter')
    await pressModShift(page, '8')
    await page.keyboard.press('Enter')
    await pressModShift(page, '9')

    expect(pageErrors).toEqual([])
  })
})