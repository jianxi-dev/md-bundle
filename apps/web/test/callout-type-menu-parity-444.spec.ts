// #444 回归锁：高亮块类型的「插入菜单」与「转换菜单」必须同源同名同图标。
//
// 旧实现两套数据源：插入菜单 8 项 + 固定 SVG 图标；转换菜单 13 项 + emoji。
// 现在两边都从 CALLOUT_EDIT_TYPES 生成，本用例逐项对账。
//
// 运行：pnpm --filter @md-bundle/web exec playwright test test/callout-type-menu-parity-444.spec.ts
import { expect, test, type Page } from '@playwright/test'

const DOC = `# 标注

> [!NOTE]
> 正文

结尾段落。
`

test.use({ viewport: { width: 1440, height: 1200 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'callout-parity-444.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

async function rowsOf(page: Page, selector: string): Promise<string[]> {
  return page.locator(selector).evaluateAll((els) =>
    els.map((el) => {
      const icon = (el.querySelector('[class$="-icon"]')?.textContent ?? '').trim()
      const all = (el.textContent ?? '').trim()
      // The label is a child span in the slash flyout and a bare text node in the
      // block flyout; strip the leading glyph from the whole text either way.
      const label = all.startsWith(icon) ? all.slice(icon.length).trim() : all
      return `${icon}|${label}`
    }),
  )
}

test('插入菜单的「标注」子项与块菜单「类型」逐项一致', async ({ page }) => {
  await openEditor(page)

  // 插入菜单：/ → 标注 → 子项
  await page.locator('.cm-content .cm-line').filter({ hasText: '结尾段落' }).first().click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+End' : 'Control+End')
  await settle(page)
  await page.keyboard.type('/')
  await settle(page)
  await page.keyboard.type('bz')
  await settle(page)
  const rootRow = page.locator('.mdb-slash-grid-menu .mdb-slash-item').first()
  await rootRow.hover()
  await settle(page)
  const insertRows = await rowsOf(page, '.mdb-slash-flyout-item')
  expect(insertRows.length, '插入菜单标注子项数').toBe(13)

  // 关掉插入菜单，改开块菜单的「类型」
  await page.keyboard.press('Escape')
  await settle(page)
  await page.keyboard.press('Escape')
  await settle(page)

  const callout = page.locator('.cm-callout').first()
  const box = await callout.boundingBox()
  if (!box) throw new Error('no callout box')
  await page.mouse.move(box.x - 30, box.y + 10)
  await settle(page)
  if (!(await page.locator('.mdb-block-handle').isVisible())) {
    await callout.click()
    await settle(page)
    await page.keyboard.press('Escape')
    await settle(page)
    await page.mouse.move(box.x - 30, box.y + 10)
    await settle(page)
  }
  await page.locator('.mdb-block-handle').click()
  await settle(page)
  const typeRow = page.locator('.mdb-block-handle-item', { hasText: '类型' }).first()
  await typeRow.hover()
  await settle(page)
  const convertRows = await rowsOf(page, '.mdb-block-handle-flyout-item')

  expect(convertRows.length, '转换菜单类型项数').toBe(13)
  expect(insertRows, '两侧 (图标|标签) 序列应完全一致').toEqual(convertRows)
})
