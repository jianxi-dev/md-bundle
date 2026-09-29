// 命令面板（Cmd/Ctrl+K）e2e：原型 §5 与 实机 §8-1 回归。
//   1) 编辑态按 PALETTE_KEY → 面板显示 + 输入框聚焦（document.activeElement）
//   2) 模糊搜索 / 拼音首字母：jc→加粗, bg→插入表格；清空 → 列表复位
//   3) 键盘导航：ArrowDown/Up 移动高亮（data-selected）；Enter 执行并断言可观测副作用
//   4) 关闭路径：Escape / 关闭按钮 / 遮罩点击 —— 各自独立断言
//   5) 输入隔离：输入 xyz 后关闭，文档内容（源码往返）不变
// 运行：pnpm --filter @md-bundle/web exec playwright test test/proto-command-palette.spec.ts --reporter=line
import { expect, test, type Page } from '@playwright/test'
import { PALETTE_KEY } from './keys'

const DOC = '# 标题\n\n正文段落。\n\n'

test.use({ viewport: { width: 1440, height: 900 } })
// 不使用 serial：任一 RED 必须独立报告，不得跳过其余场景。

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  // file-input 是隐藏的 <input type="file">，setInputFiles 可直接作用于隐藏元素
  await page.getByTestId('file-input').setInputFiles({
    name: 'palette-test.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await page.locator('.cm-content').click()
  await page.waitForTimeout(200)
}

/** 读取原始 Markdown：切到源码态读文本，再切回编辑态。 */
async function rawDocText(page: Page): Promise<string> {
  await page.getByTestId('mode-source-btn').click()
  await expect(page.locator('.cm-content').first()).toBeVisible()
  const text = await page.locator('.cm-content').first().innerText()
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  return text
}

test.describe('命令面板（Cmd/Ctrl+K）', () => {
  test('编辑态按 PALETTE_KEY 打开面板，输入框获得焦点', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (e) => pageErrors.push(String(e)))

    await openEditor(page)

    // §8-1 回归：Cmd+K 无面板 → 验证现已接入
    await page.keyboard.press(PALETTE_KEY)

    const palette = page.getByTestId('command-palette')
    await expect(palette).toBeVisible()

    const input = page.getByTestId('command-palette-input')
    await expect(input).toBeVisible()

    // 断言输入框为 document.activeElement（真聚焦，非仅可见）
    const activeIsInput = await page.evaluate(() => {
      const el = document.activeElement
      return el?.getAttribute('data-testid') === 'command-palette-input'
    })
    expect(activeIsInput).toBe(true)

    // 关闭面板以便后续测试复用
    await page.keyboard.press('Escape')
    await expect(palette).toBeHidden()

    expect(pageErrors).toEqual([])
  })

  test('模糊搜索 + 拼音首字母：jc→加粗, bg→插入表格；清空输入 → 列表复位', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (e) => pageErrors.push(String(e)))

    await openEditor(page)
    await page.keyboard.press(PALETTE_KEY)

    const input = page.getByTestId('command-palette-input')
    await expect(input).toBeVisible()

    // 拼音 jc → 匹配「加粗」(jia cu)
    await input.fill('jc')
    await expect(page.getByTestId('command-palette-item').filter({ hasText: '加粗' })).toBeVisible()

    // 拼音 bg → 匹配「插入表格」(cha ru biao ge → crbg，bg 为子序列)
    await input.fill('bg')
    await expect(
      page.getByTestId('command-palette-item').filter({ hasText: '插入表格' }),
    ).toBeVisible()

    // 清空输入 → 列表复位（显示所有可用命令，至少包含「加粗」）
    await input.fill('')
    await expect(page.getByTestId('command-palette-item').filter({ hasText: '加粗' })).toBeVisible()
    await expect(page.getByTestId('command-palette-item').filter({ hasText: '斜体' })).toBeVisible()

    // 确保输入框仍有焦点再按 Escape
    await input.focus()
    await page.waitForTimeout(100)
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('command-palette')).toBeHidden()

    expect(pageErrors).toEqual([])
  })

  test('键盘导航：ArrowDown/Up 移动高亮；Enter 执行「加粗」并断言文档内容变化', async ({
    page,
  }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (e) => pageErrors.push(String(e)))

    await openEditor(page)

    // 将光标置于「正文段落」中间（空选区 → wrapSelection 会插入 **** 并留光标在中间）
    await page.locator('.cm-content').click()
    await page.keyboard.press('Control+End')
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowLeft')

    await page.keyboard.press(PALETTE_KEY)
    const input = page.getByTestId('command-palette-input')
    await expect(input).toBeVisible()

    // 搜索「加粗」并导航选中
    await input.fill('加粗')
    const items = page.getByTestId('command-palette-item')
    await expect(items.first()).toBeVisible()

    // ArrowDown 移动高亮（data-selected=true）
    await page.keyboard.press('ArrowDown')
    let selected = await page
      .locator('[data-testid="command-palette-item"][data-selected="true"]')
      .count()
    expect(selected).toBe(1)

    // ArrowUp 移回
    await page.keyboard.press('ArrowUp')
    selected = await page
      .locator('[data-testid="command-palette-item"][data-selected="true"]')
      .count()
    expect(selected).toBe(1) // 仍有选中项（索引 0）

    // 等待重渲染完成、输入框重新聚焦
    await page.waitForTimeout(100)
    await input.focus()
    await page.waitForTimeout(50)

    // Enter 执行「加粗」
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('command-palette')).toBeHidden()

    // 断言可观测副作用：文档源码包含 ****（空选区插入）或 **...**（有选区包裹）
    const textAfter = await rawDocText(page)
    expect(textAfter).toMatch(/\*\*\*\*|\*\*.+\*\*/)

    expect(pageErrors).toEqual([])
  })

  test('关闭路径：Escape 关闭', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (e) => pageErrors.push(String(e)))

    await openEditor(page)
    await page.keyboard.press(PALETTE_KEY)
    await expect(page.getByTestId('command-palette')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('command-palette')).toBeHidden()

    expect(pageErrors).toEqual([])
  })

  test('关闭路径：点击关闭按钮 [data-testid="command-palette-close"] 关闭', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (e) => pageErrors.push(String(e)))

    await openEditor(page)
    await page.keyboard.press(PALETTE_KEY)
    await expect(page.getByTestId('command-palette')).toBeVisible()

    await page.getByTestId('command-palette-close').click()
    await expect(page.getByTestId('command-palette')).toBeHidden()

    expect(pageErrors).toEqual([])
  })

  test('关闭路径：点击遮罩 [data-testid="command-palette-backdrop"] 关闭', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (e) => pageErrors.push(String(e)))

    await openEditor(page)
    await page.keyboard.press(PALETTE_KEY)
    await expect(page.getByTestId('command-palette')).toBeVisible()

    // 点击遮罩（面板外侧）
    await page.getByTestId('command-palette-backdrop').click({ position: { x: 10, y: 10 } })
    await expect(page.getByTestId('command-palette')).toBeHidden()

    expect(pageErrors).toEqual([])
  })

  test('输入隔离：面板内输入 xyz 后关闭，文档内容（源码往返）不变', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (e) => pageErrors.push(String(e)))

    await openEditor(page)
    const before = await rawDocText(page)

    // 确保编辑器有焦点（上一测试的遮罩点击可能导致焦点丢失）
    await page.locator('.cm-content').click()
    await page.waitForTimeout(100)

    await page.keyboard.press(PALETTE_KEY)
    const input = page.getByTestId('command-palette-input')
    await expect(input).toBeVisible()

    // 输入不存在的搜索词
    await input.fill('xyz')
    await expect(page.locator('.mdb-palette-list')).toContainText('未找到匹配命令')

    // 确保输入框仍有焦点再按 Escape
    await input.focus()
    await page.waitForTimeout(100)
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('command-palette')).toBeHidden()

    // 文档内容不变
    const after = await rawDocText(page)
    expect(after).toBe(before)

    expect(pageErrors).toEqual([])
  })
})
