// 原型 §4（块操作手柄：拖拽重排）+ §6（结构体检面板）e2e 锁定。
// 运行：pnpm --filter @md-bundle/web exec playwright test test/proto-block-structure.spec.ts --reporter=line
import { expect, test, type Locator, type Page } from '@playwright/test'

// 四个不同段落，便于拖拽重排与菜单操作断言。
const DRAG_DOC = '# 标题\n\n段落A\n\n段落B\n\n段落C\n\n段落D\n'

// 含标题层级跳跃（H1 → H3）的文档，触发 structure-linter 的 heading-skip 规则。
const STRUCTURE_DOC = '# 一级标题\n\n正文段落。\n\n### 三级标题\n\n跳过了二级标题。\n'

// 无任何结构问题的干净文档。
const CLEAN_DOC = '# 标题\n\n正文段落。\n\n## 二级标题\n\n另一段落。\n'

// 长文档，确保目标行在初始视口外，便于验证跳转滚动。
const LONG_STRUCTURE_DOC =
  '# 一级标题\n\n' + '正文段落。\n\n'.repeat(15) + '### 三级标题\n\n跳过了二级标题。\n'

test.use({ viewport: { width: 1440, height: 900 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
}

async function openEditor(page: Page, doc: string, name: string): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name,
    mimeType: 'text/markdown',
    buffer: Buffer.from(doc),
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

/** 把鼠标移到目标段落行内，触发沟槽手柄显示。 */
async function hoverParagraph(
  page: Page,
  text: string,
): Promise<{ x: number; y: number; height: number }> {
  const line = page.locator('.cm-content .cm-line').filter({ hasText: text })
  await expect(line).toBeVisible()
  const box = await boxOf(line)
  await page.mouse.move(box.x + 20, box.y + box.height / 2)
  return box
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

/** 等待左栏结构页签可见并点击。 */
async function openStructurePanel(page: Page): Promise<void> {
  const rail = page.getByTestId('left-rail')
  if ((await rail.count()) === 0 || (await rail.isHidden())) {
    await page.getByTestId('left-rail-toggle').click()
  }
  await expect(rail).toBeVisible()
  await page.getByTestId('left-rail-tab-structure').click()
  // 面板可能是 structure-panel（有诊断）或 structure-panel-empty（无诊断）
  await expect(
    page.getByTestId('structure-panel').or(page.getByTestId('structure-panel-empty')),
  ).toBeVisible()
}

/** 获取编辑器内部 CM6 滚动容器的 scrollTop。 */
async function getEditorScrollTop(page: Page): Promise<number> {
  return page.evaluate(() => {
    const scroller = document.querySelector('.cm-scroller')
    return scroller?.scrollTop ?? 0
  })
}

// ============================================================================
// PART 1 — Block handle drag & menu (prototype §4)
// ============================================================================

test.describe('块手柄：拖拽重排与菜单操作', () => {
  test('拖拽手柄将段落 D 移到段落 A 之前，蓝色插入线中途可见', async ({ page }) => {
    await openEditor(page, DRAG_DOC, 'drag-reorder.md')

    // 悬停段落 D，手柄出现
    await hoverParagraph(page, '段落D')
    const handle = page.getByTestId('block-handle')
    await expect(handle).toBeVisible()

    const handleBox = await boxOf(handle)
    const lineD = page.locator('.cm-content .cm-line').filter({ hasText: '段落D' })
    const lineDBox = await boxOf(lineD)

    // 手柄是 20×20px 的沟槽浮层（left = 行左缘 - 26px），mousedown 监听器绑定在手柄元素上：
    // 必须按在手柄右缘内侧；按在行内文本只会触发悬停，永远不会进入拖拽。
    const fromX = handleBox.x + handleBox.width - 3
    const fromY = handleBox.y + handleBox.height / 2
    await page.mouse.move(fromX, fromY)
    await expect(handle).toBeVisible()
    await page.mouse.down()
    // 按下后短暂驻留：等 ViewPlugin 完成 setDragEffect 并挂上 document 级监听。
    await page.waitForTimeout(50)

    // 关键：将鼠标移入编辑器内容区（右侧），否则 posAtCoords 在沟槽区返回 null
    await page.mouse.move(lineDBox.x + 30, fromY)
    await page.waitForTimeout(30)

    // 向上分 12 步移动鼠标，经过段落 C、B，落到段落 A 顶部内侧（上半区 → 落点在 A 之前）
    const lineA = page.locator('.cm-content .cm-line').filter({ hasText: '段落A' })
    await expect(lineA).toBeVisible()
    const lineABox = await boxOf(lineA)
    const targetY = lineABox.y + 2
    const contentX = lineDBox.x + 30 // 编辑器内容区 X 坐标

    // 步长细于 10 等分：确保 CM6 的 posAtCoords 持续命中目标块（并越过 4px moved 阈值）
    for (let i = 1; i <= 12; i++) {
      const y = fromY + (targetY - fromY) * (i / 12)
      await page.mouse.move(contentX, y)
      await page.waitForTimeout(25)
    }

    // 断言：拖拽过程中蓝色插入线可见，且已吸附到段落 A 顶部（自动重试 + 轮询，抗负载抖动）
    const insertLine = page.locator('.block-insert-line')
    await expect(insertLine).toBeVisible()
    await expect
      .poll(async () => Math.abs((await boxOf(insertLine)).y - lineABox.y))
      .toBeLessThanOrEqual(12)

    // 释放鼠标完成放置
    await page.mouse.up()
    await settle(page)

    // 断言：文档顺序变更，段落 D 现在在段落 A 之前
    const text = await rawDocText(page)
    const indexD = text.indexOf('段落D')
    const indexA = text.indexOf('段落A')
    expect(indexD).toBeLessThan(indexA)
    expect(text).toContain('段落D')
    expect(text).toContain('段落A')
    expect(text).toContain('段落B')
    expect(text).toContain('段落C')
  })

  test('菜单「复制块」在原块后插入副本', async ({ page }) => {
    await openEditor(page, DRAG_DOC, 'drag-copy.md')

    await hoverParagraph(page, '段落B')
    const handle = page.getByTestId('block-handle')
    await expect(handle).toBeVisible()
    await handle.click()

    const menu = page.getByTestId('block-handle-menu')
    await expect(menu).toBeVisible()
    await menu.getByRole('button', { name: '复制块' }).click()
    await expect(menu).toBeHidden()

    const text = await rawDocText(page)
    // 原文有 1 个「段落B」，复制后应有 2 个
    const matches = text.match(/段落B/g)
    expect(matches?.length).toBe(2)
    // 顺序：段落A、段落B、段落B(副本)、段落C、段落D
    const firstB = text.indexOf('段落B')
    const secondB = text.indexOf('段落B', firstB + 1)
    const indexC = text.indexOf('段落C')
    expect(firstB).toBeLessThan(secondB)
    expect(secondB).toBeLessThan(indexC)
  })

  test('菜单「转换为」→「二级标题」将段落转为 H2', async ({ page }) => {
    await openEditor(page, DRAG_DOC, 'drag-convert.md')

    await hoverParagraph(page, '段落C')
    const handle = page.getByTestId('block-handle')
    await expect(handle).toBeVisible()
    await handle.click()

    const menu = page.getByTestId('block-handle-menu')
    await expect(menu).toBeVisible()
    await menu.getByRole('button', { name: '二级标题' }).click()
    await expect(menu).toBeHidden()

    const text = await rawDocText(page)
    // 原「段落C」应变为「## 段落C」
    expect(text).toContain('## 段落C')
    // 其余段落不变
    expect(text).toContain('段落A')
    expect(text).toContain('段落B')
    expect(text).toContain('段落D')
  })

  test('菜单「转换为」→「一级标题」将段落转为 H1', async ({ page }) => {
    await openEditor(page, DRAG_DOC, 'drag-convert-h1.md')

    await hoverParagraph(page, '段落A')
    const handle = page.getByTestId('block-handle')
    await expect(handle).toBeVisible()
    await handle.click()

    const menu = page.getByTestId('block-handle-menu')
    await expect(menu).toBeVisible()
    await menu.getByRole('button', { name: '一级标题' }).click()
    await expect(menu).toBeHidden()

    const text = await rawDocText(page)
    expect(text).toContain('# 段落A')
    expect(text).toContain('段落B')
    expect(text).toContain('段落C')
    expect(text).toContain('段落D')
  })

  test('菜单「转换为」→「正文」将标题转回段落', async ({ page }) => {
    const docWithHeading = '# 标题\n\n## 二级标题\n\n正文段落。\n'
    await openEditor(page, docWithHeading, 'drag-convert-paragraph.md')

    await hoverParagraph(page, '二级标题')
    const handle = page.getByTestId('block-handle')
    await expect(handle).toBeVisible()
    await handle.click()

    const menu = page.getByTestId('block-handle-menu')
    await expect(menu).toBeVisible()
    await menu.getByRole('button', { name: '正文' }).click()
    await expect(menu).toBeHidden()

    const text = await rawDocText(page)
    // 原「## 二级标题」应变为「二级标题」（无 # 前缀）
    expect(text).toContain('二级标题')
    expect(text).not.toContain('## 二级标题')
    expect(text).toContain('# 标题')
    expect(text).toContain('正文段落')
  })
})

// ============================================================================
// PART 2 — Structure panel (prototype §6)
// ============================================================================

test.describe('结构体检面板：诊断列表、跳转、空状态', () => {
  test('含标题层级跳跃的文档：面板列出 heading-skip 诊断', async ({ page }) => {
    await openEditor(page, STRUCTURE_DOC, 'structure-heading-skip.md')
    await openStructurePanel(page)

    const panel = page.getByTestId('structure-panel')
    await expect(panel).toBeVisible()
    await expect(panel).toContainText('结构体检')
    await expect(panel).toContainText('标题层级跳跃')
    await expect(panel).toContainText('H1 → H3')
    await expect(panel).toContainText('heading-skip')
    // 至少 1 个诊断项
    const items = page.locator('[data-testid^="structure-diagnostic-"]')
    const count = await items.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('点击诊断项 → 编辑器滚动到问题位置（scrollTop 变化）', async ({ page }) => {
    await openEditor(page, LONG_STRUCTURE_DOC, 'structure-jump-long.md')
    await openStructurePanel(page)

    // 等诊断列表渲染出来，再取位于视口之外的目标发现：
    // lintStructure 按文档位置排序，首个诊断挂在 H1（偏移 0）的 section-no-conclusion 上，
    // 它本身就在视口顶部，点击不可能产生滚动（跳转实现是 CM6 最小 scrollIntoView）；
    // 真正位于折线下方的是文末 H3 上的 heading-skip。
    const diagnostics = page.locator('[data-testid^="structure-diagnostic-"]')
    await expect(diagnostics.first()).toBeVisible()
    const headingSkip = diagnostics.filter({ hasText: 'heading-skip' })
    await expect(headingSkip).toHaveCount(1)

    // 记录点击前的滚动位置
    const scrollBefore = await getEditorScrollTop(page)

    await headingSkip.click()

    // 断言：编辑器滚动到问题位置（滚动由 CM6 dispatch 异步生效，用轮询等它上升）
    await expect.poll(() => getEditorScrollTop(page)).toBeGreaterThan(scrollBefore)

    // 进一步断言：目标行（三级标题）滚动后进入视口
    const targetLine = page.locator('.cm-content .cm-line').filter({ hasText: '三级标题' })
    await expect(targetLine).toBeInViewport()
  })

  test('干净文档：面板显示空状态「未发现问题」', async ({ page }) => {
    await openEditor(page, CLEAN_DOC, 'structure-clean.md')
    await openStructurePanel(page)

    const emptyPanel = page.getByTestId('structure-panel-empty')
    await expect(emptyPanel).toBeVisible()
    await expect(emptyPanel).toContainText('未发现问题')
    await expect(emptyPanel.locator('text=✓')).toBeVisible()

    // 确保没有诊断项渲染
    const items = page.locator('[data-testid^="structure-diagnostic-"]')
    await expect(items).toHaveCount(0)
  })

  test('多种诊断类型同时存在：面板包含所有诊断（不强制顺序）', async ({ page }) => {
    // 文档同时包含：heading-skip (H1→H3)、empty-heading (连续标题 H3→H4)、long-paragraph (>300字)
    const longPara = '这是一个非常长的段落。'.repeat(30) // ~360 字，超过 300 阈值
    const multiDoc = `# 一级标题\n\n### 三级标题\n\n#### 四级标题\n\n${longPara}\n\n正常段落。\n`
    await openEditor(page, multiDoc, 'structure-multi.md')
    await openStructurePanel(page)

    const panel = page.getByTestId('structure-panel')
    await expect(panel).toBeVisible()

    // 验证至少包含 heading-skip、empty-heading、long-paragraph 三类
    await expect(panel).toContainText('heading-skip')
    await expect(panel).toContainText('empty-heading')
    await expect(panel).toContainText('long-paragraph')

    // 验证诊断项数量 ≥ 3
    const items = page.locator('[data-testid^="structure-diagnostic-"]')
    const count = await items.count()
    expect(count).toBeGreaterThanOrEqual(3)
  })
})
