// #482：点击格内手柄后，块菜单必须出现在手柄旁边 —— 不在编辑器左上角。
//
// 旧行为：mousedown 里读 handle.getBoundingClientRect()，此时 CM6 已重建表格
// widget，handle 被 detach，rect 全 0 → 菜单按 (0,0) 定位并夹到面板角落。
import { expect, test, type Page } from '@playwright/test'

test.use({ viewport: { width: 1440, height: 1000 } })

const DOC = `# T

| A | B | C |
| --- | --- | --- |
| 1 | 2 | 3 |
| 4 | 5 | 6 |

尾。
`

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

test('格内手柄菜单贴着单元格出现且不越出编辑面板', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'cell-menu-482.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)

  const cell = page.getByTestId('cm-table').locator('td[data-row="1"][data-col="0"]')
  await cell.hover()
  await settle(page)
  const handle = cell.locator('.cm-table-cell-handle')
  const hb = await handle.boundingBox()
  expect(hb, '手柄应可见').not.toBeNull()
  await handle.click()
  await settle(page)

  const geo = await page.evaluate(() => {
    const m = document.querySelector('[data-testid="block-handle-menu"]') as HTMLElement
    const pane = document.querySelector('.cm-editor') as HTMLElement
    const mr = m.getBoundingClientRect()
    const pr = pane.getBoundingClientRect()
    return {
      display: getComputedStyle(m).display,
      menu: { left: mr.left, top: mr.top, bottom: mr.bottom },
      pane: { top: pr.top, bottom: pr.bottom },
    }
  })
  expect(geo.display).toBe('block')
  // 不再落在面板左上角
  expect(geo.menu.left, '菜单不应贴左边缘').toBeGreaterThan(geo.pane.top > 0 ? 100 : 100)
  expect(geo.menu.top).toBeGreaterThan(geo.pane.top - 1)
  // 贴着单元格右侧（允许 0–20px 间距）
  const gap = geo.menu.left - (hb!.x + hb!.width)
  expect(gap).toBeGreaterThanOrEqual(-2)
  expect(gap).toBeLessThanOrEqual(20)
  // 完整落在面板内
  expect(geo.menu.bottom).toBeLessThanOrEqual(geo.pane.bottom + 1)
})
