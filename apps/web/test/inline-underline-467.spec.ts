// #467：颜色 + 下划线嵌套时，编辑态渲染为「红色下划线文字」，不再外露 <u>/<span> 源码。
import { expect, test, type Page } from '@playwright/test'

test.use({ viewport: { width: 1440, height: 1000 } })
const DOC = `# T

正文<span class="mdb-color-red"><u>段落</u></span>。

尾。
`

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

test('颜色 + 下划线：编辑态不外露标签，两样式同时生效', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'inline-467.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
  // 把光标移出该行，避免语义态揭示源码
  await page.locator('.cm-content').click({ position: { x: 5, y: 5 } })
  await settle(page)

  const info = await page.evaluate(() => {
    const content = document.querySelector('.cm-content') as HTMLElement
    const colored = document.querySelector('.cm-color-red') as HTMLElement | null
    const underlined = document.querySelector('.cm-underline') as HTMLElement | null
    return {
      text: content.innerText,
      coloredText: colored?.textContent ?? null,
      underlinedText: underlined?.textContent ?? null,
      underlineStyle: underlined ? getComputedStyle(underlined).textDecorationLine : null,
      color: colored ? getComputedStyle(colored).color : null,
    }
  })
  expect(info.text).not.toContain('<u>')
  expect(info.text).not.toContain('<span')
  expect(info.coloredText).toBe('段落')
  expect(info.underlinedText).toBe('段落')
  expect(info.underlineStyle).toContain('underline')
  expect(info.color).not.toBe('rgb(0, 0, 0)')
})
