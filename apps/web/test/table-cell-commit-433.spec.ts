// #433 回归锁：单元格编辑失焦必须立即落盘。
//
// 症状：输入后点表格外部，源码与单元格显示都停在旧值，直到再点一次别的格才更新。
// 根因：widget 在 pointer 捕获阶段被重建，`<input>` 被 detach，commit() 以
// `input.isConnected` 早退，草稿留在 dirtyCells 里没人写回。
//
// 判据两层，缺一不可：显示 = 输入值、源码 = 输入值，且中间不允许再点任何东西。
// 运行：pnpm --filter @md-bundle/web exec playwright test test/table-cell-commit-433.spec.ts
import { expect, test, type Page } from '@playwright/test'

const DOC = `# 表格

| A | B |
| --- | --- |
| A1 | B1 |
| A2 | B2 |

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
    name: 'cell-commit.md',
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
  return lines.join('\n')
}

test('失焦即落盘：单元格显示与源码同时等于输入值，无需再点别处', async ({ page }) => {
  await openEditor(page)
  const cell = page.getByTestId('cm-table').locator('td[data-row="1"][data-col="1"]')
  await cell.click()
  await settle(page)
  await page.keyboard.type('XYZ')
  await settle(page)

  // 点表格外部失焦，之后不许再点任何格
  await page.locator('.cm-line').filter({ hasText: '结尾段落' }).first().click()
  await settle(page)
  await page.waitForTimeout(300)

  // 先验显示：此刻不允许有任何"再点一下"的补救
  // 读文本节点本身：格子里的手柄是块级 SVG，td.innerText 会带一条换行（#452）。
  const shown = await page
    .getByTestId('cm-table')
    .locator('td[data-row="1"][data-col="1"] .cm-table-cell-text')
    .textContent()
  expect(shown, '失焦后单元格显示').toBe('B2XYZ')

  expect(await readSource(page)).toContain('| A2 | B2XYZ |')
})

test('回车提交同样立即落盘', async ({ page }) => {
  await openEditor(page)
  const cell = page.getByTestId('cm-table').locator('td[data-row="0"][data-col="0"]')
  await cell.click()
  await settle(page)
  await page.keyboard.type('!')
  await page.keyboard.press('Enter')
  await settle(page)
  await page.waitForTimeout(300)

  const shown = await page
    .getByTestId('cm-table')
    .locator('td[data-row="0"][data-col="0"] .cm-table-cell-text')
    .textContent()
  expect(shown, '回车后单元格显示').toBe('A1!')
  expect(await readSource(page)).toContain('| A1! | B1 |')
})
