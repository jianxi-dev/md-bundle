// #399 回归锁：表格左上角一个圆点，悬停放大成「+」，点击打开插入菜单。
//
// 参照产品在表格左上角只有一个入口点；键盘可达（Enter/Space）。
//
// 运行：pnpm --filter @md-bundle/web exec playwright test test/table-anchor-399.spec.ts
import { expect, test, type Page } from '@playwright/test'

const DOC = `# 表格

| A | B |
| --- | --- |
| A1 | B1 |

结尾段落。
`

test.use({ viewport: { width: 1440, height: 1000 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'table-anchor-399.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

test('表格左上角有锚点圆点，悬停放大成「+」', async ({ page }) => {
  await openEditor(page)
  const anchor = page.getByTestId('cm-table-anchor').first()
  await expect(anchor).toBeAttached()

  const table = page.getByTestId('cm-table').first()
  const tb = await table.boundingBox()
  const ab = await anchor.boundingBox()
  if (!tb || !ab) throw new Error('missing boxes')

  // 贴在表格左上角（wrap 有 overflow，锚点必须在可视区内）
  expect(ab.y, '锚点纵向贴表格顶').toBeLessThanOrEqual(tb.y + 6)
  expect(ab.x, '锚点横向贴表格左').toBeLessThanOrEqual(tb.x + 6)

  const sizeBefore = Math.round(ab.width)
  await anchor.hover()
  await settle(page)
  const after = await anchor.boundingBox()
  if (!after) throw new Error('no box after hover')
  expect(Math.round(after.width), '悬停后变大').toBeGreaterThan(sizeBefore)
  await expect(anchor).toHaveText('＋')
})

test('点击锚点打开插入菜单', async ({ page }) => {
  await openEditor(page)
  const anchor = page.getByTestId('cm-table-anchor').first()
  await anchor.click()
  await settle(page)
  await expect(page.locator('.mdb-slash-menu')).toBeVisible()
})

test('键盘 Enter 也能打开插入菜单', async ({ page }) => {
  await openEditor(page)
  const anchor = page.getByTestId('cm-table-anchor').first()
  await anchor.focus()
  await page.keyboard.press('Enter')
  await settle(page)
  await expect(page.locator('.mdb-slash-menu')).toBeVisible()
})

test('圆点位于表格上方外侧，hover 才显示 ＋（#495）', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'anchor-495.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# T\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n'),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()

  // 等过入场过渡，避免量到中间帧
  await page.waitForTimeout(400)
  const geo = await page.evaluate(() => {
    const a = document.querySelector('.cm-table-anchor') as HTMLElement
    const t = document.querySelector('table.cm-table') as HTMLElement
    const ar = a.getBoundingClientRect()
    const tr = t.getBoundingClientRect()
    return {
      fontSizeRest: getComputedStyle(a).fontSize,
      widthRest: Math.round(a.getBoundingClientRect().width),
      anchorBottom: ar.bottom,
      tableTop: tr.top,
      anchorLeft: ar.left,
      tableLeft: tr.left,
    }
  })
  // 静止态：字号趋近 0 → 只有一个圆点，没有 ＋（有 CSS 过渡，取范围判断）
  expect(geo.widthRest, '静止是 12px 圆点').toBe(12)
  expect(parseFloat(geo.fontSizeRest), `rest fontSize=${geo.fontSizeRest}`).toBeLessThan(6)
  // 圆点位于表格上边框之上（或与之齐平），不再压在表头里
  expect(geo.anchorBottom).toBeLessThanOrEqual(geo.tableTop + 1)
  expect(Math.abs(geo.anchorLeft - geo.tableLeft)).toBeLessThanOrEqual(12)

  await page.locator('.cm-table-anchor').hover()
  await page.waitForTimeout(350)
  const hoverFont = await page.evaluate(
    () => getComputedStyle(document.querySelector('.cm-table-anchor') as HTMLElement).fontSize,
  )
  expect(parseFloat(hoverFont), `hover fontSize=${hoverFont}（应显示 ＋）`).toBeGreaterThan(9)
})
