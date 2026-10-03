// 块手柄图标（#274 task 2.2）e2e：悬停不同类型块时手柄显示对应图标。
// 运行：pnpm --filter @md-bundle/web exec playwright test test/block-handle-icon.spec.ts
import { expect, test, type Locator, type Page } from '@playwright/test'

// 文档包含：H2 标题、未勾选任务列表、已勾选任务列表、普通段落
// 空行分隔确保两个独立的列表块
const DOC = `## H2 Heading

- [ ] Unchecked task

Paragraph between lists.

- [x] Checked task only

Regular paragraph.`

// #322 生命周期用例专用文档：按顺序排列 H2 / H3 / 引用 / 围栏代码块，
// 用于在「一次编辑器会话内」跨块型移动指针，验证图标随块型切换。
const SWITCH_DOC = `## H2 Switch Target

### H3 Switch Target

> Quote switch target.

\`\`\`ts
const codeSwitchTarget = 1
\`\`\`
`

test.use({ viewport: { width: 1440, height: 900 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
}

async function openEditorWith(page: Page, fileName: string, source: string): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: fileName,
    mimeType: 'text/markdown',
    buffer: Buffer.from(source),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

async function openEditor(page: Page): Promise<void> {
  await openEditorWith(page, 'block-handle-icon.md', DOC)
}

async function hoverLine(page: Page, text: string): Promise<void> {
  const line = page.locator('.cm-content .cm-line').filter({ hasText: text }).first()
  await expect(line).toBeVisible()
  const box = await line.boundingBox()
  if (!box) throw new Error('line has no box')
  await page.mouse.move(box.x + 20, box.y + box.height / 2)
  await settle(page)
}

async function expectHandleIcon(page: Page, iconName: string): Promise<void> {
  const handle = page.getByTestId('block-handle')
  await expect(handle).toBeVisible()
  await expect(handle).toHaveAttribute('data-icon', iconName)
  const icon = handle.locator('svg')
  await expect(icon).toHaveCount(1)
  await expect(icon).toHaveAttribute('aria-hidden', 'true')
  // 图标本体必须有实际绘制内容：标题/段落图标用 SVG <text> 字形，其余用 <path>
  await expect(icon.locator('path, text')).not.toHaveCount(0)
  // 回归防线：#322 之前手柄直接塞裸文本（如 "H2"），不能残留独立文本节点
  const strayText = await handle.evaluate((el) =>
    Array.from(el.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim())
      .map((node) => node.textContent),
  )
  expect(strayText).toEqual([])
}

test('悬停 H2 块时手柄显示 H2 图标', async ({ page }) => {
  await openEditor(page)
  await hoverLine(page, 'H2 Heading')

  await expectHandleIcon(page, 'H2Outlined')
})

test('悬停未勾选任务块时手柄显示未勾选图标', async ({ page }) => {
  await openEditor(page)
  await hoverLine(page, 'Unchecked task')

  await expectHandleIcon(page, 'CheckBoxOutlineBlankOutlined')
})

test('悬停已勾选任务块时手柄显示已勾选图标', async ({ page }) => {
  await openEditor(page)
  await hoverLine(page, 'Checked task only')

  await expectHandleIcon(page, 'TaskAltOutlined')
})

test('悬停普通段落时手柄显示拖拽手柄图标', async ({ page }) => {
  await openEditor(page)
  await hoverLine(page, 'Regular paragraph')

  await expectHandleIcon(page, 'DragHandleOutlined')
})

// #322 AC【生命周期】：单次会话内跨块型移动指针，图标必须跟着块型切换，
// 且不得残留上一个块的图标元素（每次切换后手柄内恰好一个 svg）。
test('在一次会话内跨块型移动指针，手柄图标随块型切换且无残留', async ({ page }) => {
  await openEditorWith(page, 'block-handle-icon-switch.md', SWITCH_DOC)

  const handle = page.getByTestId('block-handle')

  await hoverLine(page, 'H2 Switch Target')
  await expectHandleIcon(page, 'H2Outlined')
  await expect(handle.locator('svg')).toHaveCount(1)

  await hoverLine(page, 'H3 Switch Target')
  await expectHandleIcon(page, 'H3Outlined')
  await expect(handle.locator('svg')).toHaveCount(1)

  await hoverLine(page, 'Quote switch target')
  await expectHandleIcon(page, 'FormatQuoteOutlined')
  await expect(handle.locator('svg')).toHaveCount(1)

  await hoverLine(page, 'codeSwitchTarget')
  await expectHandleIcon(page, 'CodeOutlined')
  await expect(handle.locator('svg')).toHaveCount(1)
})
