// #280（change editor-doubao-parity 4.2）：斜杠单键码 + 二级码。
// AC(A) /t53 → 5 列 3 行；AC(B) 、 触发菜单；附带 /r 任务、/nd 危险。
import { expect, test, type Page } from '@playwright/test'

const DOC = '# Title\n\n'

test.use({ viewport: { width: 1440, height: 900 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'slash-codes.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(DOC),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

async function placeEnd(page: Page): Promise<void> {
  await page.locator('.cm-content').click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+End' : 'Control+End')
  await settle(page)
}

async function rawDoc(page: Page): Promise<string> {
  await page.getByTestId('mode-source-btn').click()
  await expect(page.locator('.cm-content').first()).toBeVisible()
  const text = await page.locator('.cm-content').first().innerText()
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  return text
}

test('AC(A): /t53 + Enter 插入 5 列 3 行表格', async ({ page }) => {
  await openEditor(page)
  await placeEnd(page)
  await page.keyboard.type('/t53')
  await settle(page)
  await page.keyboard.press('Enter')
  await settle(page)

  const raw = await rawDoc(page)
  const lines = raw.split('\n').filter((l) => l.includes('|'))
  expect(lines[0]).toBe('|  |  |  |  |  |')
  expect(lines.length).toBe(5) // header + separator + 3 body rows
})

test('AC(B): 输入 、 触发斜杠菜单', async ({ page }) => {
  await openEditor(page)
  await placeEnd(page)
  await page.keyboard.insertText('、')
  await settle(page)
  await expect(page.locator('.mdb-slash-menu')).toBeVisible()
})

test('单键码 /r → 任务插入 - [ ]', async ({ page }) => {
  await openEditor(page)
  await placeEnd(page)
  await page.keyboard.type('/r')
  await settle(page)
  await page.keyboard.press('Enter')
  await settle(page)
  expect(await rawDoc(page)).toContain('- [ ]')
})

test('二级码 /nd → 危险标注 > [!DANGER]', async ({ page }) => {
  await openEditor(page)
  await placeEnd(page)
  await page.keyboard.type('/nd')
  await settle(page)
  await page.keyboard.press('Enter')
  await settle(page)
  expect(await rawDoc(page)).toContain('> [!DANGER]')
})
