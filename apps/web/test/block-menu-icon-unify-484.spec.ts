// #484：块菜单每一行都有图标、左内边距一致；删除/复制在全站用同一个图标名。
import { expect, test, type Page } from '@playwright/test'

test.use({ viewport: { width: 1440, height: 1000 } })
const DOC = `# T

正文段落。

尾。
`

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openMenu(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'icons-484.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)

  const line = page.locator('.cm-content .cm-line').filter({ hasText: '正文段落' }).first()
  const box = await line.boundingBox()
  await page.mouse.move(box!.x + 30, box!.y + box!.height / 2)
  await settle(page)
  const handle = page.getByTestId('block-handle')
  const hb = await handle.boundingBox()
  await page.mouse.move(hb!.x + hb!.width / 2, hb!.y + hb!.height / 2)
  await expect(page.getByTestId('block-handle-menu')).toBeVisible()
  await settle(page)
}

test('块菜单每一行都有图标且左内边距一致', async ({ page }) => {
  await openMenu(page)
  const rows = await page.evaluate(() => {
    // 只量可见行：callout-only 行在段落菜单里是 display:none，rect 全 0。
    const items = [...document.querySelectorAll('.mdb-block-handle-menu .mdb-block-handle-item')]
    return items
      .filter((el) => el.getBoundingClientRect().width > 0)
      .map((el) => {
      const r = el.getBoundingClientRect()
      const svg = el.querySelector('svg[data-icon]')
      const sr = svg?.getBoundingClientRect()
        return {
          label: (el.textContent ?? '').trim(),
          icon: svg?.getAttribute('data-icon') ?? null,
          inset: sr ? Math.round(sr.x - r.x) : null,
          dy: sr ? Math.round(sr.y + sr.height / 2 - (r.y + r.height / 2)) : null,
        }
      })
  })
  const missing = rows.filter((row) => !row.icon)
  expect(missing, `缺图标的行: ${JSON.stringify(missing)}`).toEqual([])
  const insets = [...new Set(rows.map((row) => row.inset))]
  expect(insets.length, `左内边距不一致: ${JSON.stringify(rows)}`).toBe(1)
  for (const row of rows) expect(Math.abs(row.dy!), `${row.label} 纵向偏差`).toBeLessThanOrEqual(1)
})

test('删除/复制在全站使用同一图标名', async ({ page }) => {
  await openMenu(page)
  const icons = await page.evaluate(() => {
    const pick = (label: string) => {
      const row = [...document.querySelectorAll('.mdb-block-handle-menu .mdb-block-handle-item')].find(
        (el) => (el.textContent ?? '').trim() === label,
      )
      return row?.querySelector('svg[data-icon]')?.getAttribute('data-icon') ?? null
    }
    return { del: pick('删除'), copy: pick('复制') }
  })
  expect(icons.del).toBe('DeleteTrashOutlined')
  expect(icons.copy).toBe('CopyOutlined')
})
