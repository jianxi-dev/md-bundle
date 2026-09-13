// 大纲多页签 e2e 验收（任务：修复 #73 大纲串扰 + 点击无跳转）。
// serial 模式 + evidence 落盘。
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const here = dirname(fileURLToPath(import.meta.url))
const RES = join(here, '..', 'test-results')

const evidence = {
  tasks: 'outline-multitab',
  openTwoDocs: false,
  switchTabOutlineMatches: false,
  switchBackOutlineMatches: false,
  noCrossContamination: false,
  scrollOnFarHeading: false,
  previewCrosstalk: false,
  previewScrollOnFarHeading: false,
}

test.use({ viewport: { width: 1280, height: 800 } })
test.describe.configure({ mode: 'serial' })

async function openDoc(page: import('@playwright/test').Page, name: string, body: string) {
  await page.getByTestId('file-input').setInputFiles({
    name,
    mimeType: 'text/markdown',
    buffer: Buffer.from(body),
  })
}

async function pinOutline(page: import('@playwright/test').Page) {
  const btn = page.getByTestId('outline-btn')
  await btn.click()
  await expect(page.getByTestId('outline-menu')).toBeVisible()
}

test('打开两个标题结构不同的文档 → 大纲多页签不串扰', async ({ page }) => {
  await page.goto('/')

  const docA = '# A1\n\n内容\n\n## A2\n\n更多\n'
  const docB = '# B1\n\n完全不同\n\n## B2\n\n### B3\n'

  // 打开文档 A → 默认 preview 模式
  await openDoc(page, 'doc-a.md', docA)
  await expect(page.getByTestId('tab-strip').locator('[role="tab"]')).toHaveCount(1)

  // 打开文档 B → 新页签
  await openDoc(page, 'doc-b.md', docB)
  await expect(page.getByTestId('tab-strip').locator('[role="tab"]')).toHaveCount(2)

  // 当前 active 是 doc-b → 切到编辑模式 → 钉住大纲
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await pinOutline(page)

  // 文档 B 应有 3 个标题：B1, B2, B3
  await expect(page.getByTestId('outline-item-0')).toContainText('B1')
  await expect(page.getByTestId('outline-item-1')).toContainText('B2')
  await expect(page.getByTestId('outline-item-2')).toContainText('B3')

  // 不应包含文档 A 的标题
  const menuText = await page.getByTestId('outline-menu').textContent()
  expect(menuText).not.toContain('A1')
  expect(menuText).not.toContain('A2')

  evidence.openTwoDocs = true

  // 切换到文档 A 页签
  await page.getByTestId('tab-strip').getByText('doc-a.md').click()
  await expect(
    page.getByTestId('tab-strip').locator('[role="tab"][aria-selected="true"]'),
  ).toContainText('doc-a.md')

  // key={activeTab.id} 强制重挂 → pinned 重置，需重新钉住
  await page.getByTestId('mode-edit-btn').click()
  await pinOutline(page)

  // 大纲应更新为文档 A 的标题（A1, A2）
  await expect(page.getByTestId('outline-item-0')).toContainText('A1')
  await expect(page.getByTestId('outline-item-1')).toContainText('A2')
  await expect(page.getByTestId('outline-item-2')).toHaveCount(0)

  // 不应包含文档 B 的标题
  const menuTextA = await page.getByTestId('outline-menu').textContent()
  expect(menuTextA).not.toContain('B1')
  expect(menuTextA).not.toContain('B2')
  expect(menuTextA).not.toContain('B3')

  evidence.switchTabOutlineMatches = true
  evidence.noCrossContamination = true

  // 切回文档 B
  await page.getByTestId('tab-strip').getByText('doc-b.md').click()
  await expect(
    page.getByTestId('tab-strip').locator('[role="tab"][aria-selected="true"]'),
  ).toContainText('doc-b.md')

  await page.getByTestId('mode-edit-btn').click()
  await pinOutline(page)

  // 大纲应恢复为文档 B 的标题
  await expect(page.getByTestId('outline-item-0')).toContainText('B1')
  await expect(page.getByTestId('outline-item-1')).toContainText('B2')
  await expect(page.getByTestId('outline-item-2')).toContainText('B3')

  evidence.switchBackOutlineMatches = true
})

test('长文档中点击大纲项 → CM6 滚动到目标行', async ({ page }) => {
  await page.goto('/')

  // 构造长文档：30 行段落 + 目标标题 + 30 行段落
  const lines = ['# 起始']
  for (let i = 0; i < 30; i++) lines.push(`填充行${i}`)
  lines.push('## 远端目标')
  for (let i = 0; i < 30; i++) lines.push(`尾部${i}`)

  await openDoc(page, 'long-scroll.md', lines.join('\n') + '\n')
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await pinOutline(page)

  // 点击「远端目标」（index 1）
  await page.getByTestId('outline-item-1').click()

  // CM6 编辑器 scrollTop 应 > 0
  const scrollEl = page.locator('.cm-editor .cm-scroller')
  const scrollTop = await scrollEl.evaluate((el) => el.scrollTop)
  expect(scrollTop).toBeGreaterThan(0)

  evidence.scrollOnFarHeading = true
})

test('预览模式下大纲不串扰（默认模式）', async ({ page }) => {
  await page.goto('/')

  const docA = '# AAA1\n\n内容 AAA\n\n## AAA2\n\n更多 AAA\n'
  const docB = '# BBB1\n\n完全不同 BBB\n\n## BBB2\n\n### BBB3\n'

  // 打开文档 A → 默认 preview 模式
  await openDoc(page, 'preview-a.md', docA)
  await expect(page.getByTestId('tab-strip').locator('[role="tab"]')).toHaveCount(1)

  // 打开文档 B → 新页签 → 默认 preview 模式
  await openDoc(page, 'preview-b.md', docB)
  await expect(page.getByTestId('tab-strip').locator('[role="tab"]')).toHaveCount(2)

  // 当前 active 是 preview-b → 保持 preview 模式 → 钉住大纲
  await pinOutline(page)

  // 文档 B 应有 3 个标题：BBB1, BBB2, BBB3
  await expect(page.getByTestId('outline-item-0')).toContainText('BBB1')
  await expect(page.getByTestId('outline-item-1')).toContainText('BBB2')
  await expect(page.getByTestId('outline-item-2')).toContainText('BBB3')

  // 不应包含文档 A 的标题
  const menuTextB = await page.getByTestId('outline-menu').textContent()
  expect(menuTextB).not.toContain('AAA1')
  expect(menuTextB).not.toContain('AAA2')

  // 切换到文档 A 页签（仍 preview 模式）
  await page.getByTestId('tab-strip').getByText('preview-a.md').click()
  await expect(
    page.getByTestId('tab-strip').locator('[role="tab"][aria-selected="true"]'),
  ).toContainText('preview-a.md')

  // key={activeTab.id} 强制重挂 → pinned 重置，需重新钉住
  await pinOutline(page)

  // 大纲应更新为文档 A 的标题（AAA1, AAA2）
  await expect(page.getByTestId('outline-item-0')).toContainText('AAA1')
  await expect(page.getByTestId('outline-item-1')).toContainText('AAA2')
  await expect(page.getByTestId('outline-item-2')).toHaveCount(0)

  // 不应包含文档 B 的标题
  const menuTextA = await page.getByTestId('outline-menu').textContent()
  expect(menuTextA).not.toContain('BBB1')
  expect(menuTextA).not.toContain('BBB2')
  expect(menuTextA).not.toContain('BBB3')

  evidence.previewCrosstalk = true
})

test('预览模式下点击大纲项 → 预览面板滚动到目标标题', async ({ page }) => {
  await page.goto('/')

  // 构造长文档：标题 + 大量填充 + 远端目标
  const lines = ['# 顶部标题']
  for (let i = 0; i < 60; i++) lines.push(`填充内容行${i} 占位文字撑开高度`)
  lines.push('## 远端目标标题')
  for (let i = 0; i < 30; i++) lines.push(`尾部内容${i}`)

  await openDoc(page, 'preview-scroll.md', lines.join('\n') + '\n')

  // 默认 preview 模式 → 钉住大纲
  await pinOutline(page)

  // 确认大纲有 2 个标题
  await expect(page.getByTestId('outline-item-0')).toContainText('顶部标题')
  await expect(page.getByTestId('outline-item-1')).toContainText('远端目标标题')

  // 先滚动到顶部确保 baseline
  const previewPane = page.getByTestId('mode-pane-preview')
  await previewPane.evaluate((el) => {
    el.scrollTop = 0
  })

  // 点击「远端目标标题」（index 1）
  await page.getByTestId('outline-item-1').click()

  // 预览面板 scrollTop 应 > 0
  const scrollTop = await previewPane.evaluate((el) => el.scrollTop)
  expect(scrollTop).toBeGreaterThan(0)

  evidence.previewScrollOnFarHeading = true
})

test.afterAll(() => {
  writeFileSync(join(RES, 'v2-outline-multitab.json'), JSON.stringify(evidence, null, 2) + '\n')
})
