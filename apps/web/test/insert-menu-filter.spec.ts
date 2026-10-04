// #326（change editor-fidelity）：插入菜单过滤与命令码直达。
// 覆盖 /bt /t /n /nd /css /zzz 六类查询、空状态文案，以及 Escape / outside click /
// caret 离开三种取消路径都不留 `/query` 残留。
// 运行：pnpm --filter @md-bundle/web exec playwright test test/insert-menu-filter.spec.ts
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
    name: 'insert-menu-filter.md',
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

/** Open the menu at the doc end and type a filter query after the trigger. */
async function typeQuery(page: Page, query: string): Promise<void> {
  await placeEnd(page)
  await page.keyboard.type('/')
  await expect(page.locator('.mdb-slash-menu')).toBeVisible()
  if (query) {
    await page.keyboard.type(query)
    await settle(page)
  }
}

/** Visible root rows, in registry order. */
function rows(page: Page) {
  return page.locator('.mdb-slash-grid-menu .mdb-slash-item')
}

/** Visible second-level flyout rows. */
function flyoutRows(page: Page) {
  return page.locator('.mdb-slash-flyout-item')
}

test('过滤：/bt 命中标题且隐藏分组标题', async ({ page }) => {
  await openEditor(page)
  await typeQuery(page, 'bt')

  await expect(rows(page)).toHaveCount(1)
  await expect(rows(page).first()).toContainText('标题')
  // 查询态下分组标题只增加噪音，必须隐藏
  await expect(page.locator('.mdb-slash-group')).toHaveCount(0)
})

test('过滤：完整拼音 /biaoti 同样命中标题', async ({ page }) => {
  await openEditor(page)
  await typeQuery(page, 'biaoti')

  await expect(rows(page)).toHaveCount(1)
  await expect(rows(page).first()).toContainText('标题')
})

test('命令码：/t 只命中表格（不被 yinyong 之类子串污染）', async ({ page }) => {
  await openEditor(page)
  await typeQuery(page, 't')

  await expect(rows(page)).toHaveCount(1)
  await expect(rows(page).first()).toContainText('表格')
})

test('命令码：/c 命中代码块', async ({ page }) => {
  await openEditor(page)
  await typeQuery(page, 'c')

  await expect(rows(page)).toHaveCount(1)
  await expect(rows(page).first()).toContainText('代码块')
})

test('别名：/css 命中插入 CSS', async ({ page }) => {
  await openEditor(page)
  await typeQuery(page, 'css')

  await expect(rows(page)).toHaveCount(1)
  await expect(rows(page).first()).toContainText('插入 CSS')

  await page.keyboard.press('Enter')
  await settle(page)
  expect(await rawDoc(page)).toContain('<style>')
})

test('父子直达：/n 列出标注及其 8 个二级选项', async ({ page }) => {
  await openEditor(page)
  await typeQuery(page, 'n')

  // 父项 + 8 个 callout 子项
  await expect(rows(page)).toHaveCount(9)
  await expect(rows(page).first()).toContainText('标注')
  await expect(rows(page)).toContainText(['注释', '信息', '提示', '成功', '警告', '危险', '错误', '疑问'])
})

test('子码独占：/nd 只命中危险标注', async ({ page }) => {
  await openEditor(page)
  await typeQuery(page, 'nd')

  await expect(rows(page)).toHaveCount(1)
  await expect(rows(page).first()).toContainText('危险')

  await page.keyboard.press('Enter')
  await settle(page)
  expect(await rawDoc(page)).toContain('> [!DANGER]')
})

test('空结果：/zzz 显示「无匹配项」，Escape 后不留空盒', async ({ page }) => {
  await openEditor(page)
  await typeQuery(page, 'zzz')

  await expect(page.locator('.mdb-slash-empty')).toHaveCount(1)
  await expect(page.locator('.mdb-slash-empty')).toHaveText('无匹配项')
  await expect(rows(page)).toHaveCount(0)

  await page.keyboard.press('Escape')
  await settle(page)
  await expect(page.locator('.mdb-slash-menu')).toHaveCount(0)

  const raw = await rawDoc(page)
  expect(raw).not.toContain('/zzz')
  expect(raw).not.toContain('/')
})

test('二级面板：/bt 后标题 flyout 展开 6 级，选H2 写入 ## ', async ({ page }) => {
  await openEditor(page)
  await typeQuery(page, 'bt')

  await rows(page).first().click()
  await expect(flyoutRows(page)).toHaveCount(6)
  await expect(flyoutRows(page).first()).toContainText('1 级标题')
  await expect(flyoutRows(page).last()).toContainText('6 级标题')

  await flyoutRows(page).filter({ hasText: '2 级标题' }).click()
  await settle(page)
  await expect(page.locator('.mdb-slash-menu')).toHaveCount(0)

  const raw = await rawDoc(page)
  expect(raw).toContain('## ')
  expect(raw).not.toContain('/bt')
})

test('取消：Escape 删除 `/query` 整段并关闭菜单', async ({ page }) => {
  await openEditor(page)
  await typeQuery(page, 'bt')

  await page.keyboard.press('Escape')
  await settle(page)
  await expect(page.locator('.mdb-slash-menu')).toHaveCount(0)

  const raw = await rawDoc(page)
  expect(raw).not.toContain('/bt')
  expect(raw).not.toContain('/')
  // 文档内容本身未被破坏
  expect(raw).toContain('# Title')
})

test('取消：点击编辑器空白处关闭菜单并清理 `/query`', async ({ page }) => {
  await openEditor(page)
  await typeQuery(page, 'bt')

  await page.locator('.cm-content').click({ position: { x: 10, y: 10 } })
  await settle(page)
  await expect(page.locator('.mdb-slash-menu')).toHaveCount(0)

  const raw = await rawDoc(page)
  expect(raw).not.toContain('/bt')
  expect(raw).not.toContain('/')
})

test('取消：caret 离开菜单范围（ArrowLeft）后菜单关闭并清理', async ({ page }) => {
  await openEditor(page)
  await typeQuery(page, 'bt')

  await page.keyboard.press('ArrowLeft')
  await settle(page)
  await expect(page.locator('.mdb-slash-menu')).toHaveCount(0)

  const raw = await rawDoc(page)
  expect(raw).not.toContain('/bt')
  expect(raw).not.toContain('/')
})