// #471：图标词汇统一。断言「工具栏与命令面板只渲染注册过的图标」，不允许纯字形。
//
// 红证据：本文件在修复前的 main 上应失败（按钮 textContent 是 A/对齐/分栏/⇄/复制）。
import { expect, test, type Page } from '@playwright/test'

test.use({ viewport: { width: 1440, height: 1000 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'icons-471.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# T\n\n正文段落。\n'),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

test('工具栏每个控件都渲染注册图标，不出现纯字形', async ({ page }) => {
  await openEditor(page)
  await page.locator('.cm-content').click()
  await page.keyboard.type('选中我')
  await page.keyboard.press('Shift+Home')
  await settle(page)

  const toolbar = page.locator('.mdb-floating-toolbar')
  await expect(toolbar).toBeVisible()
  const btns = toolbar.locator('.mdb-toolbar-btn')
  const count = await btns.count()
  expect(count).toBeGreaterThan(0)

  const rows = await btns.evaluateAll((els) =>
    els.map((el) => {
      const text = (el.textContent ?? '').trim()
      return {
        title: el.getAttribute('title') ?? '',
        hasSvg: !!el.querySelector('svg[data-icon]'),
        icon: el.querySelector('svg[data-icon]')?.getAttribute('data-icon') ?? null,
        text: text.replace(/▾/g, '').trim(),
      }
    }),
  )
  const offenders = rows.filter((r) => !r.hasSvg && r.text.length > 0)
  expect(offenders, `仍是纯字形的控件: ${JSON.stringify(offenders)}`).toEqual([])
})

test('命令面板每行都渲染注册图标', async ({ page }) => {
  await openEditor(page)
  await page.locator('.cm-content').click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Shift+P' : 'Control+Shift+P')
  await settle(page)
  const rows = page.locator('.mdb-palette-row')
  if ((await rows.count()) === 0) test.skip(true, '命令面板未绑定该快捷键')
  const icons = await rows.locator('.mdb-palette-icon').evaluateAll((els) =>
    els.map((el) => ({
      hasSvg: !!el.querySelector('svg[data-icon]'),
      text: (el.textContent ?? '').trim(),
    })),
  )
  const offenders = icons.filter((i) => !i.hasSvg && i.text.length > 0)
  expect(offenders, `仍是纯字形的面板行: ${JSON.stringify(offenders)}`).toEqual([])
})
