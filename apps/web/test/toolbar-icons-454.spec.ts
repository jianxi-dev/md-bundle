// #454 回归锁：选区工具栏在选区下方；下拉项都带图标。
//
// 旧行为：工具条常在上方，下拉项（对齐 / 转换）全是纯文字。
//
// 运行：pnpm --filter @md-bundle/web exec playwright test test/toolbar-icons-454.spec.ts
import { expect, test, type Page } from '@playwright/test'

const DOC = `# 标题

UNIQUEWORD 在这里

结尾段落。
`

test.use({ viewport: { width: 1440, height: 900 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'toolbar-454.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
  const line = page.locator('.cm-content .cm-line').filter({ hasText: 'UNIQUEWORD' }).first()
  await line.dblclick()
  await settle(page)
}

test('工具条出现在选区下方', async ({ page }) => {
  await openEditor(page)
  const toolbar = page.locator('.mdb-floating-toolbar')
  await expect(toolbar).toBeVisible()
  const tb = await toolbar.boundingBox()
  const sel = await page.evaluate(() => {
    const s = window.getSelection()
    if (!s || s.rangeCount === 0) return null
    const r = s.getRangeAt(0).getBoundingClientRect()
    return { top: r.top, bottom: r.bottom }
  })
  if (!tb || !sel) throw new Error('missing boxes')
  expect(tb.y, '工具条应在选区下方').toBeGreaterThanOrEqual(sel.bottom - 2)
})

test('工具条的下拉项都带 SVG 图标（含对齐 / 转换 / 分栏清除）', async ({ page }) => {
  await openEditor(page)
  // 下拉菜单在工具条构建时就已生成，不必逐个点开——点开会因为选区丢失而收起，
  // 反而把「图标是否存在」这件事测成「菜单能不能点开」。
  const detail = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.mdb-toolbar-dropdown-option')).map((el) => ({
      text: (el.textContent ?? '').trim(),
      svg: !!el.querySelector('svg[data-icon]'),
    })),
  )
  expect(detail.length, '下拉项总数').toBeGreaterThan(6)
  expect(detail.filter((d) => !d.svg).map((d) => d.text), '缺图标的项').toEqual([])
})
