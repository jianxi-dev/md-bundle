// #321 编辑=预览（W0，非破坏对齐）：编辑态与预览态逐块计算样式相等。
// 断言排版（font-size/font-weight/color/line-height）在编辑态装饰类
// （.cm-heading.cm-h2 等）与预览态语义元素（h2 等）之间相等；断言盒模型
// （含 width）在编辑态块容器（.cm-line / widget）与预览态块元素之间相等。
// 运行：pnpm --filter @md-bundle/web exec playwright test test/render-parity.spec.ts
import { expect, test, type Page } from '@playwright/test'

const DOC = `# 标题一

段落文本。

- 列表项一
- 列表项二
- 列表项三

## 标题二

\`\`\`js
const x = 42
\`\`\`

> 引用块文本

| A | B |
| --- | --- |
| 1 | 2 |
| 3 | 4 |

> [!NOTE]
> 注释内容
`

test.use({ viewport: { width: 1440, height: 900 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'render-parity.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

async function getComputedStyles(
  page: Page,
  selector: string,
  props: string[],
): Promise<Record<string, string>> {
  const loc = page.locator(selector).first()
  await expect(loc).toBeVisible()
  return loc.evaluate((el, ps) => {
    const cs = getComputedStyle(el)
    const out: Record<string, string> = {}
    for (const p of ps) out[p] = cs.getPropertyValue(p)
    return out
  }, props)
}

test.describe('编辑=预览：计算样式相等', () => {
  test('标题（h2）排版 + 宽度相等', async ({ page }) => {
    await openEditor(page)

    const typoProps = ['font-size', 'font-weight', 'color', 'line-height', 'letter-spacing']
    const editTypo = await getComputedStyles(
      page,
      '.cm-content .cm-heading.cm-h2',
      typoProps,
    )
    const editWidth = await getComputedStyles(
      page,
      '.cm-content .cm-line:has(.cm-heading.cm-h2)',
      ['width'],
    )

    await page.getByTestId('mode-preview-btn').click()
    await expect(page.locator('.preview-content')).toBeVisible()
    await settle(page)

    const previewStyles = await getComputedStyles(
      page,
      '.preview-content h2',
      [...typoProps, 'width'],
    )

    for (const prop of typoProps) {
      expect(editTypo[prop], `h2 ${prop}`).toBe(previewStyles[prop])
    }
    expect(editWidth['width'], 'h2 width').toBe(previewStyles['width'])
  })

  test('列表（ul）排版 + 宽度相等', async ({ page }) => {
    await openEditor(page)

    const props = ['list-style-type', 'padding-inline-start', 'width']
    const editStyles = await getComputedStyles(
      page,
      '.cm-content .cm-line.cm-list',
      props,
    )

    await page.getByTestId('mode-preview-btn').click()
    await expect(page.locator('.preview-content')).toBeVisible()
    await settle(page)

    const previewStyles = await getComputedStyles(page, '.preview-content ul', props)

    for (const prop of props) {
      expect(editStyles[prop], `ul ${prop}`).toBe(previewStyles[prop])
    }
  })

  test('代码块（.code-block）排版 + 宽度相等', async ({ page }) => {
    await openEditor(page)

    const props = ['font-family', 'font-size', 'background-color', 'border-radius', 'width']
    const editStyles = await getComputedStyles(
      page,
      '.cm-content .cm-line.cm-fenced-code',
      props,
    )

    await page.getByTestId('mode-preview-btn').click()
    await expect(page.locator('.preview-content')).toBeVisible()
    await settle(page)

    const previewStyles = await getComputedStyles(
      page,
      '.preview-content .code-block',
      props,
    )

    for (const prop of props) {
      expect(editStyles[prop], `.code-block ${prop}`).toBe(previewStyles[prop])
    }
  })

  test('引用块（blockquote）排版 + 宽度相等', async ({ page }) => {
    await openEditor(page)

    const props = ['border-inline-start-width', 'padding-inline-start', 'width']
    const editStyles = await getComputedStyles(
      page,
      '.cm-content .cm-line.cm-quote',
      props,
    )

    await page.getByTestId('mode-preview-btn').click()
    await expect(page.locator('.preview-content')).toBeVisible()
    await settle(page)

    const previewStyles = await getComputedStyles(
      page,
      '.preview-content blockquote',
      props,
    )

    for (const prop of props) {
      expect(editStyles[prop], `blockquote ${prop}`).toBe(previewStyles[prop])
    }
  })

  test('表格（table）排版 + 宽度相等', async ({ page }) => {
    await openEditor(page)

    const props = ['border-collapse', 'font-size', 'width']
    const editStyles = await getComputedStyles(page, '.cm-content .cm-table', props)

    await page.getByTestId('mode-preview-btn').click()
    await expect(page.locator('.preview-content')).toBeVisible()
    await settle(page)

    const previewStyles = await getComputedStyles(page, '.preview-content table', props)

    for (const prop of props) {
      expect(editStyles[prop], `table ${prop}`).toBe(previewStyles[prop])
    }
  })

  test('高亮块（callout）排版 + 宽度相等', async ({ page }) => {
    await openEditor(page)

    const props = ['border-inline-start-width', 'border-radius', 'padding-top', 'padding-inline', 'width']
    const editStyles = await getComputedStyles(page, '.cm-content .cm-callout', props)

    await page.getByTestId('mode-preview-btn').click()
    await expect(page.locator('.preview-content')).toBeVisible()
    await settle(page)

    const previewStyles = await getComputedStyles(page, '.preview-content .callout', props)

    for (const prop of props) {
      expect(editStyles[prop], `callout ${prop}`).toBe(previewStyles[prop])
    }
  })
})

test.describe('活动块源码桥', () => {
  test('光标进入标题块显示源码标记，移走后回渲染态无残留', async ({ page }) => {
    await openEditor(page)

    const heading = page.locator('.cm-content .cm-heading.cm-h2')
    await expect(heading).toBeVisible()

    await heading.click()
    await page.waitForTimeout(300)
    await settle(page)

    const activeMarker = page.locator('.cm-content .cm-heading-marker-active')
    await expect(activeMarker.first()).toBeVisible()

    const paraLine = page.locator('.cm-content .cm-line').filter({ hasText: '段落文本' })
    await paraLine.click()
    await page.waitForTimeout(300)
    await settle(page)

    expect(await page.locator('.cm-content .cm-heading-marker-active').count()).toBe(0)
    await expect(page.locator('.cm-content .cm-heading.cm-h2')).toBeVisible()
  })
})

test.describe('编辑态装饰形态（DOM 契约保持）', () => {
  test('装饰类与 DOM 结构保持不变', async ({ page }) => {
    await openEditor(page)

    await expect(page.locator('.cm-content .cm-line').first()).toBeVisible()
    await expect(page.locator('.cm-content .cm-heading.cm-h2')).toBeVisible()
    await expect(page.locator('.cm-content .cm-line.cm-list').first()).toBeVisible()
    await expect(page.locator('.cm-content .cm-line.cm-fenced-code')).toBeVisible()
    await expect(
      page.locator('.cm-content .cm-line.cm-quote').filter({ hasText: '引用块文本' }),
    ).toBeVisible()

    await expect(page.getByTestId('cm-table')).toBeVisible()
    await expect(page.locator('.cm-callout')).toBeVisible()

    expect(await page.locator('.mdb-render-block').count()).toBe(0)
  })
})
