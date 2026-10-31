// #394 回归锁：斜杠命中码必须插入它自己的高亮块类型，不能落成引用。
//
// 票面报的是 `/ni` 插成「引用」。2026-10-31 在 HEAD 上逐码复核：/ni 输出
// `> [!INFO]\n> `，是信息卡片；8 个码全部正确。spec 因此改为「锁死每个码的插入结果」。
//
// 运行：pnpm --filter @md-bundle/web exec playwright test test/slash-callout-codes-394.spec.ts
import { expect, test, type Page } from '@playwright/test'

const CASES: readonly { code: string; marker: string }[] = [
  { code: 'nn', marker: 'NOTE' },
  { code: 'ni', marker: 'INFO' },
  { code: 'nt', marker: 'TIP' },
  { code: 'ns', marker: 'SUCCESS' },
  { code: 'nw', marker: 'WARNING' },
  { code: 'nd', marker: 'DANGER' },
  { code: 'ne', marker: 'FAILURE' },
  { code: 'nq', marker: 'QUESTION' },
]

test.use({ viewport: { width: 1440, height: 1000 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'slash-codes-394.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# T\n\nBody.\n'),
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
    Array.from(document.querySelectorAll('.cm-content .cm-line')).map(
      (el) => (el as HTMLElement).textContent ?? '',
    ).join('\n'),
  )
  await page.getByTestId('mode-edit-btn').click()
  await settle(page)
  return text
}

for (const { code, marker } of CASES) {
  test(`/${code} 插入 ${marker} 高亮块，而不是引用`, async ({ page }) => {
    await openEditor(page)
    await page.locator('.cm-content').click()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+End' : 'Control+End')
    await settle(page)
    await page.keyboard.type(`/${code}`)
    await settle(page)

    // 精确码只命中一行：该类型本身。
    const rows = page.locator('.mdb-slash-menu .mdb-slash-item, .mdb-slash-grid-menu .mdb-slash-item')
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).not.toContainText('引用')

    await page.keyboard.press('Enter')
    await settle(page)

    const source = await readSource(page)
    expect(source).toContain(`> [!${marker}]`)
    // 首行必须是本类型的 callout 头，而不是裸引用 `> `。
    const firstNewLine = source.split('\n').find((l) => l.startsWith('> '))
    expect(firstNewLine).toBe(`> [!${marker}]`)
  })
}
