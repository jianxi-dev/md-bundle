// #450 回归锁：分栏插入后可见，点进空栏就能就地输入，内容写进该栏。
//
// 旧行为：点栏体是把整块源码选中，输入会替换整块；空栏只剩 `::: ` 源码字符。
//
// 运行：pnpm --filter @md-bundle/web exec playwright test test/columns-inplace-450.spec.ts
import { expect, test, type Page } from '@playwright/test'

const DOC = '# 标题\n\n正文段落。\n'

test.use({ viewport: { width: 1440, height: 1000 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'columns-450.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

async function readSource(page: Page): Promise<string> {
  await page.getByTestId('mode-source-btn').click()
  await expect(page.locator('.cm-content').first()).toBeVisible()
  await settle(page)
  const text = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.cm-content .cm-line'))
      .map((el) => (el as HTMLElement).textContent ?? '')
      .join('\n'),
  )
  await page.getByTestId('mode-edit-btn').click()
  await settle(page)
  return text
}

async function insertTwoColumns(page: Page): Promise<void> {
  await page.locator('.cm-content .cm-line').filter({ hasText: '正文段落' }).first().click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+End' : 'Control+End')
  await settle(page)
  await page.keyboard.type('/f2')
  await settle(page)
  await page.keyboard.press('Enter')
  await settle(page)
}

test('插入 2 栏后两栏可见并带占位提示', async ({ page }) => {
  await openEditor(page)
  await insertTwoColumns(page)

  const container = page.getByTestId('cm-columns').first()
  await expect(container).toBeVisible()
  const columns = container.locator('.cm-column')
  await expect(columns).toHaveCount(2)
  for (const col of await columns.all()) {
    const box = await col.boundingBox()
    if (!box) throw new Error('column has no box')
    expect(box.height, '空栏应有可见高度').toBeGreaterThan(8)
  }
  await expect(columns.first().locator('.cm-column-body')).toHaveAttribute('data-placeholder', '输入内容…')
})

test('点进左栏就地输入，内容写进这一栏', async ({ page }) => {
  await openEditor(page)
  await insertTwoColumns(page)
  const before = await readSource(page)

  const first = page.getByTestId('cm-columns').first().locator('.cm-column').first()
  const box = await first.locator('.cm-column-body').boundingBox()
  if (!box) throw new Error('no body box')
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await settle(page)

  const editor = page.getByTestId('cm-column-editor')
  await expect(editor).toHaveCount(1)
  await expect(editor).toBeFocused()
  await page.keyboard.type('左栏内容')
  await page.keyboard.press('Enter')
  await settle(page)

  const source = await readSource(page)
  expect(source).toContain('左栏内容')
  expect(source).toContain('::: {.col-2}')
  expect(source).toContain('正文段落。')
  // 块外内容未动
  expect(source.split('\n').slice(0, 3)).toEqual(before.split('\n').slice(0, 3))
})

test('左栏写完再写右栏，两栏内容各自落位', async ({ page }) => {
  await openEditor(page)
  await insertTwoColumns(page)

  const columns = page.getByTestId('cm-columns').first().locator('.cm-column')
  for (const [i, text] of ['左栏', '右栏'].entries()) {
    const body = columns.nth(i).locator('.cm-column-body')
    const box = await body.boundingBox()
    if (!box) throw new Error('no body box')
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await settle(page)
    await expect(page.getByTestId('cm-column-editor')).toHaveCount(1)
    await page.keyboard.type(text)
    await page.keyboard.press('Enter')
    await settle(page)
  }

  const source = await readSource(page)
  expect(source).toContain('左栏')
  expect(source).toContain('右栏')
  const inner = source.split('\n').slice(source.split('\n').indexOf('::: {.col-2}') + 1)
  expect(inner.join('\n')).toMatch(/左栏[\s\S]*右栏/)
})
