// IME 斜杠触发菜单 (#388)：中文输入法下输入斜杠（全角/半角）应弹出插入菜单。
// 使用 CDP Input.imeSetComposition 启动组合，Input.insertText 提交。
// 运行：pnpm --filter @md-bundle/web exec playwright test test/ime-slash.spec.ts
import { expect, test, type Page } from '@playwright/test'

test.use({ viewport: { width: 1200, height: 700 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'ime-slash.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# Title\n\n'),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

async function placeCaretAtLineEnd(page: Page): Promise<void> {
  const lines = page.locator('.cm-content .cm-line')
  await lines.last().click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+End' : 'Control+End')
  await settle(page)
}

async function getDocText(page: Page): Promise<string> {
  const lines = await page.locator('.cm-content .cm-line').allTextContents()
  return lines.join('\n')
}

async function simulateImeComposition(
  page: Page,
  commitText: string,
): Promise<void> {
  // Add global event listeners to debug
  await page.evaluate(() => {
    const contentDOM = document.querySelector('.cm-content > div') as HTMLElement
    if (contentDOM) {
      contentDOM.addEventListener('compositionstart', (e) => {
        console.log('[DEBUG] compositionstart on contentDOM', (e as CompositionEvent).data)
      })
      contentDOM.addEventListener('compositionend', (e) => {
        console.log('[DEBUG] compositionend on contentDOM', (e as CompositionEvent).data)
      })
      contentDOM.addEventListener('compositionupdate', (e) => {
        console.log('[DEBUG] compositionupdate on contentDOM', (e as CompositionEvent).data)
      })
    }
    document.addEventListener('compositionstart', (e) => {
      console.log('[DEBUG] compositionstart on document', (e as CompositionEvent).data)
    }, true)
    document.addEventListener('compositionend', (e) => {
      console.log('[DEBUG] compositionend on document', (e as CompositionEvent).data)
    }, true)
  })

  // Start composition via CDP
  const session = await page.context().newCDPSession(page)
  try {
    await session.send('Input.imeSetComposition', {
      text: commitText,
      selectionStart: commitText.length,
      selectionEnd: commitText.length,
    })
    await settle(page)

    // Commit the composition via CDP
    await session.send('Input.insertText', { text: commitText })
    await settle(page)
  } finally {
    await session.detach()
  }
}

test.describe('IME slash handling (#388)', () => {
  test('ASCII slash opens menu (baseline)', async ({ page }) => {
    page.on('console', (msg) => console.log('[BROWSER]', msg.text()))
    
    await openEditor(page)
    await placeCaretAtLineEnd(page)
    await page.keyboard.press('/')
    await settle(page)

    await expect(page.locator('.mdb-slash-menu')).toBeVisible()
    await expect(page.locator('.mdb-slash-grid-menu .mdb-slash-item')).toHaveCount(17)
  })

  test('full-width slash (U+FF0F) via IME composition opens menu', async ({ page }) => {
    page.on('console', (msg) => console.log('[BROWSER]', msg.text()))
    
    await openEditor(page)
    await placeCaretAtLineEnd(page)

    await simulateImeComposition(page, '\uFF0F')

    // Menu should open
    await expect(page.locator('.mdb-slash-menu')).toBeVisible({ timeout: 2000 })
    await expect(page.locator('.mdb-slash-grid-menu .mdb-slash-item')).toHaveCount(17)

    // Verify the slash character is in the document
    const docText = await getDocText(page)
    expect(docText).toContain('\uFF0F')
  })

  test('ASCII slash via IME composition opens menu', async ({ page }) => {
    page.on('console', (msg) => console.log('[BROWSER]', msg.text()))
    
    await openEditor(page)
    await placeCaretAtLineEnd(page)

    await simulateImeComposition(page, '/')

    // Menu should open
    await expect(page.locator('.mdb-slash-menu')).toBeVisible({ timeout: 2000 })
    await expect(page.locator('.mdb-slash-grid-menu .mdb-slash-item')).toHaveCount(17)

    const docText = await getDocText(page)
    expect(docText).toContain('/')
  })

  test('Chinese composition does NOT open menu', async ({ page }) => {
    page.on('console', (msg) => console.log('[BROWSER]', msg.text()))
    
    await openEditor(page)
    await placeCaretAtLineEnd(page)

    await simulateImeComposition(page, '你好')

    // Menu should NOT appear
    await expect(page.locator('.mdb-slash-menu')).not.toBeVisible({ timeout: 1000 })

    // The composed text should be in the document
    const docText = await getDocText(page)
    expect(docText).toContain('你好')
  })
})