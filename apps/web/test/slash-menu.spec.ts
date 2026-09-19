// 斜杠菜单定位（#203）e2e：编辑模式下在空行输入 `/`，菜单必须贴合光标行，
// 而不是被编辑器页面原点整体偏移（缺陷：菜单被甩到编辑器右下方）。
// 运行：pnpm --filter @md-bundle/web exec playwright test test/slash-menu.spec.ts
import { expect, test, type Locator, type Page } from '@playwright/test'

// 文末留一个空行作为光标行，使 `/` 满足「词首触发」条件。
const DOC = '# Alpha\n\nBeta paragraph.\n\n'

test.use({ viewport: { width: 1440, height: 900 } })

async function settle(page: Page): Promise<void> {
  // CM6 在 requestAnimationFrame 中完成 measure；冷启动首帧尚未测量时
  // coordsAtPos 返回估算坐标，会导致菜单被放到错误位置。
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
}

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'slash-menu.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

async function boxOf(
  locator: Locator,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox()
  if (!box) throw new Error('element has no bounding box')
  return box
}

test('空行输入 `/` 时菜单贴合光标行，并列出中文命令项', async ({ page }) => {
  await openEditor(page)

  const lines = page.locator('.cm-content .cm-line')
  await lines.last().click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+End' : 'Control+End')
  await settle(page)

  await page.keyboard.type('/')

  const menu = page.locator('.mdb-slash-menu')
  await expect(menu).toBeVisible()
  await expect(menu).toContainText('标题')
  await expect(menu).toContainText('标注')
  await expect(menu).toContainText('代码块')

  const lineBox = await boxOf(lines.last())
  const menuBox = await boxOf(menu)

  // 坐标系回归锁：菜单左缘贴着光标行左缘（±40px），顶部贴着行底（±80px），
  // 而不是被编辑器页面原点甩到右下方。
  expect(Math.abs(menuBox.x - lineBox.x)).toBeLessThan(40)
  const lineBottom = lineBox.y + lineBox.height
  expect(Math.abs(menuBox.y - lineBottom)).toBeLessThan(80)
})
