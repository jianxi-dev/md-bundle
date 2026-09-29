// 原型 §8-3 独立复验（最高优先缺陷）：「删内容后格式删不掉，再删又出现已删内容」
// —— 疑似 Decoration 范围未随文本删除正确映射，导致「幽灵内容」。
//
// 本 spec 用真实按键（keyboard.press / keyboard.type）在真浏览器复验修复后的行为；
// 所有断言走「源码态往返」读取原始 Markdown（final-walkthrough.spec.ts:82-89 模式），
// 因为编辑态装饰会把 `**` / `# ` 等标记替换为 widget（DOM 中不可见），只有源码态能读到真实文本。
//
// 修复历史（本 spec 锁定的回归面）：
//   - #172 幽灵内容（stale controlled-component echo）→ PR #181
//   - #176 语义编辑态标题标记渲染 → PR #180
//
// 运行：pnpm --filter @md-bundle/web exec playwright test test/proto-edit-robustness.spec.ts --reporter=line
//
// 仪表说明（为什么这样写）：
//   1. settle = 双 rAF（slash-menu.spec.ts 同款）：CM6 在 rAF 中完成 measure / 装饰重建。
//   2. 模式往返（edit→source→edit）保留 CM6 选择；重聚焦用 locator.focus() 而不是点击，
//      避免点击把光标重新定位到元素中心（含隐藏 replace 装饰的行上点击落点不可控）。
//   3. 含隐藏 `**` 定界符的行上，DOM 光标与 CM6 state 选择可能不一致（实测：End 后输入
//      落在 closing `**` 之前，而 Backspace 按 state 位置删除）。因此「粗体词后光标」场景
//      采用可确定复现的落点（行尾 / 文末），并在用例内注释标注。
//   4. 源码态 innerText 的换行放大：CM6 每个空行渲染为含 <br> 的 .cm-line，
//      .cm-content innerText = 各行 innerText 以 "\n" 拼接，空行会放大为额外换行
//      （Chromium 实测，见各断言字面量）。
import { expect, test, type Page } from '@playwright/test'
import { UNDO_KEY } from './keys'

// 平台感知的「文末」快捷键：CM6 的 Mod-End 在 macOS 是 Cmd（Playwright 键名 Meta），
// Linux/Windows 是 Ctrl（keys.ts 同款约定，不得写死 Meta）。
const DOC_END_KEY = process.platform === 'darwin' ? 'Meta+End' : 'Control+End'

// 场景 1/2/3/5/6 的固定文档：标题 + 空行 + 段落 + 两个尾随空行。
const DOC = '# 标题\n\n正文段落\n\n'
// 源码态基线（Chromium 实测字面量，见头部仪表说明 4）。
const DOC_TEXT = '# 标题\n\n\n正文段落\n\n\n\n'
// 在文末空行输入 abc 后：末尾空行被占用，其额外拼接换行消失（少一个 \n）。
const DOC_TEXT_ABC = '# 标题\n\n\n正文段落\n\n\nabc'
const DOC_TEXT_XYZ = '# 标题\n\n\n正文段落\n\n\nxyz'

test.use({ viewport: { width: 1280, height: 800 } })
// 场景 4/7 各含两次打开文档 + 多次源码态往返，30s 默认预算偏紧。
test.setTimeout(90_000)

/** CM6 在 requestAnimationFrame 中完成 measure / 装饰重建；双 rAF 后再断言。 */
async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
}

/** 打开内存文档 → 切编辑态（打开默认预览态，必须先点 mode-edit-btn）→ 等内容同步完成。 */
async function openEditor(page: Page, doc: string, visibleNeedle: string): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'proto-edit-robustness.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(doc),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  // 编辑器先挂载空文档，value prop 在后续 effect 同步；等可见文本出现再取基线，
  // 避免把「加载中」快照当成基线（import.spec.ts 同款竞态防护）。
  await expect(page.locator('.cm-content').first()).toContainText(visibleNeedle)
  await settle(page)
}

/** 源码态往返读取原始 Markdown（final-walkthrough.spec.ts:82-89 模式），读完回编辑态。 */
async function rawDocText(page: Page): Promise<string> {
  await page.getByTestId('mode-source-btn').click()
  await expect(page.locator('.cm-content').first()).toBeVisible()
  await settle(page)
  const text = await page.locator('.cm-content').first().innerText()
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
  return text
}

/** 重聚焦编辑器但不移动光标：模式往返保留 CM6 选择，点击会重新定位（见头部仪表说明 2）。 */
async function focusEditor(page: Page): Promise<void> {
  await page.locator('.cm-content').first().focus()
  await settle(page)
}

/** 光标移到文末（真实按键）。 */
async function caretToDocEnd(page: Page): Promise<void> {
  await page.locator('.cm-content').first().click()
  await page.keyboard.press(DOC_END_KEY)
  await settle(page)
}

/** 光标移到第 lineIndex 行行尾（真实鼠标点击行左缘 + End 键）。 */
async function caretToLineEnd(page: Page, lineIndex: number): Promise<void> {
  await page
    .locator('.cm-content .cm-line')
    .nth(lineIndex)
    .click({ position: { x: 2, y: 5 } })
  await page.keyboard.press('End')
  await settle(page)
}

test('场景1 输入后删除：源码精确回到 abc 之前的基线，且稳定不复活', async ({ page }) => {
  await openEditor(page, DOC, '正文段落')
  const baseline = await rawDocText(page)
  expect(baseline).toBe(DOC_TEXT)

  await caretToDocEnd(page)
  await page.keyboard.type('abc')
  await settle(page)
  const before = await rawDocText(page)
  expect(before).toBe(DOC_TEXT_ABC)

  await focusEditor(page)
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Backspace')
  await settle(page)
  const after = await rawDocText(page)
  expect(after).toBe(baseline)
  expect(after).not.toContain('abc')

  // 稳定性：settle 后再读一次，值不得漂移（幽灵内容会在延迟 echo 后出现）。
  await settle(page)
  expect(await rawDocText(page)).toBe(after)
})

test('场景2 第二轮删除：按真实行合并语义删除，已删内容不复活', async ({ page }) => {
  await openEditor(page, DOC, '正文段落')
  const baseline = await rawDocText(page)

  await caretToDocEnd(page)
  await page.keyboard.type('abc')
  await settle(page)
  await focusEditor(page)
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Backspace')
  await settle(page)
  expect(await rawDocText(page)).toBe(baseline)

  // 第一轮 ×2：文末两个空行被行合并吃掉（CM6 语义：行首 Backspace 先并上一行）。
  // 注：任务假设第一轮 ×2 即进入「段落」；实测为第二轮，属测试假设修正而非产品缺陷。
  await focusEditor(page)
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Backspace')
  await settle(page)
  const pass1 = await rawDocText(page)
  expect(pass1).toBe('# 标题\n\n\n正文段落')
  expect(pass1).not.toContain('abc')

  // 第二轮 ×2：进入「段落」并删除末两字。
  await focusEditor(page)
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Backspace')
  await settle(page)
  const pass2 = await rawDocText(page)
  expect(pass2).toBe('# 标题\n\n\n正文')
  expect(pass2).not.toContain('abc')
  expect(pass2).not.toContain('段落')

  await settle(page)
  expect(await rawDocText(page)).toBe(pass2)
})

test('场景3 整行标题删除：逐字符删除（单测仅定义列表/引用一键清除），无悬挂 # 复活', async ({
  page,
}) => {
  await openEditor(page, DOC, '正文段落')
  await caretToLineEnd(page, 0)

  // 删掉「标题」两字 → 行内只剩 `# `。
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Backspace')
  await settle(page)
  expect(await rawDocText(page)).toBe('# \n\n\n正文段落\n\n\n\n')

  // 再删一格：吃掉 marker 后的空格 → `#`。
  // 注：smart-input.test.ts 的 smartBackspace 只定义空列表项（`- ` / `1. `）与空引用（`> `）
  // 的「一键清除标记」；标题 `# ` 无此规则，按默认逐字符删除（空格 → `#`）。
  await focusEditor(page)
  await page.keyboard.press('Backspace')
  await settle(page)
  expect(await rawDocText(page)).toBe('#\n\n\n正文段落\n\n\n\n')

  // 再删一格：`#` 消失，行变空；不得有悬挂 `#` 复活。
  await focusEditor(page)
  await page.keyboard.press('Backspace')
  await settle(page)
  const after = await rawDocText(page)
  expect(after).toBe('\n\n\n\n正文段落\n\n\n\n')
  expect(after).not.toContain('#')
  expect(after).not.toContain('标题')

  await settle(page)
  expect(await rawDocText(page)).toBe(after)
})

test('场景4 格式化区间删除：粗体词+定界符全删无 `**` 残留，装饰干净重导', async ({ page }) => {
  // Phase A：粗体在文末，光标在文末（= closing `**` 之后），Backspace ×6 覆盖
  // 词 2 字 + 定界符 4 字 → 源码不得残留任何 `*`。
  await openEditor(page, '# 标题\n\n正文段落\n\n**粗体**', '粗体')
  expect(await page.locator('.cm-content .cm-strong').count()).toBe(1)

  await caretToDocEnd(page)
  for (let i = 0; i < 6; i++) await page.keyboard.press('Backspace')
  await settle(page)
  const after = await rawDocText(page)
  expect(after).toBe(DOC_TEXT)
  expect(after).not.toContain('*')
  expect(after).not.toContain('粗')
  expect(await page.locator('.cm-content .cm-strong').count()).toBe(0)

  // 稳定性 + 模式往返重导（edit→source→edit 由 rawDocText 完成）。
  await settle(page)
  expect(await rawDocText(page)).toBe(after)

  // Phase B：原型用户路径——粗体在段落中间，光标落在渲染后的「粗体」词后（行尾落点，
  // 见头部仪表说明 3），Backspace ×4 删词 + 前置定界符；closing `**` 在光标之后，按纯文本
  // 语义保留（这正是原型「格式删不掉」的观感来源，非数据幽灵）。
  await openEditor(page, '# 标题\n\n**粗体**\n\n', '粗体')
  await caretToLineEnd(page, 2)
  for (let i = 0; i < 4; i++) await page.keyboard.press('Backspace')
  await settle(page)
  const mid4 = await rawDocText(page)
  expect(mid4).toBe('# 标题\n\n\n**\n\n\n\n')
  expect(mid4).not.toContain('粗体')

  // 继续 ×2：光标已在行首，Backspace 按纯文本语义并上一行（无幽灵：已删「粗体」不回归）。
  await focusEditor(page)
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Backspace')
  await settle(page)
  const mid6 = await rawDocText(page)
  expect(mid6).toBe('# 标题**\n\n\n\n')
  expect(mid6).not.toContain('粗体')

  await settle(page)
  expect(await rawDocText(page)).toBe(mid6)
})

test('场景5 删除后重输：xyz 精确落位，无旧内容残留', async ({ page }) => {
  await openEditor(page, DOC, '正文段落')
  const baseline = await rawDocText(page)

  await caretToDocEnd(page)
  await page.keyboard.type('abc')
  await settle(page)
  await focusEditor(page)
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Backspace')
  await settle(page)
  expect(await rawDocText(page)).toBe(baseline)

  await focusEditor(page)
  await page.keyboard.type('xyz')
  await settle(page)
  const after = await rawDocText(page)
  expect(after).toBe(DOC_TEXT_XYZ)
  expect(after).not.toContain('abc')
})

test('场景6 删除后撤销：一次撤销精确恢复删除前文本，无重复/幽灵', async ({ page }) => {
  await openEditor(page, DOC, '正文段落')
  const baseline = await rawDocText(page)

  await caretToDocEnd(page)
  await page.keyboard.type('abc')
  await settle(page)
  const preDelete = await rawDocText(page)
  expect(preDelete).toBe(DOC_TEXT_ABC)

  // 真实点击 + Mod-End 把「输入 abc」与「删除」切成两个 undo 组（CM6 history 的
  // closeHistory 语义）；否则连续输入+删除会并成一组，单次撤销会越过删除前状态。
  await caretToDocEnd(page)
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Backspace')
  await settle(page)
  expect(await rawDocText(page)).toBe(baseline)

  // 单次撤销：CM6 history 把连续输入/删除归并为一个事件（实测 ×3 删除一次撤销全恢复）。
  await focusEditor(page)
  await page.keyboard.press(UNDO_KEY)
  await settle(page)
  const undone = await rawDocText(page)
  expect(undone).toBe(preDelete)
  expect(undone).not.toContain('abcabc')

  await settle(page)
  expect(await rawDocText(page)).toBe(undone)
})

test('对照 smartBackspace 单测：空列表项/空引用行标记一键清除（真实按键复现）', async ({
  page,
}) => {
  // packages/editor/test/smart-input.test.ts「smart backspace」定义：
  // 空列表项（`- `、`1. `）与空引用（`> `）行首 Backspace 一次清除整个标记。
  await openEditor(page, '- 列表项\n\n', '列表项')
  await caretToLineEnd(page, 0)
  for (let i = 0; i < 3; i++) await page.keyboard.press('Backspace')
  await settle(page)
  expect(await rawDocText(page)).toBe('- \n\n\n\n')

  await focusEditor(page)
  await page.keyboard.press('Backspace')
  await settle(page)
  const listAfter = await rawDocText(page)
  expect(listAfter).toBe('\n\n\n\n\n')
  expect(listAfter).not.toContain('-')

  await openEditor(page, '> 引用项\n\n', '引用项')
  await caretToLineEnd(page, 0)
  for (let i = 0; i < 3; i++) await page.keyboard.press('Backspace')
  await settle(page)
  expect(await rawDocText(page)).toBe('> \n\n\n\n')

  await focusEditor(page)
  await page.keyboard.press('Backspace')
  await settle(page)
  const quoteAfter = await rawDocText(page)
  expect(quoteAfter).toBe('\n\n\n\n\n')
  expect(quoteAfter).not.toContain('>')
})

test('场景7 冻结窗内连删：可见层与源码同步，无「格式删不掉」滞后（#226）', async ({ page }) => {
  // pointerdown 置 frozen ~100ms（decorations/index.ts 冻结机制）；修复前该窗口内
  // docChanged 直接返回旧 DecorationSet，陈旧范围套到新文本上 → 可见文本滞后于源码
  // （#226 探针实测：首键可见 `粗*` / 次键 `**`，与源码渲染 `粗` / `****` 不符）。
  // 修复后任何 docChanged 都重建装饰，冻结仅跳过纯 selection 事务（保住点击稳定性）。
  //
  // 键间隔用页内合成 keydown（~12ms）保证落在 100ms 冻结窗内——真实按键无法保证；
  // 合成事件落在 .cm-content 上，走与真实按键相同的 CM6 keymap 路径（#226 探针实测）。
  await openEditor(page, '# 标题\n\n**粗体**\n\n', '粗体')
  const box = await page.locator('.cm-content .cm-line').nth(2).boundingBox()
  if (!box) throw new Error('bold line not found')
  await page.mouse.click(box.x + 2, box.y + 5)
  await page.keyboard.press('End')

  const visible = await page.evaluate(async () => {
    const content = document.querySelector('.cm-content')
    if (!(content instanceof HTMLElement)) throw new Error('.cm-content not found')
    const out: string[] = []
    for (let i = 0; i < 6; i++) {
      await new Promise((resolve) => setTimeout(resolve, 12))
      content.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }),
      )
      out.push(content.innerText)
    }
    return out
  })

  // 期望值 = 同一删除序列、每键间隔 400ms（冻结已解除 → 装饰逐键重建）的可见渲染，
  // 探针两轮实测一致（#226 修复前后 settled 轨迹相同）。
  expect(visible).toEqual([
    '# 标题\n\n\n粗\n\n\n\n',
    '# 标题\n\n\n****\n\n\n\n',
    '# 标题\n\n\n***\n\n\n\n',
    '# 标题\n\n\n**\n\n\n\n',
    '# 标题\n**\n\n\n\n',
    '# 标题**\n\n\n\n',
  ])

  await settle(page)
  expect(await rawDocText(page)).toBe('# 标题**\n\n\n\n')
})
