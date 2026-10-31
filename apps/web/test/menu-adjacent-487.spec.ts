// #487：菜单比面板矮时贴着锚点（限高 + 滚动），不要被推到几百像素外。
import { expect, test, type Page } from '@playwright/test'

test.use({ viewport: { width: 1440, height: 820 } })
const DOC = `# T

| A | B |
| --- | --- |
| 1 | 2 |
| 3 | 4 |

尾。
`

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

test('格内菜单贴着单元格且限高可滚动', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'menu-487.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)

  const cell = page.getByTestId('cm-table').locator('td[data-row="1"][data-col="0"]')
  await cell.hover()
  await settle(page)
  await cell.locator('.cm-table-cell-handle').click()
  await settle(page)

  const geo = await page.evaluate(() => {
    const m = document.querySelector('[data-testid="block-handle-menu"]') as HTMLElement
    const h = document.querySelector('td[data-row="1"][data-col="0"] .cm-table-cell-handle') as HTMLElement
    const pane = document.querySelector('.cm-editor') as HTMLElement
    const mr = m.getBoundingClientRect()
    const hr = h.getBoundingClientRect()
    const pr = pane.getBoundingClientRect()
    return {
      menu: { left: mr.left, top: mr.top, bottom: mr.bottom, height: mr.height },
      handle: { x: hr.x, right: hr.right, y: hr.y, center: hr.top + hr.height / 2 },
      pane: { top: pr.top, bottom: pr.bottom },
      maxHeight: m.style.maxHeight,
      overflow: m.style.overflowY,
    }
  })

  // 贴身：水平紧邻手柄
  expect(geo.menu.left - geo.handle.right).toBeGreaterThanOrEqual(-2)
  expect(geo.menu.left - geo.handle.right).toBeLessThanOrEqual(20)
  // 贴锚点：菜单必须覆盖（或紧挨）指针行，而不是被推到几百像素外
  const distance =
    geo.handle.center < geo.menu.top
      ? geo.menu.top - geo.handle.center
      : geo.handle.center > geo.menu.bottom
        ? geo.handle.center - geo.menu.bottom
        : 0
  expect(distance, `指针 ${geo.handle.center} 与菜单 ${geo.menu.top}..${geo.menu.bottom}`).toBeLessThanOrEqual(24)
  // 完整落在面板内
  expect(geo.menu.top).toBeGreaterThanOrEqual(geo.pane.top - 1)
  expect(geo.menu.bottom).toBeLessThanOrEqual(geo.pane.bottom + 1)
  // 放不下时被限高并可滚动
  if (geo.menu.height > 200) {
    expect(geo.maxHeight, '应设置 maxHeight').not.toBe('')
    expect(geo.overflow).toBe('auto')
  }
})
