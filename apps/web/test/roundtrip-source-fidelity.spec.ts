// 红线 1：源码无损往返基线矩阵（change editor-porting-gate task 1.1 / #420）
//
// 判据两级，缺一不可：
//   1) 操作区 = 期望片段（逐字符）；
//   2) 非操作区 = 操作前逐行逐字节不变（整份文档按行比较，不是只看某段是否还在）。
//
// 读取方式：切到源码模式后按 `.cm-line` 逐行取 textContent，join('\n') 即等于底层
// 文档字符串（edit 模式的行内装饰会吃掉标记，源码模式不会）。这一等价关系由首条
// 用例「基线可读」锁定；若哪天度量方式失真，该用例先红。
//
// 运行：pnpm --filter @md-bundle/web exec playwright test test/roundtrip-source-fidelity.spec.ts
import { expect, test, type Page } from '@playwright/test'

const FIXTURE = `# 标题一

正文段落。

- 列表项一
- [ ] 买牛奶

> 引用段落

\`\`\`ts
const a = 1
\`\`\`

> [!NOTE]
> callout 正文

| A | B |
| --- | --- |
| A1 | B1 |
| A2 | B2 |

目标词

着色词

一段含 **粗体** 与 [链接](https://example.com) 的正文。

---

结尾段落。
`

test.use({ viewport: { width: 1440, height: 900 } })

const MOD = process.platform === 'darwin' ? 'Meta' : 'Control'

// 1×1 透明 PNG（最小合法图像，不依赖磁盘 fixture）。
const PNG = {
  name: 'photo.png',
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64',
  ),
}

function lines(): string[] {
  return FIXTURE.split('\n')
}

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'roundtrip.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(FIXTURE),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

/** Switch to source mode and read the document line by line. */
async function readSource(page: Page): Promise<string> {
  await page.getByTestId('mode-source-btn').click()
  await expect(page.locator('.cm-content').first()).toBeVisible()
  await settle(page)
  const sourceLines = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.cm-content .cm-line')).map(
      (el) => (el as HTMLElement).textContent ?? '',
    ),
  )
  return sourceLines.join('\n')
}

/** Assert the whole document equals the expected lines; report the first drift. */
function expectDoc(actual: string, expected: string[], label: string): void {
  const got = actual.split('\n')
  const limit = Math.max(got.length, expected.length)
  for (let i = 0; i < limit; i++) {
    if (got[i] !== expected[i]) {
      throw new Error(
        `[${label}] 第 ${i + 1} 行不符\n  期望: ${JSON.stringify(expected[i])}\n  实际: ${JSON.stringify(got[i])}`,
      )
    }
  }
  expect(got.length, `[${label}] 行数`).toBe(expected.length)
}

/** Hover a line's gutter and open its block handle menu. */
async function openBlockMenu(page: Page, lineText: string): Promise<void> {
  const line = page.locator('.cm-content .cm-line').filter({ hasText: lineText }).first()
  const box = await line.boundingBox()
  if (!box) throw new Error(`no bounding box for ${lineText}`)
  await page.mouse.move(box.x + 10, box.y + box.height / 2)
  await settle(page)
  await page.locator('.mdb-block-handle').click()
  await settle(page)
}

/** Hover a table row boundary and click its 「+」 bubble (same path as table-add.spec.ts). */
async function clickRowBoundary(page: Page): Promise<void> {
  // Touch the cell first: CM6 re-renders the table widget once on first pointer
  // entry, so a boundary box measured before that hover is stale.
  await page.getByTestId('cm-table').locator('td[data-row="0"][data-col="0"]').hover()
  await settle(page)
  const boundary = page.locator('[data-testid="cm-table-boundary"][data-type="row"]').first()
  const box = await boundary.boundingBox()
  if (!box) throw new Error('row boundary has no box')
  await page.mouse.move(box.x + box.width / 4, box.y + box.height / 2)
  await settle(page)
  const hotspot = page.locator('[data-testid="cm-table-hotspot"][data-type="row"]').first()
  await expect(hotspot).toBeVisible()
  await hotspot.click()
  await settle(page)
}

test('基线可读：源码模式逐行读取等于导入文档', async ({ page }) => {
  await openEditor(page)
  expectDoc(await readSource(page), lines(), 'baseline')
})

test('块转换：一级标题 → 正文，只改第 1 行', async ({ page }) => {
  await openEditor(page)
  await openBlockMenu(page, '标题一')
  await page
    .getByTestId('block-handle-menu')
    .getByRole('button', { name: '正文', exact: true })
    .click()
  await settle(page)

  const expected = lines()
  expected[0] = '标题一'
  expectDoc(await readSource(page), expected, 'h1-to-paragraph')
})

test('块转换：正文 → 二级标题，只改第 3 行', async ({ page }) => {
  await openEditor(page)
  await openBlockMenu(page, '正文段落')
  await page
    .getByTestId('block-handle-menu')
    .getByRole('button', { name: '二级标题', exact: true })
    .click()
  await settle(page)

  const expected = lines()
  expected[2] = '## 正文段落。'
  expectDoc(await readSource(page), expected, 'paragraph-to-h2')
})

test('待办勾选：- [ ] → - [x]，只改第 6 行', async ({ page }) => {
  await openEditor(page)
  await page.getByTestId('task-checkbox').click()
  await settle(page)

  const expected = lines()
  expected[5] = '- [x] 买牛奶'
  expectDoc(await readSource(page), expected, 'task-toggle')
})

test('引用块追加：只改第 8 行，引用标记保留', async ({ page }) => {
  await openEditor(page)
  const line = page.locator('.cm-content .cm-line').filter({ hasText: '引用段落' }).first()
  await line.click()
  await page.keyboard.press('End')
  await page.keyboard.type('补充')
  await settle(page)

  const expected = lines()
  expected[7] = '> 引用段落补充'
  expectDoc(await readSource(page), expected, 'quote-append')
})

test('代码块追加：围栏内新增 1 行，围栏标记原样', async ({ page }) => {
  await openEditor(page)
  const line = page.locator('.cm-content .cm-line').filter({ hasText: 'const a = 1' }).first()
  await line.click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('const b = 2')
  await settle(page)

  const expected = lines()
  expected.splice(11, 0, 'const b = 2')
  expectDoc(await readSource(page), expected, 'code-append')
})

test('高亮块正文编辑：只改第 15 行，块外不动', async ({ page }) => {
  await openEditor(page)
  await page.locator('.cm-callout').first().click()
  await settle(page)
  await page.keyboard.type('新文字')
  await settle(page)
  await page.locator('.cm-line').filter({ hasText: '结尾段落' }).first().click()
  await settle(page)

  const expected = lines()
  expected[14] = '> callout 正文新文字'
  expectDoc(await readSource(page), expected, 'callout-body')
})

test('表格单元格改写：只改第 19 行，分隔行与邻格不动', async ({ page }) => {
  await openEditor(page)
  const cell = page.getByTestId('cm-table').locator('td[data-row="0"][data-col="0"]')
  await cell.click()
  await settle(page)
  await page.keyboard.type('改')
  await settle(page)

  const expected = lines()
  expected[18] = '| A1改 | B1 |'
  expectDoc(await readSource(page), expected, 'table-cell')
})

test('表格插入行：新增 1 行等宽空行，原有行逐字节不变', async ({ page }) => {
  await openEditor(page)
  await clickRowBoundary(page)
  const actual = await readSource(page)

  const before = lines()
  const after = actual.split('\n')
  expect(after.length, '行数应 +1').toBe(before.length + 1)

  // 找出新增的那一行，其余行必须与操作前完全一致。
  let insertedAt = -1
  for (let i = 0; i < after.length; i++) {
    if (after[i] === before[i] && insertedAt === -1) continue
    if (insertedAt === -1) {
      insertedAt = i
      break
    }
  }
  expect(insertedAt, '未找到新增行').toBeGreaterThanOrEqual(0)
  const tail = after.slice(insertedAt + 1)
  expect(tail, '新增行之后的内容应逐字节不变').toEqual(before.slice(insertedAt))
  const inserted = after[insertedAt]
  expect(inserted, `新增行应为等宽空行，实际 ${JSON.stringify(inserted)}`).toMatch(/^\|\s*\|\s*\|$/)
})

test('插入分栏：新增 ::: 围栏 3 行，其余内容不动', async ({ page }) => {
  await openEditor(page)
  // Click a plain text line (not the content centre: a callout card swallows the click).
  await page.locator('.cm-content .cm-line').filter({ hasText: '结尾段落' }).first().click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+End' : 'Control+End')
  await settle(page)
  await page.keyboard.type('/f2')
  await settle(page)
  await page.keyboard.press('Enter')
  await settle(page)

  const expected = lines()
  expected[expected.length - 1] = '::: {.col-2}'
  expected.push('', ':::')
  expectDoc(await readSource(page), expected, 'columns-insert')
})

test('行内加粗：选中词被包住，选区外不动', async ({ page }) => {
  await openEditor(page)
  const line = page.locator('.cm-content .cm-line').filter({ hasText: '目标词' }).first()
  await line.dblclick()
  await settle(page)
  await page.keyboard.press(`${MOD}+B`)
  await settle(page)

  const expected = lines()
  const idx = expected.indexOf('目标词')
  expected[idx] = '**目标词**'
  expectDoc(await readSource(page), expected, 'bold')
})

test('文字颜色：选区出现且仅出现一处 mdb-color-red 包裹', async ({ page }) => {
  await openEditor(page)
  const line = page.locator('.cm-content .cm-line').filter({ hasText: '着色词' }).first()
  await line.dblclick()
  await settle(page)
  const colorBtn = page.locator('.mdb-floating-toolbar .mdb-toolbar-dropdown-btn[title="颜色"]')
  await expect(colorBtn).toBeVisible()
  await colorBtn.click()
  await settle(page)
  const menu = page.locator('.mdb-toolbar-color-menu')
  await expect(menu).toBeVisible()
  await menu.locator('.mdb-color-font-swatch[title="红色"]').click()
  await settle(page)

  const expected = lines()
  const idx = expected.indexOf('着色词')
  expected[idx] = '<span class="mdb-color-red">着色词</span>'
  expectDoc(await readSource(page), expected, 'color')
})

test('插入图片：新增 1 行图片引用，其余内容逐字节不变', async ({ page }) => {
  // 阻止真实系统文件窗，直接对隐藏 input 灌文件（确定性 headless 路径）。
  await page.addInitScript(() => {
    HTMLInputElement.prototype.click = function () {}
  })
  await openEditor(page)
  await page.locator('.cm-content .cm-line').filter({ hasText: '结尾段落' }).first().click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+End' : 'Control+End')
  await settle(page)
  await page.keyboard.type('/img')
  await settle(page)
  const row = page.locator('.mdb-slash-menu').getByText('图片引用').first()
  const box = await row.boundingBox()
  if (!box) throw new Error('slash row 图片引用 not found')
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await page.locator('[data-testid="media-file-input"]').setInputFiles(PNG)
  await settle(page)

  const expected = lines()
  expected[expected.length - 1] = '![photo.png](photo.png)'
  expectDoc(await readSource(page), expected, 'image-insert')
})
