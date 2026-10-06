// #334（change editor-fidelity 6.3）：视频/文件嵌入卡片 + Mermaid 流程图的编辑态保真，
// 以及 HTML 导出含渲染后的图。断言编辑态 DOM（widget 替换原始语法）与导出产物
// （真实 renderMarkdown + hydrateLazyFeatures 管线）。
// 运行：pnpm --filter @md-bundle/web exec playwright test test/media-flowchart.spec.ts
import { expect, test, type Page } from '@playwright/test'

const DOC = `# Media

![clip](clip.mp4)

![report](report.pdf)

\`\`\`mermaid
graph TD
  A[Start] --> B[End]
\`\`\`

Outro paragraph.
`

test.use({ viewport: { width: 1280, height: 900 } })

/** 两帧 rAF，等 CM6 装饰/布局落定（复用 columns-fidelity 的 settle 口径）。 */
async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

/** 打开文档并进入编辑模式（非预览/源码），复用仓库 edit-mode 打开口径。 */
async function openEditor(page: Page, doc: string): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'media-flowchart.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(doc),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

function cmContent(page: Page) {
  return page.getByTestId('mode-pane-editor').locator('.cm-content').first()
}

/**
 * 编辑态内容 DOM 的原始 textContent。用 textContent（非 innerText）以匹配 AC 的
 * 「`.cm-content` textContent 不含 …」字面要求：连隐藏文本也一并排除。
 */
async function contentText(page: Page): Promise<string> {
  return cmContent(page).evaluate((el) => el.textContent ?? '')
}

/** 轮询等待 mermaid 图水合完成（动态 import mermaid，首帧可能较慢）。 */
async function waitForMermaidSvg(page: Page, timeout = 20_000): Promise<void> {
  await expect
    .poll(async () => page.locator('.cm-mermaid-block .mermaid-view svg').count(), { timeout })
    .toBeGreaterThan(0)
  await expect(page.locator('.cm-mermaid-block .mermaid-view svg').first()).toBeVisible()
}

// ── 1. 媒体卡片存在 + 原始语法 MUST NOT 残留 ────────────────────────────────

test('编辑态：视频/文件引用渲染为卡片，原始 Markdown 语法被替换', async ({ page }) => {
  await openEditor(page, DOC)

  const video = page.locator('.cm-media-video video[controls]').first()
  await expect(video).toBeVisible()
  // setAttribute 保留相对路径（.src 属性 getter 会解析成绝对 URL）
  await expect(video).toHaveAttribute('src', 'clip.mp4')

  const fileLink = page.locator('.cm-media-file a[href="report.pdf"]').first()
  await expect(fileLink).toBeVisible()
  await expect(fileLink).toHaveText('report')

  // widget 替换原始语法：源码文本不得出现在编辑态内容 DOM
  await expect.poll(() => contentText(page)).not.toContain('![clip](clip.mp4)')
  await expect.poll(() => contentText(page)).not.toContain('![report](report.pdf)')
})

// ── 2. Mermaid 非活动块 = 图，且严格不含原始围栏 ─────────────────────────────

test('Mermaid 非活动块：水合为 svg，且 .cm-content 不含原始围栏', async ({ page }) => {
  await openEditor(page, DOC)

  const block = page.locator('.cm-mermaid-block').first()
  await expect(block).toBeVisible()

  await waitForMermaidSvg(page)

  // AC 明确「不含」：原始 ```mermaid 围栏不得残留在编辑态内容 DOM
  await expect.poll(() => contentText(page)).not.toContain('```mermaid')
})

// ── 3. Mermaid 生命周期：点入露源码 → 移出复现图，无残留 ─────────────────────

test('Mermaid 生命周期：点入露源码、移出复现图且无残留围栏', async ({ page }) => {
  await openEditor(page, DOC)
  await waitForMermaidSvg(page)

  // 点入 mermaid 块 → 丢弃 replace，原始源码可编辑。
  // 点块的顶缘：CM6 对 block replace widget 的坐标映射在上下半区分别落到
  // 块首/块尾，点中心可能落到块尾（下一块），须偏向顶缘才能把光标放进围栏内。
  const box = await page.locator('.cm-mermaid-block').first().boundingBox()
  if (!box) throw new Error('no mermaid block box')
  await page.mouse.click(box.x + box.width / 2, box.y + 4)
  await expect.poll(() => contentText(page)).toContain('```mermaid')
  await expect.poll(() => contentText(page)).toContain('graph TD')

  // 光标移出（点结尾段落）→ 图返回，围栏再次消失
  await cmContent(page).getByText('Outro paragraph.').click()
  await waitForMermaidSvg(page)
  await expect.poll(() => contentText(page)).not.toContain('```mermaid')
})

// ── 4. HTML 导出含渲染后的图 ────────────────────────────────────────────────

test('HTML 导出：产物含渲染后的 mermaid svg，且不含原始围栏', async ({ page }) => {
  await page.goto('/')

  const result = await page.evaluate(async (markdown) => {
    // dev server 直接 serve TS 模块：驱动真实导出管线（renderMarkdown + 异步水合）
    const mod = await import('/src/lib/exportHtml.ts')
    const html = await mod.buildHtmlDocument({ markdown, assets: [], title: 'media-flowchart' })
    const doc = new DOMParser().parseFromString(html, 'text/html')
    return {
      hasMermaidSvg: doc.querySelector('.mermaid-view svg') !== null,
      hasRawFence: html.includes('```mermaid'),
      hasVideo: doc.querySelector('video[src="clip.mp4"]') !== null,
      hasFileLink: doc.querySelector('a[href="report.pdf"]') !== null,
    }
  }, DOC)

  expect(result.hasMermaidSvg).toBe(true)
  expect(result.hasRawFence).toBe(false)
  // 导出与编辑态同源：媒体也进入产物
  expect(result.hasVideo).toBe(true)
  expect(result.hasFileLink).toBe(true)
})

// ── 5. 斜杠菜单「视频/文件」插入命令（spec scenario）────────────────────────

test('斜杠菜单：应用「视频/文件」命令后源码含 ![...](...) 引用', async ({ page }) => {
  // #389：该命令不再插入静态占位，而是弹出真实文件选择窗。Stub 掉 input.click()
  // 以免弹出系统窗，改为直接对隐藏 input 触发 change（确定性 headless 路径）。
  await page.addInitScript(() => {
    HTMLInputElement.prototype.click = function () {}
  })
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'slash.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# Slash\n\n'),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()

  const content = cmContent(page)
  await content.click()
  await page.keyboard.press('Control+End')
  await page.keyboard.press('Enter')
  // keydown 触发 slashKeymap（insertText 走 input handler 不触发 keymap）
  await page.keyboard.press('/')

  const slashMenu = page.locator('.mdb-slash-menu')
  await expect(slashMenu).toBeVisible({ timeout: 3000 })
  // 行的 mousedown 即拆菜单，用坐标点击避开 Playwright 的 actionability 竞争。
  const row = page
    .locator('.mdb-slash-grid-menu .mdb-slash-item')
    .filter({ hasText: '视频/文件' })
    .first()
  const box = await row.boundingBox()
  if (!box) throw new Error('row not found: 视频/文件')
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)

  // 选择文件 → 插入 ![clip.mp4](clip.mp4)（文件同时作为资产入库）。
  await page.locator('[data-testid="media-file-input"]').setInputFiles({
    name: 'clip.mp4',
    mimeType: 'video/mp4',
    buffer: Buffer.from('fake-mp4-bytes'),
  })

  await page.getByTestId('mode-source-btn').click()
  await expect(content).toContainText('![clip.mp4](clip.mp4)')
  const raw = await contentText(page)
  expect(raw).toMatch(/!\[[^\]]+\]\([^)]+\)/)
})
