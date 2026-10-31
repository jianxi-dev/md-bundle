// #437 回归锁：表格块菜单不得承诺 GFM 不存在的语义。
//
// GFM 管道表没有「表头列」与「列宽」语法，表头行恒存在。菜单里的
// 标题行 / 标题列 / 均分列宽 三项没有可持久化的表示：旧实现删分隔行毁表、
// 只挪行首空格、或直接 return 空转。修法是移除，而不是补一个假实现。
//
// 运行：pnpm --filter @md-bundle/web exec playwright test test/table-block-menu-437.spec.ts
import { expect, test, type Page } from '@playwright/test'

const DOC = `# 表格

| A | B |
| --- | --- |
| A1 | B1 |
|  |  |

结尾段落。
`

test.use({ viewport: { width: 1440, height: 1200 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'table-menu-437.md',
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
  const lines = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.cm-content .cm-line')).map(
      (el) => (el as HTMLElement).textContent ?? '',
    ),
  )
  await page.getByTestId('mode-edit-btn').click()
  await settle(page)
  return lines.join('\n')
}

async function openTableMenu(page: Page) {
  const cell = page.getByTestId('cm-table').locator('td[data-row="0"][data-col="0"]')
  const box = await cell.boundingBox()
  if (!box) throw new Error('no cell box')
  await page.mouse.move(box.x - 30, box.y + 5)
  await settle(page)
  if (!(await page.locator('.mdb-block-handle').isVisible())) {
    const line = page.locator('.cm-content .cm-line').filter({ hasText: '| A | B |' }).first()
    const lb = await line.boundingBox()
    if (lb) await page.mouse.move(lb.x + 10, lb.y + lb.height / 2)
    await settle(page)
  }
  await page.locator('.mdb-block-handle').click()
  await settle(page)
  return page.getByTestId('block-handle-menu')
}

test('表格块菜单不含 GFM 无法表达的假动作', async ({ page }) => {
  await openEditor(page)
  const menu = await openTableMenu(page)

  for (const label of ['标题行', '标题列', '均分列宽']) {
    await expect(menu.getByRole('button', { name: label, exact: true })).toHaveCount(0)
  }
})

test('表格块菜单保留可用动作（转为网格 / 在下方添加 / 上移下移复制删除）', async ({ page }) => {
  await openEditor(page)
  const menu = await openTableMenu(page)

  await expect(menu.getByRole('button', { name: '正文', exact: true })).toHaveCount(1)
  await expect(menu.getByRole('button', { name: '在下方添加', exact: true })).toHaveCount(1)
  await expect(menu.getByRole('button', { name: '上移', exact: true })).toHaveCount(1)
  await expect(menu.getByRole('button', { name: '下移', exact: true })).toHaveCount(1)
  await expect(menu.getByRole('button', { name: '复制', exact: true })).toHaveCount(1)
  await expect(menu.getByRole('button', { name: '删除', exact: true })).toHaveCount(1)
})

test('表格菜单操作后表格仍是表格（不毁表）', async ({ page }) => {
  await openEditor(page)
  const menu = await openTableMenu(page)
  await menu.getByRole('button', { name: '复制', exact: true }).click()
  await settle(page)

  const tables = await page.getByTestId('cm-table').count()
  expect(tables).toBe(2)

  const source = await readSource(page)
  expect(source).toContain('| --- | --- |')
  expect(source).toContain('| A | B |')
  expect(source).not.toContain('||')
})
