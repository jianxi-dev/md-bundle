// #391 回归锁：空行「+」按 豆包 的尺寸/位置对齐，悬停有反馈。
import { expect, test, type Page } from '@playwright/test'

const DOC = '# 标题\n\n正文段落。\n\n'
test.use({ viewport: { width: 1440, height: 900 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

test('空行「+」为 20×20、与块手柄同列、悬停有背景', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'empty-391.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)

  // 悬停第一个空行（正文段落之前那一行），让「+」出现
  const emptyLine = page.locator('.cm-content .cm-line').nth(1)
  const lb = await emptyLine.boundingBox()
  if (!lb) throw new Error('no empty line box')
  await page.mouse.move(lb.x + 20, lb.y + Math.max(1, lb.height / 2))
  await settle(page)

  const add = page.getByTestId('empty-line-add')
  await expect(add).toBeVisible()
  const box = await add.boundingBox()
  if (!box) throw new Error('no add box')
  expect(Math.round(box.width), '「+」宽度').toBe(20)
  expect(Math.round(box.height), '「+」高度').toBe(20)

  const bgBefore = await add.evaluate((el) => getComputedStyle(el).backgroundColor)
  await add.hover()
  await settle(page)
  const bgAfter = await add.evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(bgAfter, '悬停应有背景反馈').not.toBe(bgBefore)
})
