// #466：块菜单纵向以指针行为中心，并按编辑面板（overflow:hidden）边界夹取。
//
// 关键回归：菜单挂在 view.dom 下（rect 顶边为 0），真正裁剪的是上层 .cm-editor。
// 按 view.dom 判断「放得下」会把菜单推到面板上沿之外，转换为网格整块被裁掉。
import { expect, test, type Page } from '@playwright/test'

test.use({ viewport: { width: 1440, height: 1000 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page, doc: string): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'menu-466.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(doc),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

interface Geo {
  menuTop: number
  menuBottom: number
  menuCenter: number
  pointerY: number
  paneTop: number
  paneBottom: number
}

async function openMenuOnLine(page: Page, text: string): Promise<Geo> {
  const line = page.locator('.cm-content .cm-line').filter({ hasText: text }).first()
  await expect(line).toBeVisible()
  const box = await line.boundingBox()
  if (!box) throw new Error('no line box')
  await page.mouse.move(box.x + 40, box.y + box.height / 2)
  await settle(page)

  const handle = page.getByTestId('block-handle')
  await expect(handle).toBeVisible()
  const hb = await handle.boundingBox()
  if (!hb) throw new Error('no handle box')
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2)
  await expect(page.getByTestId('block-handle-menu')).toBeVisible()
  await settle(page)

  return page.evaluate(() => {
    const m = document.querySelector('[data-testid="block-handle-menu"]')!.getBoundingClientRect()
    const h = document.querySelector('[data-testid="block-handle"]')!.getBoundingClientRect()
    const pane = document.querySelector('.cm-editor')!.getBoundingClientRect()
    return {
      menuTop: m.top,
      menuBottom: m.bottom,
      menuCenter: m.top + m.height / 2,
      pointerY: h.top + h.height / 2,
      paneTop: pane.top,
      paneBottom: pane.bottom,
    }
  })
}

const DOC = `# 顶部标题

段落一。

段落二。

段落三。

段落四。

段落五。

段落六。

段落七。

段落八。

段落九。

段落十。
`

test('菜单纵向中点贴着指针（放不下时退回顶端对齐）', async ({ page }) => {
  await openEditor(page, DOC)
  const geo = await openMenuOnLine(page, '段落四')
  // 放得下 → 中点对齐指针行；放不下 → 顶边贴指针行（flip/clamp 分支）。
  const centered = Math.abs(geo.menuCenter - geo.pointerY) <= 12
  const topAligned = Math.abs(geo.menuTop - geo.pointerY) <= 20
  expect(centered || topAligned, `中点 ${geo.menuCenter} / 指针 ${geo.pointerY}`).toBe(true)
})

test('菜单不被编辑面板裁切，且转换为网格可点击', async ({ page }) => {
  await openEditor(page, DOC)
  const geo = await openMenuOnLine(page, '段落四')
  expect(geo.menuTop, '菜单顶不得越过面板上沿').toBeGreaterThanOrEqual(geo.paneTop - 1)
  expect(geo.menuBottom, '菜单底不得越过面板下沿').toBeLessThanOrEqual(geo.paneBottom + 1)

  const h2 = page.locator('[data-convert="h2"]').first()
  await expect(h2).toBeVisible()
  await h2.click()
  await settle(page)
  const text = await page.locator('.cm-content').first().innerText()
  expect(text).toContain('二级' in {} ? '' : '')
  await expect(page.locator('.cm-content')).toContainText('## 段落四')
})

test('底部触发时菜单完整落在面板内', async ({ page }) => {
  await openEditor(page, DOC)
  const geo = await openMenuOnLine(page, '段落十')
  expect(geo.menuTop).toBeGreaterThanOrEqual(geo.paneTop - 1)
  expect(geo.menuBottom).toBeLessThanOrEqual(geo.paneBottom + 1)
})
