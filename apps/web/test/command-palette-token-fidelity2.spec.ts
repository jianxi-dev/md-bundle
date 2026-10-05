// #362（change editor-fidelity-2 2.7）：命令面板指令 token 对齐。
// 目标（prototype token functional-spec.md §2 / conformance.json R-PALETTE-*）：
//   - 行高 32px
//   - 标签字号 12px
//   - gap/padding 为 4 的倍数（当前 gap:8px, padding:0 8px）
// 运行：pnpm --filter @md-bundle/web exec playwright test test/command-palette-token-fidelity2.spec.ts --reporter=line
import { expect, test, type Page } from '@playwright/test'
import { PALETTE_KEY } from './keys'

const DOC = '# 标题\n\n正文段落。\n\n'

test.use({ viewport: { width: 1440, height: 900 } })

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'palette-token-fidelity2-test.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await page.locator('.cm-content').click()
  await page.waitForTimeout(200)
}

async function openPalette(page: Page): Promise<void> {
  await openEditor(page)
  await page.keyboard.press(PALETTE_KEY)
  await expect(page.getByTestId('command-palette')).toBeVisible()
  await expect(page.getByTestId('command-palette-input')).toBeVisible()
}

test.describe('命令面板 Token 对齐（R-PALETTE-*）', () => {
  test('命令面板行高为 32px', async ({ page }) => {
    await openPalette(page)

    const firstItem = page.locator('.mdb-palette-item').first()
    await expect(firstItem).toBeVisible()

    const height = await firstItem.evaluate((el) => {
      const rect = el.getBoundingClientRect()
      return Math.round(rect.height)
    })

    // 断言行高为 32px（允许 1px 抖动）
    expect(height).toBe(32)

    // 记录原始测量值供 QG-5 证据
    console.log(`[QG-5] palette-item height: ${height}px`)
  })

  test('命令面板标签字号为 12px', async ({ page }) => {
    await openPalette(page)

    const firstItem = page.locator('.mdb-palette-item').first()
    await expect(firstItem).toBeVisible()

    const labelFontSize = await firstItem.locator('.mdb-palette-label').evaluate((el) => {
      return getComputedStyle(el).fontSize
    })

    // 断言标签字号为 12px
    expect(labelFontSize).toBe('12px')

    // 记录原始测量值供 QG-5 证据
    console.log(`[QG-5] palette-label fontSize: ${labelFontSize}`)
  })

  test('命令面板行 gap 为 4 的倍数（当前 8px）', async ({ page }) => {
    await openPalette(page)

    const firstItem = page.locator('.mdb-palette-item').first()
    await expect(firstItem).toBeVisible()

    const gap = await firstItem.evaluate((el) => {
      const cs = getComputedStyle(el)
      // gap 可能返回 '8px' 或 '0px' 等
      return parseInt(cs.gap || cs.columnGap || '0', 10)
    })

    // 断言 gap 为 4 的倍数
    expect(gap % 4).toBe(0)
    expect(gap).toBe(8) // 当前实现值

    // 记录原始测量值供 QG-5 证据
    console.log(`[QG-5] palette-item gap: ${gap}px`)
  })

  test('命令面板行 padding 为 4 的倍数（当前 0 8px）', async ({ page }) => {
    await openPalette(page)

    const firstItem = page.locator('.mdb-palette-item').first()
    await expect(firstItem).toBeVisible()

    const padding = await firstItem.evaluate((el) => {
      const cs = getComputedStyle(el)
      return {
        left: parseInt(cs.paddingLeft || '0', 10),
        right: parseInt(cs.paddingRight || '0', 10),
        top: parseInt(cs.paddingTop || '0', 10),
        bottom: parseInt(cs.paddingBottom || '0', 10),
      }
    })

    // 断言左右 padding 为 4 的倍数
    expect(padding.left % 4).toBe(0)
    expect(padding.right % 4).toBe(0)
    expect(padding.left).toBe(8)
    expect(padding.right).toBe(8)
    // 上下 padding 应为 0（高度由 height 控制）
    expect(padding.top).toBe(0)
    expect(padding.bottom).toBe(0)

    // 记录原始测量值供 QG-5 证据
    console.log(`[QG-5] palette-item padding: ${padding.top}px ${padding.right}px ${padding.bottom}px ${padding.left}px`)
  })

  test('选中态强调条位置正确（top:4px, bottom:4px，高度 24px）', async ({ page }) => {
    await openPalette(page)

    const input = page.getByTestId('command-palette-input')
    await input.fill('加粗')

    const selectedItem = page.locator('[data-testid="command-palette-item"][data-selected="true"]')
    await expect(selectedItem).toBeVisible()

    const accent = selectedItem.locator('[data-testid="command-palette-accent"]')
    await expect(accent).toBeVisible()

    const accentStyle = await accent.evaluate((el) => {
      const cs = getComputedStyle(el)
      return {
        top: parseInt(cs.top || '0', 10),
        bottom: parseInt(cs.bottom || '0', 10),
        width: parseInt(cs.width || '0', 10),
        height: el.getBoundingClientRect().height,
      }
    })

    // 断言强调条位置和尺寸
    expect(accentStyle.top).toBe(4)
    expect(accentStyle.bottom).toBe(4)
    expect(accentStyle.width).toBe(2)
    expect(Math.round(accentStyle.height)).toBe(24) // 32 - 4 - 4 = 24

    // 记录原始测量值供 QG-5 证据
    console.log(`[QG-5] palette-accent: top=${accentStyle.top}px bottom=${accentStyle.bottom}px width=${accentStyle.width}px height=${Math.round(accentStyle.height)}px`)
  })

  test('组头、底部快捷键提示条、选中态高亮、强调条行为无回归', async ({ page }) => {
    await openPalette(page)

    // 1) 组头可见
    const groupHeader = page.locator('[data-testid="command-palette-group"]').first()
    await expect(groupHeader).toBeVisible()

    // 2) 底部快捷键提示条可见
    const footer = page.getByTestId('command-palette-footer')
    await expect(footer).toBeVisible()
    await expect(footer).toContainText('选择')
    await expect(footer).toContainText('执行')
    await expect(footer).toContainText('关闭')

    // 3) 选中态：高亮类 + data-selected + 左侧 2px 强调条
    const selected = page.locator('[data-testid="command-palette-item"][data-selected="true"]')
    await expect(selected).toHaveClass(/mdb-palette-item--selected/)
    const accentWidth = await selected
      .locator('[data-testid="command-palette-accent"]')
      .evaluate((el) => getComputedStyle(el).width)
    expect(accentWidth).toBe('2px')

    // 4) 未选中的行不带强调条
    const unselectedAccents = await page
      .locator('.mdb-palette-item:not([data-selected="true"]) [data-testid="command-palette-accent"]')
      .count()
    expect(unselectedAccents).toBe(0)

    // 5) 键盘导航：ArrowDown 移动选中，不跨列
    const input = page.getByTestId('command-palette-input')
    const firstBox = await selected.boundingBox()
    await input.press('ArrowDown')
    const secondBox = await selected.boundingBox()
    expect(secondBox!.x).toBeCloseTo(firstBox!.x, 0)
    expect(secondBox!.y).toBeGreaterThan(firstBox!.y)

    console.log('[QG-5] Regression checks passed: group header, footer, selected state, accent bar, keyboard nav')
  })
})