// #496：点 callout 正文的某个位置，光标应落在该字符附近，而不是固定末尾。
import { expect, test, type Page } from '@playwright/test'

test.use({ viewport: { width: 1440, height: 1000 } })
const DOC = `# T

> [!NOTE]
> 一二三四五六七八九十，一二三四五六七八九十。

尾。
`

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'caret-496.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

test('点击正文中段：光标落在点击处而不是末尾', async ({ page }) => {
  await openEditor(page)
  const content = page.locator('.cm-callout-content').first()
  await expect(content).toBeVisible()
  const box = (await content.boundingBox())!
  // 点在文本左起约 1/3 处
  await page.mouse.click(box.x + box.width / 3, box.y + box.height / 2)
  await settle(page)

  const state = await page.evaluate(() => {
    const ed = document.querySelector('.cm-callout-editor') as HTMLTextAreaElement | null
    return ed ? { start: ed.selectionStart, len: ed.value.length } : null
  })
  expect(state, '应打开正文编辑器').not.toBeNull()
  expect(state!.len).toBeGreaterThan(10)
  // 不是末尾
  expect(state!.start).toBeLessThan(state!.len - 2)
  // 落在中段附近（容差放宽到 ±8 字符，避免字体测量差异）
  const expected = Math.round(state!.len / 3)
  expect(Math.abs(state!.start - expected), `start=${state!.start} expected≈${expected}`).toBeLessThanOrEqual(8)
})
