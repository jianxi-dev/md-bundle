// #398 回归锁：代码块三件事 —— 预览自动换行、编辑态有语法高亮、两侧高亮配色一致。
//
// 做法：编辑器和预览都用 `classHighlighter`（输出 `tok-*` 类），配色只由 readerCss 一套规则提供，
// 所以「一致」是被构造出来的，不是两边各调一次。
//
// 运行：pnpm --filter @md-bundle/web exec playwright test test/code-block-398.spec.ts
import { expect, test, type Page } from '@playwright/test'

const LONG = 'const veryLongIdentifierThatDefinitelyExceedsTheEditorWidthWhenRenderedInAParagraphOrACodeFence = 1'

const DOC = `# 代码

\`\`\`js
function greet(name) {
  return 'hello ' + name
}
${LONG}
\`\`\`

结尾段落。
`

test.use({ viewport: { width: 1000, height: 1000 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'code-398.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

test('预览态代码块自动换行', async ({ page }) => {
  await openEditor(page)
  await page.getByTestId('mode-preview-btn').click()
  await expect(page.locator('.preview-content').first()).toBeVisible()
  await settle(page)

  const pre = page.locator('.preview-content pre').first()
  const style = await pre.evaluate((el) => {
    const cs = getComputedStyle(el)
    return { whiteSpace: cs.whiteSpace, overflowWrap: cs.overflowWrap }
  })
  expect(style.whiteSpace).toBe('pre-wrap')
  expect(style.overflowWrap).toBe('anywhere')
})

test('编辑态有语法高亮，且与预览同色', async ({ page }) => {
  await openEditor(page)
  const editorKeyword = page.locator('.cm-content .tok-keyword').first()
  await expect(editorKeyword).toHaveCount(1)
  const editorColor = await editorKeyword.evaluate((el) => getComputedStyle(el).color)

  await page.getByTestId('mode-preview-btn').click()
  await expect(page.locator('.preview-content').first()).toBeVisible()
  await settle(page)
  const previewKeyword = page.locator('.preview-content .tok-keyword').first()
  await expect(previewKeyword).toHaveCount(1)
  const previewColor = await previewKeyword.evaluate((el) => getComputedStyle(el).color)

  expect(editorColor).toBe(previewColor)
  // 高亮存在但颜色不能退回正文默认色
  const bodyColor = await page
    .locator('.preview-content')
    .first()
    .evaluate((el) => getComputedStyle(el).color)
  expect(editorColor).not.toBe(bodyColor)
})
