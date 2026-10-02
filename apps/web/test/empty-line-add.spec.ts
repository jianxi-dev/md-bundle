// 空行「＋」入口（#275 task 2.3）e2e：悬停空行出现「＋」按钮、点击后弹出斜杠菜单、
// 非空行悬停时隐藏按钮。
// 运行：pnpm --filter @md-bundle/web exec playwright test test/empty-line-add.spec.ts
import { expect, test, type Locator, type Page } from '@playwright/test'

// 文档包含：标题 + 空行 + 空行 + 非空段落
// 这样可以测试：空行悬停显示、非空行悬停隐藏
const DOC = '# Alpha\n\n\n\nBeta paragraph.'

test.use({ viewport: { width: 1440, height: 900 } })

async function settle(page: Page): Promise<void> {
  // CM6 在 requestAnimationFrame 中完成 measure；冷启动时首帧尚未测量，
  // coordsAtPos 会返回估算坐标，导致按钮被放到错误位置。
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
}

async function openEditor(page: Page): Promise<void> {
  // Capture console errors
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log('BROWSER ERROR:', msg.text())
    }
  })
  page.on('pageerror', (error) => {
    console.log('BROWSER PAGE ERROR:', error.message)
  })

  await page.goto('/')
  // Wait for the page to load and React to hydrate
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)

  // The file-input is in a hidden div (display: none), but setInputFiles works on hidden file inputs
  await page.getByTestId('file-input').setInputFiles({
    name: 'empty-line-add.md',
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

/** 把鼠标移到目标行内，触发「＋」按钮显示。 */
async function hoverLine(
  page: Page,
  text: string,
): Promise<{ x: number; y: number; height: number }> {
  const line = page.locator('.cm-content .cm-line').filter({ hasText: text })
  await expect(line).toBeVisible()
  const box = await boxOf(line)
  await page.mouse.move(box.x + 20, box.y + box.height / 2)
  return box
}

/** 悬停空行（通过行号定位，因为空行没有文本）。 */
async function hoverEmptyLineByIndex(
  page: Page,
  lineIndex: number,
): Promise<{ x: number; y: number; height: number }> {
  const lines = page.locator('.cm-content .cm-line')
  await expect(lines.nth(lineIndex)).toBeVisible()
  const box = await boxOf(lines.nth(lineIndex))
  await page.mouse.move(box.x + 20, box.y + box.height / 2)
  return box
}

test('悬停空行时「＋」按钮出现', async ({ page }) => {
  await openEditor(page)

  // 文档结构：
  // 第 0 行: # Alpha
  // 第 1 行: (空行)
  // 第 2 行: (空行)
  // 第 3 行: Beta paragraph.
  // 悬停第 1 行（第一个空行）
  await hoverEmptyLineByIndex(page, 1)

  const addBtn = page.getByTestId('empty-line-add')
  await expect(addBtn).toBeVisible()
})

test('点击空行的「＋」后弹出斜杠菜单', async ({ page }) => {
  await openEditor(page)

  // 悬停第 2 行（第二个空行）
  await hoverEmptyLineByIndex(page, 2)

  const addBtn = page.getByTestId('empty-line-add')
  await expect(addBtn).toBeVisible()
  await addBtn.click()

  // 斜杠菜单应该出现
  const menu = page.locator('.mdb-slash-menu')
  await expect(menu).toBeVisible()
  await expect(menu).toContainText('标题')
  await expect(menu).toContainText('标注')
  await expect(menu).toContainText('代码块')
})

test('悬停非空段落行时「＋」按钮隐藏', async ({ page }) => {
  await openEditor(page)

  // 先悬停空行让按钮出现
  await hoverEmptyLineByIndex(page, 1)
  const addBtn = page.getByTestId('empty-line-add')
  await expect(addBtn).toBeVisible()

  // 再悬停非空行（Beta paragraph.）
  await hoverLine(page, 'Beta paragraph.')

  // 按钮应该隐藏
  await expect(addBtn).toBeHidden()
})

test('鼠标移到「＋」按钮上时按钮保持可见', async ({ page }) => {
  await openEditor(page)

  await hoverEmptyLineByIndex(page, 1)

  const addBtn = page.getByTestId('empty-line-add')
  await expect(addBtn).toBeVisible()

  // 移动鼠标到按钮上
  const btnBox = await boxOf(addBtn)
  await page.mouse.move(btnBox.x + btnBox.width / 2, btnBox.y + btnBox.height / 2)

  // 按钮应该保持可见
  await expect(addBtn).toBeVisible()
})

test('鼠标离开编辑器区域时「＋」按钮隐藏', async ({ page }) => {
  await openEditor(page)

  await hoverEmptyLineByIndex(page, 1)

  const addBtn = page.getByTestId('empty-line-add')
  await expect(addBtn).toBeVisible()

  // 移动鼠标到编辑器外部（页面左上角）
  await page.mouse.move(0, 0)

  // 按钮应该隐藏
  await expect(addBtn).toBeHidden()
})
