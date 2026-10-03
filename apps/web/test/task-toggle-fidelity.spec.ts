// #323：任务复选框切换保真度 —— 点击不刷新页面、已完成态文字变灰、取消勾选精确复原原色。
// 运行：pnpm --filter @md-bundle/web exec playwright test test/task-toggle-fidelity.spec.ts
import { expect, test, type Page } from '@playwright/test'

const DOC = '- [ ] todo item\n\nPlain paragraph text.\n'

// 固定浅色系统偏好，确保「跟随系统」解析到浅色令牌链
test.use({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' })

type MarkedWindow = Window & { __mdbLifecycleMarker?: string }

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'task-toggle-fidelity-test.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await page.waitForTimeout(200)
}

async function rawDoc(page: Page): Promise<string> {
  await page.getByTestId('mode-source-btn').click()
  await expect(page.locator('.cm-content').first()).toBeVisible()
  const text = await page.locator('.cm-content').first().innerText()
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  return text
}

function taskLine(page: Page) {
  return page.locator('.cm-line').filter({ hasText: 'todo item' }).first()
}

// 任务行自身的计算色（主题规则作用在 .cm-line.cm-task-done 上）
async function lineColor(page: Page): Promise<string> {
  return taskLine(page).evaluate((el) => getComputedStyle(el).color)
}

// 真正承载文字的节点计算色 —— 视觉保真的最终依据
async function textColor(page: Page): Promise<string> {
  return taskLine(page).evaluate((line) => {
    const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT)
    let node = walker.nextNode()
    while (node && !(node.textContent ?? '').includes('todo item')) node = walker.nextNode()
    return getComputedStyle(node?.parentElement ?? line).color
  })
}

// 在编辑器内容容器上解析灰色设计令牌，归一化为浏览器计算色格式。
// --reader-ink-3 仅在显式 data-theme 下定义，缺失时回退 --mdb-muted，
// 故必须从真实 DOM 解析，不能硬编码十六进制。
async function resolvedGrayToken(page: Page): Promise<string> {
  return page.locator('.cm-content').first().evaluate((el) => {
    const style = getComputedStyle(el)
    const raw = style.getPropertyValue('--reader-ink-3').trim() || style.getPropertyValue('--mdb-muted').trim()
    const probe = document.createElement('span')
    probe.style.color = raw
    document.body.appendChild(probe)
    const resolved = getComputedStyle(probe).color
    probe.remove()
    return resolved
  })
}

function isGray(rgb: string): boolean {
  const parts = rgb.match(/\d+/g)
  if (!parts || parts.length < 3) return false
  const [r, g, b] = parts.slice(0, 3).map(Number)
  return Math.max(r, g, b) - Math.min(r, g, b) <= 12
}

test('#323 勾选后任务行文字变灰，取消勾选精确复原，全程不刷新页面', async ({ page }) => {
  await openEditor(page)

  const checkbox = page.getByTestId('task-checkbox')
  await expect(checkbox).toBeVisible()
  await expect(checkbox).toHaveAttribute('aria-checked', 'false')

  const gray = await resolvedGrayToken(page)
  expect(isGray(gray)).toBe(true)

  const pendingLineColor = await lineColor(page)
  const pendingTextColor = await textColor(page)
  expect(pendingTextColor).toBe(pendingLineColor)
  expect(pendingTextColor).not.toBe(gray)

  // 生命周期哨兵：点击若触发整页刷新或编辑器重挂载则丢失
  await page.evaluate(() => {
    ;(window as MarkedWindow).__mdbLifecycleMarker = 'alive'
  })

  await checkbox.click()
  await expect(page.getByTestId('task-checkbox')).toHaveAttribute('aria-checked', 'true')
  expect(await page.evaluate(() => (window as MarkedWindow).__mdbLifecycleMarker)).toBe('alive')

  const checkedLineColor = await lineColor(page)
  const checkedTextColor = await textColor(page)
  expect(checkedLineColor).toBe(gray)
  expect(checkedTextColor).toBe(gray)
  expect(checkedTextColor).not.toBe(pendingTextColor)

  expect(await rawDoc(page)).toContain('- [x] todo item')

  await page.getByTestId('task-checkbox').click()
  await expect(page.getByTestId('task-checkbox')).toHaveAttribute('aria-checked', 'false')
  expect(await page.evaluate(() => (window as MarkedWindow).__mdbLifecycleMarker)).toBe('alive')

  expect(await lineColor(page)).toBe(pendingLineColor)
  expect(await textColor(page)).toBe(pendingTextColor)

  expect(await rawDoc(page)).toContain('- [ ] todo item')
})
