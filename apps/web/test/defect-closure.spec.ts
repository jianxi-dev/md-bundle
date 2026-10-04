// 缺陷收口 e2e（#336 任务 9.1 / W12）—— D1/D3/D4/D5/D6/D9/D10 浏览器可观测验收。
//   D1 ：打开 .md 默认进入编辑态（mode-edit-btn aria-pressed=true、.cm-editor 可见、无需点击）。
//   D3 ：围栏代码块非活动态隐藏 ```/~~~ 标记；光标进入块内还原原始围栏。
//   D4 ：插入菜单打开后点击编辑器外部 → 关闭且保持关闭。
//   D5 ：插入菜单无匹配查询 → 「无匹配项」空状态；Escape 关闭后不留空盒。
//   D6 ：`/` 与中文顿号「、」触发取消后均无残留字符。
//   D9 ：空态「新建空白文档」入口存在，点击创建空白可编辑页签。
//   D10：landing 与工作区渲染无控制台告警（含 React 重复 key）。
// 另外保留 375px 窄屏回归：D1 不改移动端默认预览契约。
// 证据：test-results/defect-closure.json。
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'

const here = dirname(fileURLToPath(import.meta.url))
const RES = join(here, '..', 'test-results')

test.use({ viewport: { width: 1280, height: 800 } })

// 串行：证据聚合依赖前序测试结果。
test.describe.configure({ mode: 'serial' })

const evidence: Record<string, boolean | number | string> = {
  ticket: '336',
  tasks: '9.1',
  d1MdOpensEdit: false,
  d3FencesHiddenInactive: false,
  d3FencesShownActive: false,
  d4OutsideClickCloses: false,
  d5EmptyStateAndEscape: false,
  d6SlashResidue: false,
  d6CommaResidue: false,
  d9CtaExists: false,
  d9CreatesBlankDoc: false,
  d10NoWarnings: false,
  d10NoKeyWarnings: false,
  narrowStillPreview: false,
}

/** CM6 在 rAF 中完成 measure —— 几何/装饰断言前跑双 rAF 稳定布局。 */
async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

/** 平台感知的「移动到文末」快捷键（macOS = Meta）。 */
function endChord(): string {
  return process.platform === 'darwin' ? 'Meta+End' : 'Control+End'
}

/** 打开内存 .md 文档并断言进入编辑态（D1 契约：.md 默认编辑）。 */
async function openInEdit(page: Page, name: string, content: string): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name,
    mimeType: 'text/markdown',
    buffer: Buffer.from(content),
  })
  await expect(page.getByTestId('mode-edit-btn')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('mode-pane-editor')).toBeVisible()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

/** 编辑态渲染 DOM 文本（含装饰替换后的可见文本）。 */
async function editorText(page: Page): Promise<string> {
  return (await page.getByTestId('mode-pane-editor').locator('.cm-content').first().textContent()) ?? ''
}

/** 切源码态读原始 Markdown（绕过装饰），再切回编辑态。 */
async function rawDoc(page: Page): Promise<string> {
  await page.getByTestId('mode-source-btn').click()
  await expect(page.locator('.cm-content').first()).toBeVisible()
  const text = await page.locator('.cm-content').first().innerText()
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  return text
}

/** 光标移到文末，输入 `/` 打开插入菜单。 */
async function openSlashMenuAtEnd(page: Page): Promise<void> {
  await page.getByTestId('mode-pane-editor').locator('.cm-content').click()
  await page.keyboard.press(endChord())
  await settle(page)
  await page.keyboard.type('/')
  await expect(page.locator('.mdb-slash-menu')).toBeVisible()
}

test('D1：打开 .md 默认编辑态，无需点击', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (e) => pageErrors.push(String(e)))

  await openInEdit(page, 'd1-md.md', '# D1 编辑态\n\n正文\n')

  await expect(page.getByTestId('mode-pane-editor').locator('.cm-content')).toContainText('D1 编辑态')
  expect(pageErrors).toEqual([])

  evidence.d1MdOpensEdit = true
})

test('D3：围栏代码块非活动态隐藏 ``` 标记，光标进入后还原（编辑态）', async ({ page }) => {
  const doc = '前置段落。\n\n```ts\nconst x = 1;\n```\n\n后置段落。\n'
  await openInEdit(page, 'd3-fence.md', doc)

  // 光标默认落在文档起始（前置段落）→ 围栏块非活动：标记不得出现在渲染 DOM。
  const inactive = await editorText(page)
  expect(inactive).not.toContain('```')
  expect(inactive).not.toContain('```ts')
  // 代码正文必须存活，语言标签 widget 仍渲染。
  expect(inactive).toContain('const x = 1;')
  await expect(page.locator('.cm-fenced-code-language')).toHaveText('ts')
  evidence.d3FencesHiddenInactive = true

  // 光标移入代码块 → 活动态：原始围栏文本重现、可编辑。
  await page.getByTestId('mode-pane-editor').getByText('const x = 1;').click()
  await expect.poll(async () => editorText(page)).toContain('```ts')
  expect(await editorText(page)).toContain('```')
  expect(await editorText(page)).toContain('const x = 1;')

  evidence.d3FencesShownActive = true
})

test('D4：插入菜单打开后点击编辑器外部关闭且保持关闭', async ({ page }) => {
  await openInEdit(page, 'd4-outside.md', '# Title\n\n')
  await openSlashMenuAtEnd(page)

  // 点击编辑器外部（顶栏品牌区）→ 菜单关闭
  await page.getByRole('heading', { name: 'MD-Bundle' }).click()
  await settle(page)
  await expect(page.locator('.mdb-slash-menu')).toHaveCount(0)

  // 保持关闭：不应复现为空盒
  await page.waitForTimeout(200)
  await expect(page.locator('.mdb-slash-menu')).toHaveCount(0)

  evidence.d4OutsideClickCloses = true
})

test('D5：无匹配查询显示「无匹配项」，Escape 关闭后不留空盒', async ({ page }) => {
  await openInEdit(page, 'd5-empty.md', '# Title\n\n')
  await openSlashMenuAtEnd(page)

  await page.keyboard.type('zzzzz')
  await settle(page)
  await expect(page.locator('.mdb-slash-empty')).toHaveCount(1)
  await expect(page.locator('.mdb-slash-empty')).toHaveText('无匹配项')
  await expect(page.locator('.mdb-slash-grid-menu .mdb-slash-item')).toHaveCount(0)

  await page.keyboard.press('Escape')
  await settle(page)
  await expect(page.locator('.mdb-slash-menu')).toHaveCount(0)
  // 空状态面板不得残留为空盒
  await expect(page.locator('.mdb-slash-empty')).toHaveCount(0)

  const raw = await rawDoc(page)
  expect(raw).not.toContain('/zzzzz')
  expect(raw).not.toContain('/')

  evidence.d5EmptyStateAndEscape = true
})

test('D6：`/` 与中文顿号「、」触发取消后均无残留', async ({ page }) => {
  await openInEdit(page, 'd6-residue.md', '# Title\n\n')

  // ① 斜杠触发 → Escape 取消
  await openSlashMenuAtEnd(page)
  await page.keyboard.press('Escape')
  await settle(page)
  await expect(page.locator('.mdb-slash-menu')).toHaveCount(0)
  let raw = await rawDoc(page)
  expect(raw).not.toContain('/')
  expect(raw).toContain('# Title')
  evidence.d6SlashResidue = true

  // ② 中文顿号「、」触发 → 编辑器外部点击取消
  await page.getByTestId('mode-pane-editor').locator('.cm-content').click()
  await page.keyboard.press(endChord())
  await settle(page)
  await page.keyboard.insertText('、')
  await expect(page.locator('.mdb-slash-menu')).toBeVisible()

  await page.getByRole('heading', { name: 'MD-Bundle' }).click()
  await settle(page)
  await expect(page.locator('.mdb-slash-menu')).toHaveCount(0)

  raw = await rawDoc(page)
  expect(raw).not.toContain('、')
  expect(raw).not.toContain('/')
  expect(raw).toContain('# Title')
  evidence.d6CommaResidue = true
})

test('D9：空态存在「新建空白文档」入口', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('landing-nav')).toBeVisible()

  const cta = page.getByTestId('cta-new-blank')
  await expect(cta).toBeVisible()
  await expect(cta).toHaveText(/新建空白文档/)

  evidence.d9CtaExists = true
})

test('D9：点击后创建空白可编辑文档（编辑态 + 空内容 + 具名页签）', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (e) => pageErrors.push(String(e)))

  await page.goto('/')
  await page.getByTestId('cta-new-blank').click()

  await expect(page.getByTestId('tab-strip')).toBeVisible()
  await expect(page.getByTestId('tab-strip')).toContainText('未命名.md')
  await expect(page.getByTestId('mode-edit-btn')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.cm-editor').first()).toBeVisible()

  const blankText = await editorText(page)
  expect(blankText).toBe('')

  expect(pageErrors).toEqual([])
  evidence.d9CreatesBlankDoc = true
})

test('D10：landing 与工作区渲染 0 条控制台告警（含重复 key）', async ({ page }) => {
  const problems: string[] = []
  page.on('console', (msg) => {
    const type = msg.type()
    if (type !== 'warning' && type !== 'error') return
    const text = msg.text()
    // 过滤预存在的资源 404 噪音（favicon 等）。
    if (text.includes('Failed to load resource')) return
    problems.push(`${type}: ${text}`)
  })

  await page.goto('/')
  await expect(page.getByTestId('landing-nav')).toBeVisible()

  // 打开 .md（编辑态渲染工作区）
  await page.getByTestId('file-input').setInputFiles({
    name: 'd10-a.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# A\n\n正文\n'),
  })
  await expect(page.locator('.cm-editor').first()).toBeVisible()

  // 关闭 → 生成最近文档条目 → Landing 渲染 RecentDocsSection（Landing 键稳定）
  await page.getByRole('button', { name: '关闭 d10-a.md' }).click()
  await expect(page.getByTestId('landing-nav')).toBeVisible()
  await expect(page.locator('[data-testid^="recent-doc-item-"]')).toHaveCount(1)

  // 再开一篇 → 打开左栏「最近」页签 → LeftRail 渲染最近文件（LeftRail 键稳定）
  await page.getByTestId('file-input').setInputFiles({
    name: 'd10-b.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# B\n\n正文\n'),
  })
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await page.getByTestId('left-rail-toggle').click()
  await page.getByTestId('left-rail-tab-recent').click()
  await expect(page.locator('[data-testid^="recent-file-item-"]')).toHaveCount(1)

  await settle(page)
  expect(problems).toEqual([])
  evidence.d10NoWarnings = true
  evidence.d10NoKeyWarnings = !problems.some((p) => /same key|duplicate key/i.test(p))
})

test.describe('窄屏（375px）回归：D1 不改移动端默认预览', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('窄屏打开 .md 仍默认预览（narrow override 保留，v2-mobile 契约不变）', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('file-input').setInputFiles({
      name: 'narrow.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from('# 窄屏\n\n正文\n'),
    })

    await expect(page.getByTestId('mode-pane-preview')).toBeVisible()
    await expect(page.getByTestId('mode-pane-editor')).toBeHidden()
    await expect(page.getByTestId('mode-preview-btn')).toHaveAttribute('aria-pressed', 'true')

    evidence.narrowStillPreview = true
  })
})

test.afterAll(() => {
  writeFileSync(join(RES, 'defect-closure.json'), JSON.stringify(evidence, null, 2) + '\n')
})
