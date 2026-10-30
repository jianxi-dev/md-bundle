// #381 / #396 回归锁：高亮块编辑链路的两类症状——「输入后卡片不更新」与「点击不稳定」。
//
// 这两张票 2026-10-05 报出，之后 #382（容器内列表）与 #395（标题可编辑）重写了
// callout 的渲染/编辑链路。2026-10-30 用真实指针与键盘复核，票面描述的现象不再复现；
// 本文件把当时描述的可观测行为固化成常驻用例，避免重写再把它弄丢。
//
// 运行：pnpm --filter @md-bundle/web exec playwright test test/callout-regression-381-396.spec.ts
import { expect, test, type Page } from '@playwright/test'

const TWO_CARDS = `# 卡片

第一段。

> [!NOTE]
> 卡片一正文

中间段落。

> [!WARNING]
> 卡片二正文

结尾段落。
`

const TITLED = `> [!NOTE] 带标题的卡片
> 正文

结尾段落。
`

test.use({ viewport: { width: 1440, height: 900 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page, doc: string, name: string): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name,
    mimeType: 'text/markdown',
    buffer: Buffer.from(doc),
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

test('#381 输入后点卡片外部，卡片立即显示新文字（无需再点一次）', async ({ page }) => {
  await openEditor(page, TWO_CARDS, 'callout-381.md')

  await page.locator('.cm-callout').first().click()
  await settle(page)
  await page.keyboard.type('新文字')
  await settle(page)

  // 点卡片外 → 提交并重建卡片
  await page.locator('.cm-line').filter({ hasText: '结尾段落' }).first().click()
  await settle(page)

  const cardText = await page.locator('.cm-callout').first().innerText()
  expect(cardText).toContain('卡片一正文新文字')
  // 旧态叠加会把正文出现两次（一次旧渲染 + 一次新提交）
  expect(cardText.split('卡片一正文').length - 1).toBe(1)
})

test('#381 连续点击卡片正文 3 次：每次恰好 1 个编辑器且获得焦点', async ({ page }) => {
  await openEditor(page, TWO_CARDS, 'callout-381-repeat.md')

  for (let i = 0; i < 3; i++) {
    await page.locator('.cm-callout').first().click()
    await settle(page)
    await expect(page.locator('.cm-callout-editor')).toHaveCount(1)
    await expect(page.getByTestId('cm-callout-editor')).toBeFocused()
    await page.keyboard.press('Escape')
    await settle(page)
    await expect(page.locator('.cm-callout-editor')).toHaveCount(0)
  }
})

test('#381 两张卡片：点击第 2 张时打开的编辑器属于第 2 张', async ({ page }) => {
  await openEditor(page, TWO_CARDS, 'callout-381-two.md')

  await page.locator('.cm-callout').nth(1).click()
  await settle(page)
  await expect(page.locator('.cm-callout-editor')).toHaveCount(1)
  await expect(page.locator('.cm-callout-editor')).toHaveValue('卡片二正文')
})

test('#381 编辑第 2 张后：第 1 张源码行逐字节不变', async ({ page }) => {
  await openEditor(page, TWO_CARDS, 'callout-381-isolation.md')

  await page.locator('.cm-callout').nth(1).click()
  await settle(page)
  await page.keyboard.type('改动')
  await settle(page)
  await page.locator('.cm-line').filter({ hasText: '结尾段落' }).first().click()
  await settle(page)

  const source = await readSource(page)
  const lines = source.split('\n')
  expect(lines[4]).toBe('> [!NOTE]')
  expect(lines[5]).toBe('> 卡片一正文')
  expect(lines[10]).toBe('> 卡片二正文改动')
})

test('#396 点击带标题卡片的标题：输入框稳定存在并保持焦点', async ({ page }) => {
  await openEditor(page, TITLED, 'callout-396.md')

  await page.locator('.cm-callout-title').first().click()
  await settle(page)
  await expect(page.locator('.cm-callout-title-editor')).toHaveCount(1)
  await expect(page.locator('.cm-callout-title-editor')).toBeFocused()

  // 再等一段时间：不给「光标缩回」留窗口
  await page.waitForTimeout(300)
  await expect(page.locator('.cm-callout-title-editor')).toHaveCount(1)
  await expect(page.locator('.cm-callout-title-editor')).toBeFocused()

  // 打开时标题全选（重命名语义），先取消选择再追加
  await page.keyboard.press('End')
  await page.keyboard.type('X')
  await page.keyboard.press('Enter')
  await settle(page)
  expect(await readSource(page)).toContain('> [!NOTE] 带标题的卡片X')
})
