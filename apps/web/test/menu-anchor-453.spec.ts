// #453 回归锁：块菜单贴着触发位置出现，而不是跳到块顶。
//
// 软换行的长段落是一个块、多条可视行；旧实现按 block.from（首行）定位菜单，
// 在第二行唤起手柄时菜单会跳回首行，读作「不跟随」。
//
// 运行：pnpm --filter @md-bundle/web exec playwright test test/menu-anchor-453.spec.ts
import { expect, test, type Page } from '@playwright/test'

const LONG = '这是一段很长的正文用来触发软换行'.repeat(8)
const DOC = `# 标题\n\n${LONG}\n`

test.use({ viewport: { width: 720, height: 900 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

test('在长段落的第二可视行唤起菜单，菜单贴该行而不是跳回首行', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'menu-anchor-453.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)

  const para = page.locator('.cm-content .cm-line').filter({ hasText: '这是一段很长的正文' }).first()
  const box = await para.boundingBox()
  if (!box) throw new Error('no paragraph box')
  // 段落至少两行，取第二行的高度位置
  expect(box.height, '段落应软换行').toBeGreaterThan(40)
  const secondRowY = box.y + box.height * 0.75
  await page.mouse.move(box.x + 20, secondRowY)
  await settle(page)

  const handle = page.locator('.mdb-block-handle')
  await expect(handle).toBeVisible()
  await handle.click()
  await settle(page)

  const menu = page.getByTestId('block-handle-menu')
  await expect(menu).toBeVisible()
  const mb = await menu.boundingBox()
  if (!mb) throw new Error('no menu box')

  // #466：菜单以触发所在的可视行为中心；因此它的中点必须贴近第二行，
  // 而不是像 #453 之前那样落在整段顶部。
  const menuCenter = mb.y + mb.height / 2
  const hoveredRowY = secondRowY
  const centred = Math.abs(menuCenter - hoveredRowY) <= 12
  const nearRow = Math.abs(mb.y - hoveredRowY) <= mb.height * 0.5 + 40
  expect(centred || nearRow, '菜单不应跳回段落顶部').toBe(true)
})
