// #282（change editor-doubao-parity 4.4）：任务复选框可点击切换 + 整段转任务。
// 运行：pnpm --filter @md-bundle/web exec playwright test test/task-checkbox.spec.ts
import { expect, test, type Page } from '@playwright/test'

const DOC = '- [ ] todo item\n\nPlain paragraph text.\n'

test.use({ viewport: { width: 1440, height: 900 } })

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'task-checkbox-test.md',
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

test('点击任务复选框在 - [ ] / - [x] 间切换源码', async ({ page }) => {
  await openEditor(page)

  const checkbox = page.getByTestId('task-checkbox')
  await expect(checkbox).toBeVisible()
  await expect(checkbox).toHaveAttribute('aria-checked', 'false')

  await checkbox.click()
  await page.waitForTimeout(150)
  expect(await rawDoc(page)).toContain('- [x] todo item')

  await page.getByTestId('task-checkbox').click()
  await page.waitForTimeout(150)
  expect(await rawDoc(page)).toContain('- [ ] todo item')
})

test('选中段落后经转换→任务，整段变为 - [ ] 任务', async ({ page }) => {
  await openEditor(page)

  await page.locator('.cm-line').filter({ hasText: 'Plain paragraph text.' }).dblclick()

  const turnInto = page.locator('.mdb-toolbar-dropdown-btn[title="转换"]')
  await expect(turnInto).toBeVisible()
  await turnInto.click()

  await page
    .locator('.mdb-toolbar-dropdown-option')
    .filter({ hasText: '任务' })
    .first()
    .click()
  await page.waitForTimeout(150)

  expect(await rawDoc(page)).toContain('- [ ] Plain paragraph text.')
})
