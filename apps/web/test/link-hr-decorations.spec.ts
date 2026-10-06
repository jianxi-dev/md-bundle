// #379: edit-mode link and thematic break (hr) decorations
// In edit mode, links [text](url) should render as link text with URL hidden,
// and thematic breaks (---, ***, ___) should render as horizontal rules.
import { expect, test, type Page } from '@playwright/test'

test.use({ viewport: { width: 1440, height: 900 } })

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

async function openEditor(page: Page, doc: string): Promise<void> {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({
    name: 'link-hr.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(doc),
  })
  await page.getByTestId('mode-edit-btn').click()
  await expect(page.locator('.cm-editor').first()).toBeVisible()
  await settle(page)
}

const DOC = `# Link and HR Test

A [link to example](https://example.com) in a paragraph.

---

Another paragraph with a [second link](https://test.com).

***

Final paragraph with [link in code](https://code.com) but inside a fence:

\`\`\`
[not a link](https://fake.com)
\`\`\`

And a table:

| A | B |
|---|---|
| [cell link](https://cell.com) | text |

> [!NOTE]
> Callout with [callout link](https://callout.com)

___
`

test.describe('edit-mode link decoration (#379)', () => {
  test('link renders as link text with URL hidden in inactive block', async ({ page }) => {
    await openEditor(page, DOC)

    // Move cursor away from the first link line so it's inactive
    // The rendered text is "A link to example in a paragraph." (brackets hidden)
    const paraLine = page.locator('.cm-content .cm-line').filter({ hasText: 'A link to example in a paragraph' }).first()
    await paraLine.click()
    await settle(page)

    // The link text should be visible
    await expect(page.locator('.cm-content .cm-link').first()).toBeVisible()
    await expect(page.locator('.cm-content .cm-link').first()).toContainText('link to example')

    // The URL should NOT be visible (hidden by replace decoration)
    const content = page.locator('.cm-content').first()
    await expect(content).not.toContainText('https://example.com')

    // The full rendered line should NOT contain the raw brackets
    await expect(paraLine).not.toContainText('[')
    await expect(paraLine).not.toContainText('](')
  })

  test('link shows raw source when cursor enters the link (active block)', async ({ page }) => {
    await openEditor(page, DOC)

    // Click on the first link to make it active
    const link = page.locator('.cm-content .cm-link').first()
    await link.click()
    await settle(page)

    // The raw source should now be visible (including the URL)
    const content = page.locator('.cm-content').first()
    await expect(content).toContainText('https://example.com')
  })

  test('link inside code fence is NOT decorated', async ({ page }) => {
    await openEditor(page, DOC)

    // The link inside the code fence should NOT have cm-link class
    const codeContent = page.locator('.cm-content .cm-fenced-code').first()
    await expect(codeContent.locator('.cm-link')).toHaveCount(0)

    // The raw source should be visible in the code block body lines
    // (the lines between the opening and closing fences)
    const codeLines = page.locator('.cm-content .cm-line').filter({ hasText: '[not a link]' })
    await expect(codeLines.first()).toContainText('[not a link](https://fake.com)')
  })

  test('link inside table cell is NOT decorated (table widget owns the range)', async ({ page }) => {
    await openEditor(page, DOC)

    // The table widget replaces the entire table range, so links inside should not have cm-link
    const table = page.locator('.cm-content .cm-table-wrap').first()
    await expect(table.locator('.cm-link')).toHaveCount(0)
  })

  test('link inside callout is NOT decorated (callout widget owns the range)', async ({ page }) => {
    await openEditor(page, DOC)

    // The callout widget replaces the entire callout range
    const callout = page.locator('.cm-content .cm-callout').first()
    await expect(callout.locator('.cm-link')).toHaveCount(0)
  })
})

test.describe('edit-mode thematic break (hr) decoration (#379)', () => {
  test('hr (---) renders as horizontal rule in inactive block', async ({ page }) => {
    await openEditor(page, DOC)

    // Move cursor away from the first hr line
    const paraLine = page.locator('.cm-content .cm-line').filter({ hasText: 'A link to example in a paragraph' }).first()
    await paraLine.click()
    await settle(page)

    // The hr should be rendered as an <hr> element
    const hrElements = page.locator('.cm-content .cm-thematic-break')
    await expect(hrElements.first()).toBeVisible()

    // The raw --- should NOT be visible
    const content = page.locator('.cm-content').first()
    await expect(content).not.toContainText('---')
  })

  test('hr (***) renders as horizontal rule in inactive block', async ({ page }) => {
    await openEditor(page, DOC)

    // Move cursor away from the second hr line
    const paraLine = page.locator('.cm-content .cm-line').filter({ hasText: 'Another paragraph' }).first()
    await paraLine.click()
    await settle(page)

    // The second hr should be rendered as an <hr> element
    const hrElements = page.locator('.cm-content .cm-thematic-break')
    await expect(hrElements.nth(1)).toBeVisible()
  })

  test('hr (___) renders as horizontal rule in inactive block', async ({ page }) => {
    await openEditor(page, DOC)

    // Move cursor away from the third hr line
    const paraLine = page.locator('.cm-content .cm-line').filter({ hasText: 'Final paragraph' }).first()
    await paraLine.click()
    await settle(page)

    // The third hr should be rendered as an <hr> element
    const hrElements = page.locator('.cm-content .cm-thematic-break')
    await expect(hrElements.nth(2)).toBeVisible()
  })

  test('hr shows raw source when cursor enters the hr line (active block)', async ({ page }) => {
    await openEditor(page, DOC)

    // Move cursor to the line after the first hr, then press ArrowUp to enter the hr line
    const paraLine = page.locator('.cm-content .cm-line').filter({ hasText: 'Another paragraph' }).first()
    await paraLine.click()
    await settle(page)

    // Press ArrowUp to move to the hr line
    await page.keyboard.press('ArrowUp')
    await settle(page)

    // The raw source should now be visible
    const content = page.locator('.cm-content').first()
    await expect(content).toContainText('---')
  })
})

test.describe('mixed document: no console errors (#379)', () => {
  test('no CM6 overlapping decoration errors in console', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    await openEditor(page, DOC)

    // Interact with various elements to trigger decoration recalculation
    await page.locator('.cm-content .cm-link').first().click()
    await settle(page)

    await page.locator('.cm-content .cm-line').filter({ hasText: 'Another paragraph' }).first().click()
    await settle(page)

    await page.locator('.cm-content .cm-fenced-code').first().click()
    await settle(page)

    await page.locator('.cm-content .cm-table-wrap').first().click()
    await settle(page)

    await page.locator('.cm-content .cm-callout').first().click()
    await settle(page)

    // Filter out known non-CM6 errors (like favicon, etc.)
    const cm6Errors = errors.filter(
      (e) => e.includes('overlap') || e.includes('Decoration') || e.includes('Range') || e.includes('CM6'),
    )
    expect(cm6Errors).toHaveLength(0)
  })
})