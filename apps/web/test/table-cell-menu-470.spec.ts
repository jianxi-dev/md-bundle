// #470（增量）：单元格插入菜单只列「一格能装下」的项；分栏容器有可见边框。
//
// 旧行为：单元格菜单列出 任务/标注/分割线 等块级命令；GFM 单元格是一行，
// 这些命令会被 sanitize 成一行、看起来「点了没反应」。分栏容器没有边框，
// 空栏只剩 34px 的细条，读作「没插入」。
//
// 运行：pnpm --filter @md-bundle/web exec playwright test test/table-cell-menu-470.spec.ts
import { expect, test, type Page } from '@playwright/test'

// 空格子才走「插入内容」手柄；有内容的格子按 #399 走转换菜单。
const TABLE = `# T

| A | B |
| --- | --- |
|  | 2 |

尾。
`

test.use({ viewport: { width: 1440, height: 1000 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page, doc: string): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'cell-menu-470.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(doc),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

test('单元格插入菜单不再列出块级命令', async ({ page }) => {
  await openEditor(page, TABLE)
  const td = page.getByTestId('cm-table').locator('td[data-row="0"][data-col="0"]')
  await td.hover()
  await settle(page)
  await td.locator('.mdb-table-cell-handle').click()
  await settle(page)

  const menu = page.locator('.mdb-slash-menu')
  await expect(menu).toBeVisible()
  const labels = await menu.locator('.mdb-slash-item').evaluateAll((els) =>
    els.map((el) => (el.textContent ?? '').trim()),
  )
  expect(labels.length, '单元格菜单应有可用项').toBeGreaterThan(0)
  for (const blocked of ['任务', '标注', '分割线', '表格', '分栏']) {
    expect(labels.join('|'), `不应出现 ${blocked}`).not.toContain(blocked)
  }
})

test('分栏容器有边框与最小高度', async ({ page }) => {
  await openEditor(page, '# T\n\n正文。\n')
  await page.locator('.cm-content').click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+End' : 'Control+End')
  await settle(page)
  await page.keyboard.type('/f2')
  await settle(page)
  await page.keyboard.press('Enter')
  await settle(page)

  const info = await page.evaluate(() => {
    const c = document.querySelector('[data-testid="cm-columns"]') as HTMLElement | null
    if (!c) return null
    const cs = getComputedStyle(c)
    return { border: cs.borderStyle, width: cs.borderTopWidth, height: c.getBoundingClientRect().height }
  })
  expect(info, '分栏容器').not.toBeNull()
  expect(info!.border).not.toBe('none')
  expect(parseFloat(info!.width), '边框厚度').toBeGreaterThan(0)
  expect(info!.height, '空栏容器高度').toBeGreaterThan(40)
})
