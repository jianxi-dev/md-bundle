// #377 编辑态 fenced 代码块容器包裹整块：从开启围栏到闭合围栏的每一行都带
// cm-fenced-code 容器类，代码内容行必须共享容器背景（修复前只有语言行有背景，
// 代码行 transparent 溢出圆角容器外）。
// 运行：pnpm --filter @md-bundle/web exec playwright test test/fenced-code-container.spec.ts
import { expect, test, type Page } from '@playwright/test'

const DOC = [
  '前置段落。',
  '',
  '```js',
  'const a = 1',
  'const b = 2',
  '```',
  '',
].join('\n')

test.use({ viewport: { width: 1280, height: 800 } })

/** CM6 在 rAF 中完成 measure —— 装饰断言前跑双 rAF 稳定布局。 */
async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

/** 读取匹配行的计算背景色。 */
async function lineBackground(page: Page, text: string): Promise<string> {
  const loc = page.getByTestId('mode-pane-editor').locator('.cm-line', { hasText: text }).first()
  await expect(loc).toBeVisible()
  return loc.evaluate((el) => getComputedStyle(el).backgroundColor)
}

test('代码内容行共享容器背景，容器包裹整块（#377）', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'fenced-container.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await expect(page.getByTestId('mode-edit-btn')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)

  // 光标默认落在文档起始（前置段落）→ 围栏块非活动态。
  // 容器顶：语言行（含 JS 徽标）有非透明背景。
  const fenceLine = page
    .getByTestId('mode-pane-editor')
    .locator('.cm-line:has(.cm-fenced-code-language)')
    .first()
  const fenceBg = await fenceLine.evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(fenceBg, '语言行背景').not.toBe('rgba(0, 0, 0, 0)')

  // 关键断言：代码内容行必须落在容器内（背景非透明）。
  for (const code of ['const a = 1', 'const b = 2']) {
    const bg = await lineBackground(page, code)
    expect(bg, `代码行「${code}」背景`).not.toBe('rgba(0, 0, 0, 0)')
  }

  // 结构断言：开启围栏行 + 两行代码 + 闭合围栏行，共 4 行带容器类。
  const painted = page.getByTestId('mode-pane-editor').locator('.cm-line.cm-fenced-code')
  await expect(painted).toHaveCount(4)
})
