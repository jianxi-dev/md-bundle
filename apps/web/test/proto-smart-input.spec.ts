// 智能输入原型验收 e2e（原型 §2 + 缺陷 §8-2）：真实键盘路径驱动 CM6 keymap + inputHandler。
// 本文件是 conformance 探针：断言直接编码原型/单元契约；RED 即产品发现，不弱化、不静默跳过。
// 不使用 serial：任一 RED 都必须独立报告，不得跳过其余场景（每个测试独立打开自己的页面与文档）。
// 运行：pnpm --filter @md-bundle/web exec playwright test test/proto-smart-input.spec.ts --reporter=line
import { expect, test, type Page } from '@playwright/test'

// 文末留空行，保证首个快捷方式在行首触发。
const DOC = '# Alpha\n\nBeta paragraph.\n\n'
const EMPTY_DOC = '\n'

test.use({ viewport: { width: 1440, height: 900 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
}

async function openEditor(page: Page, doc = DOC): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'smart-input.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(doc),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

// CM6 空行在 innerText 中会渲染出额外换行（实测：`# Alpha\n\nBeta` → innerText `# Alpha\n\n\nBeta`），
// 精确等值断言必须逐行读 textContent 再 join，不能用 innerText。
async function exactDoc(page: Page): Promise<string> {
  await page.getByTestId('mode-source-btn').click()
  await expect(page.locator('.cm-content').first()).toBeVisible()
  const lines = await page.locator('.cm-content .cm-line').allTextContents()
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  return lines.join('\n')
}

async function placeCaretAtLineEnd(page: Page): Promise<void> {
  const lines = page.locator('.cm-content .cm-line')
  await lines.last().click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+End' : 'Control+End')
  await settle(page)
}

async function typeAndSettle(page: Page, text: string): Promise<void> {
  await page.keyboard.type(text)
  await settle(page)
}

test.describe('智能输入：块级快捷方式（真实键盘路径）', () => {
  test('## + Space → 二级标题：编辑态出现真实 H2 视觉信号，光标留块内可继续输入', async ({
    page,
  }) => {
    await openEditor(page)
    await placeCaretAtLineEnd(page)

    await typeAndSettle(page, '## ')
    await typeAndSettle(page, '二级标题')

    // 转换证明：仅凭源码文本无法区分「真转换渲染」与「原文原样保留」（两者文本相同），
    // 必须断言编辑态的 H2 装饰信号（.cm-heading.cm-h2，与 proto-semantic-modes 同款类）。
    const h2 = page.locator('.cm-content .cm-heading.cm-h2')
    await expect(h2, '编辑态应出现 .cm-heading.cm-h2 装饰').toHaveCount(1)
    await expect(h2.first()).toContainText('二级标题')
    // 独立于 class 的第二信号：H2 = 1.35em（17px → 22.95px），正文 17px。
    const fontSize = await h2.first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
    expect(fontSize, 'H2 字号应显著大于正文').toBeGreaterThan(20)

    // 光标延续：源码往返证明 `二级标题` 与 `## ` 同块同行的连续输入。
    const source = await exactDoc(page)
    expect(source).toContain('## 二级标题')
  })

  test('标题层级调整：Tab 降级、Shift+Tab 升级（# 标题 → ## 标题 → # 标题）', async ({ page }) => {
    await openEditor(page)
    await placeCaretAtLineEnd(page)

    await typeAndSettle(page, '# ')
    await typeAndSettle(page, '标题')

    // 事实一（视觉转换成立）：`# `+空格 后源码保留 `# ` 原文（空格 keymap 读到的是插入前文本），
    // 标题视觉由原文经装饰渲染（.cm-heading.cm-h1 存在），而非「剥离标记 + WeakMap 层级的转换」。
    // DOC 自带的 `# Alpha` 也是 H1，故共 2 个；按文本过滤确认新标题行渲染为 H1。
    const h1Marks = page.locator('.cm-content .cm-heading.cm-h1')
    await expect(h1Marks).toHaveCount(2)
    await expect(h1Marks.filter({ hasText: '标题' })).toHaveCount(1)

    // 事实二（层级调整不成立）：Tab 依赖 WeakMap 层级（从未写入），且 indentWithTab 先于
    // headingTabKeymap 注册 → Tab 变成 2 空格缩进。保留红断言：原型「标题行按 Tab 降级」未实现。
    await page.keyboard.press('Tab')
    await settle(page)
    const afterTab = await exactDoc(page)
    await expect.soft(afterTab, 'Tab 应把 H1 降级为 H2（原型 §2「层级可调」）').toContain('## 标题')

    // Shift+Tab 在真实实现中是 indentLess（撤销缩进），不是层级提升；精确等值锁定最终文档。
    await placeCaretAtLineEnd(page)
    await page.keyboard.press('Shift+Tab')
    await settle(page)
    const afterShiftTab = await exactDoc(page)
    expect(afterShiftTab).toBe('# Alpha\n\nBeta paragraph.\n\n# 标题')
  })

  test('- + Space → 无序列表；Enter 继续新 bullet（- 项目一 → - 项目二）', async ({ page }) => {
    await openEditor(page)
    await placeCaretAtLineEnd(page)

    await typeAndSettle(page, '- ')
    await typeAndSettle(page, '项目一')
    await page.keyboard.press('Enter')
    await settle(page)
    await typeAndSettle(page, '项目二')

    // 项目二 未输入 `- ` 前缀：若 Enter 未续写 bullet，源码不会出现带前缀的 `- 项目二`。
    const source = await exactDoc(page)
    expect(source).toBe('# Alpha\n\nBeta paragraph.\n\n- 项目一\n- 项目二')
  })

  test('- [ ] + Space → 任务列表（优先于普通 -），且不得残留自动配对的 ]', async ({ page }) => {
    await openEditor(page)
    await placeCaretAtLineEnd(page)

    await typeAndSettle(page, '- [ ] ')
    await typeAndSettle(page, '待办')

    // 精确等值：真实键盘路径下 `[` 的自动配对会残留一个 `]`（实测收到 `- [ ] 待办]`），
    // 任务列表行必须是干净转换结果 `- [ ] 待办`。
    const source = await exactDoc(page)
    expect(source, '任务列表行应精确为 `- [ ] 待办`，`[` 自动配对不得残留 `]`').toBe(
      '# Alpha\n\nBeta paragraph.\n\n- [ ] 待办',
    )
  })

  test('1. + Space → 有序列表；Enter 自动递增（1. 第一 → 2. 第二）', async ({ page }) => {
    await openEditor(page)
    await placeCaretAtLineEnd(page)

    await typeAndSettle(page, '1. ')
    await typeAndSettle(page, '第一')
    await page.keyboard.press('Enter')
    await settle(page)
    await typeAndSettle(page, '第二')

    // 第二 未输入 `2. ` 前缀：递增续写是 Enter 行为而非用户输入。
    const source = await exactDoc(page)
    expect(source).toBe('# Alpha\n\nBeta paragraph.\n\n1. 第一\n2. 第二')
  })

  test('> + Space → 引用；> [!tip]- + Space → 源码转换为折叠 callout 结构', async ({ page }) => {
    await openEditor(page)
    await placeCaretAtLineEnd(page)

    // 普通引用
    await typeAndSettle(page, '> ')
    await typeAndSettle(page, '引用文字')

    // 新建干净空行，单独测试 callout 折叠语法
    await page.keyboard.press('Enter')
    await settle(page)
    await page.keyboard.press('Enter')
    await settle(page)
    // 退出可能残留的 blockquote 续行
    await page.keyboard.press('Backspace')
    await settle(page)
    await typeAndSettle(page, '> [!tip]- ')
    await settle(page)

    const source = await exactDoc(page)
    expect(source).toContain('> 引用文字')
    // 单元契约（smart-input.test.ts）：`> [!tip]- ` → `> [!tip]-\n> `（折叠结构含续行）。
    // 直接断言结构：不受 `[` 自动配对残尾落点（`- ]` / `]- `）时序变体影响，红得稳定。
    expect(source).toMatch(/> \[!tip\]-\n> /)
  })

  test('三反引号 + Enter → 代码围栏；输入 code 落在围栏内', async ({ page }) => {
    await openEditor(page)
    await placeCaretAtLineEnd(page)

    await page.keyboard.type('```')
    await page.keyboard.press('Enter')
    await settle(page)
    await typeAndSettle(page, 'const a = 1')

    const source = await exactDoc(page)
    expect(source).toContain('```')
    // 位置证明：代码文本位于围栏开口之后（仅断言存在无法区分是否形成围栏）。
    expect(source, '代码内容应位于 ``` 围栏内').toContain('```\nconst a = 1')
  })

  test('自动配对：「 → 「」、* ×2 → ** 光标居中（真实输入路径）', async ({ page }) => {
    // 「 无物理键：insertText 走 IME 提交等价路径（input 事件 → inputHandler），非 keymap。
    // 键盘输入前必须落位光标（mode-edit 点击后焦点在按钮上，不落位则输入落空）。
    await openEditor(page, EMPTY_DOC)
    await placeCaretAtLineEnd(page)
    await page.keyboard.insertText('「')
    await settle(page)

    // 单元契约「* twice pairs to ** with caret between」：两次真实 * 按键 → 居中配对。
    // 全程连续输入、中途不做源码往返：模式切换会把焦点移回按钮，之后按键整体落空。
    // 光标先到文末（此时焦点仍在编辑器）再换行，避免 Enter 劈开刚生成的「」配对。
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+End' : 'Control+End')
    await page.keyboard.press('Enter')
    await settle(page)
    await page.keyboard.press('*')
    await page.keyboard.press('*')
    await typeAndSettle(page, '粗')

    // 单次源码往返同时锁两件事：「」配对成立；*×2 居中配对（未配对会得到 `**粗`）。
    expect(await exactDoc(page)).toBe('\n「」\n*粗*')
  })

  test.describe('斜杠菜单触发条件（§8-2：/ 误触发）', () => {
    test('空行输入 / → .mdb-slash-menu 可见；Esc 关闭', async ({ page }) => {
      await openEditor(page)
      await placeCaretAtLineEnd(page)

      await page.keyboard.press('/')
      await settle(page)

      const menu = page.locator('.mdb-slash-menu')
      await expect(menu).toBeVisible()
      await expect(menu).toContainText('标题')

      await page.keyboard.press('Escape')
      await settle(page)
      await expect(menu).toHaveCount(0)
    })

    test('中文文本后输入 /（词中） → 菜单不出现', async ({ page }) => {
      await openEditor(page)
      await placeCaretAtLineEnd(page)

      await typeAndSettle(page, 'abc')
      await page.keyboard.press('/')
      await settle(page)

      await expect(page.locator('.mdb-slash-menu')).toHaveCount(0)
      expect(await exactDoc(page)).toBe('# Alpha\n\nBeta paragraph.\n\nabc/')
    })

    test('全角 、 后输入 / → 菜单不出现，且无杂散字符', async ({ page }) => {
      await openEditor(page)
      await placeCaretAtLineEnd(page)

      await page.keyboard.insertText('、')
      await settle(page)
      // §8-2 报告的「输入 / 有时变成 、/」：必须实际按 / 才能验证守卫。
      await page.keyboard.press('/')
      await settle(page)

      await expect(page.locator('.mdb-slash-menu')).toHaveCount(0)
      // 只允许用户输入的一个顿号 + 一个斜杠，不允许重复/拼接污染。
      expect(await exactDoc(page)).toBe('# Alpha\n\nBeta paragraph.\n\n、/')
    })

    test('IME 合成态下输入 / → 菜单不出现（CDP 驱动真实组合事件）', async ({ page }) => {
      await openEditor(page)
      await placeCaretAtLineEnd(page)

      await page.evaluate(() => {
        const w = window as unknown as { __imeStart: number }
        w.__imeStart = 0
        document.addEventListener(
          'compositionstart',
          () => {
            w.__imeStart += 1
          },
          true,
        )
      })

      let compositionStarted = false
      let imeError = ''
      let endComposition: (() => Promise<void>) | null = null
      try {
        const session = await page.context().newCDPSession(page)
        // CDP 参数必须是 selectionStart/selectionEnd（此前误写 selection:{start,end} 会抛错被吞掉）。
        await session.send('Input.imeSetComposition', {
          text: 'ni',
          selectionStart: 0,
          selectionEnd: 2,
        })
        // 合成事件异步到达：100ms 兜底等待；主判据是页面内 compositionstart 计数。
        await page.waitForTimeout(100)
        compositionStarted = await page.evaluate(
          () => (window as unknown as { __imeStart: number }).__imeStart > 0,
        )
        endComposition = () => session.send('Input.insertText', { text: '结' })
      } catch (e) {
        imeError = String(e).slice(0, 120)
      }

      if (!compositionStarted) {
        // 显式不可验证：绝不静默通过（headless 下若 CDP IME 不可驱动则跳过并留痕）。
        test.info().annotations.push({
          type: 'issue',
          description: `IME 组合不可验证（headless）：${imeError || 'compositionstart 未触发'}`,
        })
        test.skip(true, 'headless Chromium 无法驱动 IME 组合 — 显式跳过，不做静默通过')
        return
      }

      await page.keyboard.press('/')
      await settle(page)
      try {
        // 对照：同位置无组合时菜单会打开（见「空行输入 /」测试），故 count=0 证明组合守卫生效。
        await expect(page.locator('.mdb-slash-menu')).toHaveCount(0)
      } finally {
        // 无论断言结果如何都结束合成；失败不覆盖断言结论（页面随测试结束销毁）。
        if (endComposition) {
          try {
            await endComposition()
          } catch {
            // 结束合成失败不影响本测试结论
          }
        }
      }
    })
  })
})

test.describe('页面错误收集', () => {
  test('全套智能输入交互 0 pageerror', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (e) => pageErrors.push(String(e)))

    await openEditor(page)
    await placeCaretAtLineEnd(page)

    // 快速扫描一遍主要快捷方式
    await typeAndSettle(page, '# 标题')
    await page.keyboard.press('Enter')
    await typeAndSettle(page, '- 列表')
    await page.keyboard.press('Enter')
    await typeAndSettle(page, '1. 有序')
    await page.keyboard.press('Enter')
    await typeAndSettle(page, '> 引用')
    await page.keyboard.press('Enter')
    await typeAndSettle(page, '``` ')
    await settle(page)
    await page.keyboard.type('code')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Escape')

    expect(pageErrors).toEqual([])
  })
})
