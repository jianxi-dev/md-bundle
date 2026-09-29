// 语义编辑态 × 三模式一致性探针（编辑器交互原型 §1/§7，真实鼠标路径）。
// 锁定行为：
//   ① 打开文档默认预览态（产品决策，覆盖旧规格「编辑为默认」文本；预览为默认不得判缺陷）；
//   ② 语义态只跟随被点击的块（原型 §1「点击任意一个块 → 只有被点击的块变化」）：
//      点击 H2 → 仅 H2 的 .cm-heading-marker 以 ~0.4 透明度揭示，H3 保持 0；
//      点击 H3 → 仅 H3 揭示、H2 回 0（同一时刻至多一个活动块）；
//   ③ 点击正文下方空白 → 全部标记回 0（整篇恢复全渲染；覆盖缺陷「移入后整篇自动切换 /
//      移出后不自动恢复」）；
//   ④ 编辑态内联标记（**）永远隐藏（原型「粗体/斜体的 ** 永远隐藏」），源码态还原原文；
//   ⑤ 三模式按页签持久（md-bundle-web spec:293「SHALL persist per tab」）：切走再切回仍编辑态。
// 参考：/Users/mason/ToHighs/Downloads/editor-interaction-prototype.export-2.html §1+§7；
//       openspec/changes/editor-v2/specs/semantic-editing/spec.md（40% 结构标记 / 内联隐藏）；
//       openspec/specs/md-bundle-web/spec.md:275（装饰）/ :293（三模式按页签持久）。
// 运行：pnpm --filter @md-bundle/web exec playwright test test/proto-semantic-modes.spec.ts
import { expect, test, type Locator, type Page } from '@playwright/test'

// 首段普通段落 = 初始光标块（确保初始无标题处于活动态）；H2/H3 供标记计数；
// 末段含 **粗体** 供内联隐藏断言；末尾空行给「点击空白」留靶点。
const DOC = [
  '开头段落。',
  '',
  '## 二级标题',
  '',
  '### 三级标题',
  '',
  '含 **粗体** 的正文段落。',
  '',
].join('\n')

test.use({ viewport: { width: 1440, height: 900 } })

/** CM6 在 requestAnimationFrame 中完成 measure；几何/透明度断言前跑双 rAF 稳定布局。 */
async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
}

/** 通过 file-input 打开内存文档（setInputFiles 不算点击 UI）。 */
async function openDoc(page: Page, name: string): Promise<void> {
  await page.getByTestId('file-input').setInputFiles({
    name,
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
}

/** 点击顶栏编辑图标进入编辑态，返回 .cm-content。 */
async function enterEdit(page: Page): Promise<Locator> {
  await page.getByTestId('mode-edit-btn').click()
  const cmContent = page.getByTestId('mode-pane-editor').locator('.cm-content')
  await expect(cmContent).toBeVisible()
  await settle(page)
  return cmContent
}

/** computed opacity —— 透明度断言一律读计算样式（QG-4）。 */
async function opacityOf(locator: Locator): Promise<number> {
  return locator.evaluate((el) => Number(getComputedStyle(el).opacity))
}

/** computed display —— 面板级可见性用计算样式复核（QG-4）。 */
async function displayOf(locator: Locator): Promise<string> {
  return locator.evaluate((el) => getComputedStyle(el).display)
}

async function boxOf(
  locator: Locator,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox()
  if (!box) throw new Error('element has no bounding box')
  return box
}

test('默认模式：打开文档即预览，无任何点击', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (e) => pageErrors.push(String(e)))

  await page.goto('/')
  await openDoc(page, 'proto-default.md')

  // 产品决策：打开即预览（不是缺陷）。三个可观测面：预览面板可见、编辑面板隐藏、
  // 预览图标 aria-pressed=true。
  await expect(page.getByTestId('mode-pane-preview')).toBeVisible()
  await expect(page.getByTestId('mode-pane-editor')).toBeHidden()
  await expect(page.getByTestId('mode-preview-btn')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('mode-edit-btn')).toHaveAttribute('aria-pressed', 'false')

  // QG-4：两面板同挂 DOM，仅 display 切换 —— 以 computed display 复核。
  expect(await displayOf(page.getByTestId('mode-pane-preview'))).toBe('block')
  expect(await displayOf(page.getByTestId('mode-pane-editor'))).toBe('none')

  // 预览内容真渲染（非空白面板）
  await expect(page.locator('.preview-content').first()).toContainText('二级标题')

  expect(pageErrors).toEqual([])
})

test('语义态只跟随被点击的块：点击 H2 仅 H2 揭示，H3 保持 0', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (e) => pageErrors.push(String(e)))

  await page.goto('/')
  await openDoc(page, 'proto-block.md')
  const cmContent = await enterEdit(page)

  const markers = cmContent.locator('.cm-heading-marker')
  await expect(markers).toHaveCount(2)
  const h2Marker = markers.nth(0)
  const h3Marker = markers.nth(1)

  // 初始：光标在首段（非标题块）→ 两个标题标记均为 0（完全渲染，零源码符号）。
  expect(await opacityOf(h2Marker)).toBe(0)
  expect(await opacityOf(h3Marker)).toBe(0)

  // 真实鼠标点击 H2 标题文本 → 仅 H2 标记 ~0.4 揭示；H3 必须保持 0
  // （回归锁：「移入后整篇文章都自动切换」）。
  await cmContent.locator('.cm-heading.cm-h2').click()
  await settle(page)
  await expect.poll(() => opacityOf(h2Marker)).toBeGreaterThan(0.35)
  expect(await opacityOf(h2Marker)).toBeLessThanOrEqual(0.5)
  expect(await opacityOf(h3Marker)).toBe(0)

  // 点击 H3 → 仅 H3 揭示，H2 回 0（同一时刻至多一个活动块）。
  await cmContent.locator('.cm-heading.cm-h3').click()
  await settle(page)
  await expect.poll(() => opacityOf(h3Marker)).toBeGreaterThan(0.35)
  await expect.poll(() => opacityOf(h2Marker)).toBe(0)

  expect(pageErrors).toEqual([])
})

test('点击正文下方空白：全部标记回 0（整篇恢复渲染）', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (e) => pageErrors.push(String(e)))

  await page.goto('/')
  await openDoc(page, 'proto-blank.md')
  const cmContent = await enterEdit(page)

  const markers = cmContent.locator('.cm-heading-marker')
  await expect(markers).toHaveCount(2)
  const h2Marker = markers.nth(0)
  const h3Marker = markers.nth(1)

  // 先激活 H2，证明语义态确实生效，再点空白 —— 否则「回 0」断言可能假绿。
  await cmContent.locator('.cm-heading.cm-h2').click()
  await settle(page)
  await expect.poll(() => opacityOf(h2Marker)).toBeGreaterThan(0.35)

  // 文末空行下方（仍落在 .cm-content 内，其 min-height:100%）点击空白 →
  // 无活动块 → 全部标记隐藏（缺陷「移出后不会自动恢复」的回归锁）。
  const lastLine = cmContent.locator('.cm-line').last()
  const lastLineBox = await boxOf(lastLine)
  await page.mouse.click(lastLineBox.x + 12, lastLineBox.y + lastLineBox.height + 12)
  await settle(page)

  await expect.poll(() => opacityOf(h2Marker)).toBe(0)
  await expect.poll(() => opacityOf(h3Marker)).toBe(0)
  await expect(cmContent.locator('.cm-heading-marker-active')).toHaveCount(0)

  expect(pageErrors).toEqual([])
})

test('编辑态内联标记隐藏（** 不出现在渲染文本）；源码态还原 **粗体**', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (e) => pageErrors.push(String(e)))

  await page.goto('/')
  await openDoc(page, 'proto-inline.md')
  const cmContent = await enterEdit(page)

  // 编辑态：粗体内容渲染在，分隔符 ** 被 decoration 替换 → innerText 不得含 **。
  await expect(cmContent).toContainText('粗体')
  expect(await cmContent.innerText()).not.toContain('**')

  // 源码态：装饰关闭，原始 Markdown 直出（含 ** 与 # 前缀），heading marker 不存在。
  await page.getByTestId('mode-source-btn').click()
  await expect(page.getByTestId('mode-pane-editor')).toBeVisible()
  await expect.poll(() => cmContent.innerText()).toContain('**粗体**')
  await expect(cmContent.locator('.cm-heading-marker')).toHaveCount(0)

  // 切回编辑态：** 再次隐藏（装饰重新接管）。
  await page.getByTestId('mode-edit-btn').click()
  await expect.poll(() => cmContent.innerText()).not.toContain('**')

  expect(pageErrors).toEqual([])
})

test('三模式按页签持久：切走再切回仍为编辑态（spec:293）', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (e) => pageErrors.push(String(e)))

  await page.goto('/')
  await openDoc(page, 'proto-tab-a.md')
  await enterEdit(page)

  // 第二次上传 = 新页签（B），默认预览且成为 active。
  await openDoc(page, 'proto-tab-b.md')
  await expect(page.getByTestId('tab-strip').locator('[role="tab"]')).toHaveCount(2)
  await expect(page.getByTestId('mode-pane-preview')).toBeVisible()

  // 切回 A：规格「SHALL persist per tab」→ 必须仍为编辑态。
  // 若应用把模式重置为 preview，此断言按探针约定保留失败（不弱化），作为产品缺陷证据上报。
  await page.getByTestId('tab-strip').getByText('proto-tab-a.md').click()
  await expect(
    page.getByTestId('tab-strip').locator('[role="tab"][aria-selected="true"]'),
  ).toContainText('proto-tab-a.md')
  await expect.poll(() => displayOf(page.getByTestId('mode-pane-editor'))).toBe('block')
  await expect(page.getByTestId('mode-edit-btn')).toHaveAttribute('aria-pressed', 'true')

  expect(pageErrors).toEqual([])
})
