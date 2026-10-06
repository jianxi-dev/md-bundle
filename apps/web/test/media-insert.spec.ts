// #389：斜杠插入菜单的「图片引用」「视频/文件」必须弹出真实文件选择窗，选中后以
// 可编辑 `![name](name.ext)` 引用插入；表格单元格插入菜单的同类行同理。被选文件还要
// 作为资产入库，引用才能在预览/导出里解析。
// 运行：pnpm --filter @md-bundle/web exec playwright test test/media-insert.spec.ts
import { expect, test, type Page } from '@playwright/test'

test.use({ viewport: { width: 1440, height: 900 } })

// 1×1 透明 PNG（最小合法图像，避免依赖磁盘 fixture）。
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

const PNG = {
  name: 'photo.png',
  mimeType: 'image/png',
  buffer: Buffer.from(PNG_BASE64, 'base64'),
}

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page, doc: string): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'media-insert.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(doc),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

async function placeEnd(page: Page): Promise<void> {
  await page.locator('.cm-content').click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+End' : 'Control+End')
  await settle(page)
}

/** Switch to source mode to read the raw markdown, then back to edit. */
async function rawDoc(page: Page): Promise<string> {
  await page.getByTestId('mode-source-btn').click()
  await expect(page.locator('.cm-content').first()).toBeVisible()
  const text = await page.locator('.cm-content').first().innerText()
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  return text
}

function rootRows(page: Page) {
  return page.locator('.mdb-slash-grid-menu .mdb-slash-item')
}

/**
 * Click a root menu row by coordinates: its mousedown handler tears the menu
 * down, so Playwright's actionability-retrying `.click()` would race the detach.
 */
async function clickRow(page: Page, label: string): Promise<void> {
  const box = await rootRows(page).filter({ hasText: label }).boundingBox()
  if (!box) throw new Error(`row not found: ${label}`)
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
}

test.describe('媒体插入（#389）', () => {
  test('斜杠「图片引用」弹出真实选择窗，插入可编辑引用且资产可被预览解析', async ({ page }) => {
    await openEditor(page, '# Title\n\nBody.\n')
    await placeEnd(page)
    await page.keyboard.type('/')
    await expect(page.locator('.mdb-slash-menu')).toBeVisible()
    await page.keyboard.type('img')
    await expect(rootRows(page)).toHaveCount(1)
    await expect(rootRows(page).first()).toContainText('图片引用')

    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      clickRow(page, '图片引用'),
    ])
    await chooser.setFiles(PNG)
    await settle(page)

    const raw = await rawDoc(page)
    expect(raw).toContain('![photo.png](photo.png)')
    expect(raw).not.toContain('/img')

    await page.getByTestId('mode-preview-btn').click()
    await expect(page.locator('.preview-content img[src^="data:image/png"]')).toHaveCount(1)
  })

  test('斜杠「视频/文件」弹出选择窗并插入引用', async ({ page }) => {
    await openEditor(page, '# Title\n\nBody.\n')
    await placeEnd(page)
    await page.keyboard.type('/')
    await page.keyboard.type('v')
    await expect(rootRows(page)).toHaveCount(1)
    await expect(rootRows(page).first()).toContainText('视频/文件')

    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      clickRow(page, '视频/文件'),
    ])
    await chooser.setFiles({
      name: 'clip.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.from('fake-mp4-bytes'),
    })
    await settle(page)

    const raw = await rawDoc(page)
    expect(raw).toContain('![clip.mp4](clip.mp4)')
    expect(raw).not.toContain('/v')
  })

  test('表格单元格插入菜单「图片引用」有真实动作，写入单元格', async ({ page }) => {
    await openEditor(page, '# Title\n\n| A | B |\n| --- | --- |\n|  |  |\n')

    const cell = page.getByTestId('cm-table').locator('td[data-row="0"][data-col="0"]')
    await expect(cell).toBeVisible()
    await cell.hover()
    await settle(page)

    await page.getByTestId('cm-table-cell-handle').first().hover()
    await settle(page)
    await expect(page.getByTestId('slash-menu')).toBeVisible()

    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      clickRow(page, '图片引用'),
    ])
    await chooser.setFiles(PNG)
    await settle(page)

    const raw = await rawDoc(page)
    expect(raw).toContain('![photo.png](photo.png)')
  })

  test('page.setInputFiles 直填文件输入 → 插入引用（确定性 headless 路径）', async ({ page }) => {
    // 阻止真实系统文件窗，直接对隐藏 input 调用 setInputFiles（触发 change），
    // 以确定性方式验证「选择文件 → 插入引用」的下游链路。
    await page.addInitScript(() => {
      HTMLInputElement.prototype.click = function () {}
    })
    await openEditor(page, '# Title\n\nBody.\n')
    await placeEnd(page)
    await page.keyboard.type('/')
    await page.keyboard.type('img')
    await expect(rootRows(page)).toHaveCount(1)

    await clickRow(page, '图片引用')
    await page.locator('[data-testid="media-file-input"]').setInputFiles(PNG)
    await settle(page)

    const raw = await rawDoc(page)
    expect(raw).toContain('![photo.png](photo.png)')
    expect(raw).not.toContain('/img')
  })

  test('用户取消原生选择窗后 /query 无残留', async ({ page }) => {
    // 阻止真实系统文件窗，让用例直接驱动 input 的 cancel 事件（浏览器关闭选择窗时触发）。
    await page.addInitScript(() => {
      HTMLInputElement.prototype.click = function () {}
    })
    await openEditor(page, '# Title\n\nBody.\n')
    await placeEnd(page)
    await page.keyboard.type('/')
    await page.keyboard.type('img')
    await expect(rootRows(page)).toHaveCount(1)

    await clickRow(page, '图片引用')
    await settle(page)
    await page.locator('[data-testid="media-file-input"]').dispatchEvent('cancel')
    await settle(page)

    await expect(page.locator('.mdb-slash-menu')).toHaveCount(0)
    const raw = await rawDoc(page)
    expect(raw).not.toContain('/')
    expect(raw).not.toContain('img')
  })
})
