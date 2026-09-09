// 拖放 zip / 文件夹 e2e（Bug 2/3/4）：整窗 drop 分流到解压/遍历路径。
//   ① 落地页拖入 .zip（内含 .md）→ 立即打开
//   ② 落地页拖入文件夹（mock 目录句柄，内含 .md）→ 立即打开
//   ③ 落地页拖入无文档 .zip → 提示「未找到」
//   ④ 落地页拖入空文件夹 → 提示「未找到」
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { makeZip } from './helpers/makeZip';

const here = dirname(fileURLToPath(import.meta.url));
const RES = join(here, '..', 'test-results');

test.use({ viewport: { width: 1280, height: 800 } });
test.describe.configure({ mode: 'serial' });

const DROP_FN = `
  ((target, fileDefs) => {
    const dt = new DataTransfer();
    for (const f of fileDefs) {
      const bytes = Uint8Array.from(atob(f.buffer), (c) => c.charCodeAt(0));
      const file = new File([bytes], f.name, { type: f.type });
      dt.items.add(file);
    }
    const ev = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'dataTransfer', { value: dt });
    target.dispatchEvent(ev);
  })
`;

// 拖文件夹：真实 Chrome 中文件夹的 item.kind 也是 'file'（App.tsx 用 getDirectoryHandle 检测目录），
// 故 mock item 用 kind='file' + getAsFileSystemHandle 返回目录句柄。
const DROP_DIR_FN = `
  ((target, dirName, entries) => {
    const dt = new DataTransfer();
    const mockHandle = {
      kind: 'directory',
      name: dirName,
      entries: async function* () {
        for (const e of entries) {
          yield [e.name, {
            kind: 'file',
            name: e.name,
            getFile: async () => new File([e.content], e.name, { type: 'text/markdown' }),
          }];
        }
      },
    };
    const item = {
      kind: 'file',
      getAsFile: () => null,
      getAsFileSystemHandle: async () => mockHandle,
    };
    Object.defineProperty(dt, 'items', {
      value: [item],
      configurable: true,
    });
    const ev = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'dataTransfer', { value: dt });
    target.dispatchEvent(ev);
  })
`;

const zipWithDoc = Buffer.from(
  makeZip([{ name: 'notes/guide.md', content: '# 从 zip 打开' }]),
).toString('base64');
const zipNoDoc = Buffer.from(makeZip([{ name: 'a.txt', content: 'x' }])).toString('base64');

const evidence: Record<string, boolean> = {};

test('empty page: drop .zip opens inner .md', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-testid="landing-nav"]')).toBeVisible();

  await page.evaluate(
    DROP_FN + `(document.body, [{name:'bundle.zip',type:'application/zip',buffer:'${zipWithDoc}'}])`,
  );

  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.cm-content').first()).toContainText('从 zip 打开');
  await page.screenshot({ path: join(RES, 'dragdrop-zip-open.png'), fullPage: false });
  evidence.openZip = true;
});

test('empty page: drop folder opens inner .md', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-testid="landing-nav"]')).toBeVisible();

  await page.evaluate(
    DROP_DIR_FN + `(document.body, 'notes', [{name:'folder.md', content:'# 从文件夹打开'}])`,
  );

  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.cm-content').first()).toContainText('从文件夹打开');
  await page.screenshot({ path: join(RES, 'dragdrop-folder-open.png'), fullPage: false });
  evidence.openFolder = true;
});

test('empty page: drop .zip without doc shows hint', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-testid="landing-nav"]')).toBeVisible();

  await page.evaluate(
    DROP_FN + `(document.body, [{name:'empty.zip',type:'application/zip',buffer:'${zipNoDoc}'}])`,
  );

  await expect(page.locator('[data-testid="import-hint"]')).toContainText('未找到', { timeout: 3000 });
  await expect(page.locator('.cm-editor')).toHaveCount(0, { timeout: 2000 });
  await page.screenshot({ path: join(RES, 'dragdrop-zip-nodoc.png'), fullPage: false });
  evidence.zipNoDocHint = true;
});

test('empty page: drop empty folder shows hint', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-testid="landing-nav"]')).toBeVisible();

  await page.evaluate(
    DROP_DIR_FN + `(document.body, 'empty', [])`,
  );

  await expect(page.locator('[data-testid="import-hint"]')).toContainText('未找到', { timeout: 3000 });
  await expect(page.locator('.cm-editor')).toHaveCount(0, { timeout: 2000 });
  await page.screenshot({ path: join(RES, 'dragdrop-folder-empty.png'), fullPage: false });
  evidence.folderEmptyHint = true;
});

test.afterAll(() => {
  writeFileSync(join(RES, 'v2-dragdrop-zip-folder.json'), JSON.stringify(evidence, null, 2) + '\n');
});