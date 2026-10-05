// #361（change editor-fidelity-2 / 2.6）高亮块保真 2：
//   R-CALLOUT-01 类型 flyout 13 项 label 唯一（提示仅一次，无 tip/hint、caution/attention 重复）
//   R-CALLOUT-02 点击 header emoji → emoji 选择器打开 → 选中更新 data-callout-emoji
//   plus 生命周期：选类型后 flyout 关闭、标头更新、无残留 flyout。
// 运行：pnpm --filter @md-bundle/web exec playwright test test/callout-type-fidelity2.spec.ts
import { expect, test, type Locator, type Page } from '@playwright/test'

const DOC = `Plain paragraph target.

> [!NOTE]
> callout body text

# Heading block`

test.use({ viewport: { width: 1440, height: 900 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'callout-type-fidelity2.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

async function boxOf(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox()
  if (!box) throw new Error('element has no bounding box')
  return box
}

/** Hover the callout block line, then its handle (which auto-opens the menu). */
async function openCalloutMenu(page: Page): Promise<void> {
  const line = page.locator('.cm-content .cm-line').filter({ hasText: 'callout body text' }).first()
  await expect(line).toBeVisible()
  const lb = await boxOf(line)
  await page.mouse.move(lb.x + 20, lb.y + lb.height / 2)
  await settle(page)
  const handle = page.getByTestId('block-handle')
  await expect(handle).toBeVisible()
  const hb = await boxOf(handle)
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2)
  await settle(page)
  await expect(page.getByTestId('block-handle-menu')).toBeVisible()
}

async function hoverTypeRow(page: Page): Promise<void> {
  const row = page.locator('.mdb-block-handle-menu [data-flyout="callout-type"]')
  await expect(row).toBeVisible()
  const rb = await boxOf(row)
  await page.mouse.move(rb.x + rb.width / 2, rb.y + rb.height / 2)
  await settle(page)
}

/** Flyout labels with the leading emoji icon span stripped. */
async function flyoutLabels(page: Page): Promise<string[]> {
  return page.locator('.mdb-block-handle-flyout-item').evaluateAll((items) =>
    items.map((el) => {
      const clone = el.cloneNode(true) as HTMLElement
      clone.querySelector('.mdb-block-handle-flyout-icon')?.remove()
      return (clone.textContent ?? '').trim()
    }),
  )
}

test('R-CALLOUT-01: 类型 flyout 恰 13 项且 label 唯一（提示仅一次）', async ({ page }) => {
  await openEditor(page)
  await openCalloutMenu(page)
  await hoverTypeRow(page)

  const panel = page.getByTestId('block-handle-flyout')
  await expect(panel).toBeVisible()

  const labels = await flyoutLabels(page)
  expect(labels).toEqual([
    '注释',
    '信息',
    '摘要',
    '待办',
    '提示',
    '成功',
    '问题',
    '警告',
    '失败',
    '危险',
    'Bug',
    '示例',
    '引用',
  ])
  expect(new Set(labels).size).toBe(13)
  expect(labels.filter((label) => label === '提示')).toHaveLength(1)
  expect(labels.filter((label) => label === '注意')).toHaveLength(0)
  // No near-duplicate legacy aliases leak through.
  expect(labels).not.toContain('总结')
  expect(labels).not.toContain('完成')
  expect(labels).not.toContain('疑问')
})

test('生命周期: 选择类型后 flyout 关闭、标头更新且无残留 flyout', async ({ page }) => {
  await openEditor(page)
  await openCalloutMenu(page)
  await hoverTypeRow(page)

  const panel = page.getByTestId('block-handle-flyout')
  await panel.locator('[data-flyout-action="callout-tip"]').click()
  await settle(page)

  // Flyout lifecycle: removed (not merely hidden); the block menu itself is hidden.
  await expect(page.locator('.mdb-block-handle-flyout')).toHaveCount(0)
  await expect(page.getByTestId('block-handle-menu')).toBeHidden()

  const card = page.locator('.cm-callout').first()
  await expect(card).toBeVisible()
  await expect(card).toHaveClass(/cm-callout-tone-green/)
  const header = card.locator('.cm-callout-header')
  await expect(header).toContainText('提示')
  const headerText = await header.innerText()
  expect((headerText.match(/提示/g) ?? []).length).toBe(1)
})

test('R-CALLOUT-02: 点击 header emoji → 选择器打开 → 选中更新 data-callout-emoji', async ({ page }) => {
  await openEditor(page)

  const card = page.locator('.cm-callout').first()
  await expect(card).toBeVisible()
  const initial = await card.getAttribute('data-callout-emoji')
  expect(initial).toBeTruthy()

  await card.locator('.cm-callout-icon').click()
  const picker = page.getByTestId('cm-callout-emoji-picker')
  await expect(picker).toBeVisible()

  await picker.locator('[data-testid="cm-callout-emoji-option"][data-emoji="🎉"]').click()
  await settle(page)

  await expect(card).toHaveAttribute('data-callout-emoji', '🎉')
  await expect(card.locator('.cm-callout-icon')).toHaveText('🎉')
  await expect(picker).toHaveCount(0)
})
