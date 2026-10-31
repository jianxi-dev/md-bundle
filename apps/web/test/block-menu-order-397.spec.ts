// #397 回归锁：块菜单动作区按豆包分区顺序排列。
//
// 旧顺序：评论/剪切/翻译/分享/复制链接/在下方添加/上移/下移/复制/删除 —— 分享夹在操作中间、
// 复制与删除被挤到末尾。豆包是「操作 → 分享 → 在下方添加」。
//
// 运行：pnpm --filter @md-bundle/web exec playwright test test/block-menu-order-397.spec.ts
import { expect, test, type Page } from '@playwright/test'

const DOC = `# 标题

正文段落。

结尾段落。
`

test.use({ viewport: { width: 1440, height: 1000 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openMenu(page: Page) {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'menu-order-397.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)

  const line = page.locator('.cm-content .cm-line').filter({ hasText: '正文段落' }).first()
  const box = await line.boundingBox()
  if (!box) throw new Error('no line box')
  await page.mouse.move(box.x + 10, box.y + box.height / 2)
  await settle(page)
  await page.locator('.mdb-block-handle').click()
  await settle(page)
  return page.getByTestId('block-handle-menu')
}

test('动作区按「操作 → 分享 → 在下方添加」排列', async ({ page }) => {
  const menu = await openMenu(page)
  const labels = await menu
    .locator('.mdb-block-handle-item .mdb-block-handle-item-label')
    .allInnerTexts()
  const actionLabels = labels.map((l) => l.trim()).filter((l) => l !== '')

  // 只比对动作区（转为网格的按钮是 data-convert，不在这个 label 列表里）。
  const tail = actionLabels.slice(actionLabels.indexOf('评论'))
  expect(tail).toEqual([
    '评论',
    '剪切',
    '复制',
    '翻译',
    '上移',
    '下移',
    '删除',
    '分享',
    '复制链接',
    '在下方添加',
  ])
})

test('动作全部仍然可用（数量不变）', async ({ page }) => {
  const menu = await openMenu(page)
  for (const label of ['评论', '剪切', '复制', '翻译', '上移', '下移', '删除', '分享', '复制链接', '在下方添加']) {
    await expect(menu.getByRole('button', { name: label, exact: true })).toHaveCount(1)
  }
})
