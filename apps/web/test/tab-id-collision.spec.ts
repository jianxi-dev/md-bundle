// tab-id-collision 回归测试（Issue #376）：
// 场景：已有会话包含 tab-1..tab-N，刷新后新建文档 → 新 tab id 不应与恢复的 id 冲突。
// 验证：(a) 无 React duplicate-key 控制台报错 (b) 仅一个 aria-selected=true (c) 新 tab 编辑器为空。
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const RES = join(here, '..', 'test-results');

const evidence = {
  noDuplicateKeyError: false,
  singleAriaSelected: false,
  newTabEditorEmpty: false,
};

test.use({ viewport: { width: 1280, height: 800 } });
test.describe.configure({ mode: 'serial' });

/**
 * 向 IndexedDB 写入模拟会话快照（包含 tab-1, tab-2）。
 * 先导航到应用首页（触发首次加载），再在页面上下文中写入 IndexedDB，
 * 验证写入成功后 reload 页面触发 restoreSession。
 * 使用与应用一致的 DB_NAME/DB_VERSION/STORE_NAME/SNAPSHOT_KEY。
 */
async function seedSessionWithTabs(page: import('@playwright/test').Page, tabCount: number) {
  // 先打开应用首页（建立同源上下文）
  await page.goto('/');
  // 等待 Landing 页渲染完成（确保页面就绪）
  await expect(page.getByTestId('landing-nav')).toBeVisible({ timeout: 10000 });

  // 在页面上下文中写入会话数据（使用应用一致的常量）
  await page.evaluate((count) => {
    return new Promise<void>((resolve, reject) => {
      const DB_NAME = 'md-bundle';
      const DB_VERSION = 1;
      const STORE_NAME = 'session';
      const SNAPSHOT_KEY = 'current';

      const deleteReq = indexedDB.deleteDatabase(DB_NAME);
      deleteReq.onsuccess = () => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);

          const tabs = Array.from({ length: count }, (_, i) => ({
            id: `tab-${i + 1}`,
            kind: 'md',
            name: `doc${i + 1}.md`,
            source: `# Document ${i + 1}\n\nContent for doc ${i + 1}.`,
            assets: [],
            mode: 'edit',
            scrollPos: 0,
            dirty: false,
          }));

          const snapshot = {
            version: 1,
            tabs: { tabs, activeId: tabs[0].id },
            recentDocs: [],
          };

          const putReq = store.put(snapshot, SNAPSHOT_KEY);
          putReq.onsuccess = () => {
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
          };
          putReq.onerror = () => {
            db.close();
            reject(putReq.error);
          };
        };
        request.onerror = () => reject(request.error);
      };
      deleteReq.onerror = () => reject(deleteReq.error);
    });
  }, tabCount);

  // 验证数据已写入：读回快照确认
  const verified = await page.evaluate(async () => {
    return new Promise<boolean>((resolve) => {
      const DB_NAME = 'md-bundle';
      const DB_VERSION = 1;
      const STORE_NAME = 'session';
      const SNAPSHOT_KEY = 'current';

      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const getReq = store.get(SNAPSHOT_KEY);
        getReq.onsuccess = () => {
          const ok = !!getReq.result?.tabs?.tabs?.length;
          db.close();
          resolve(ok);
        };
        getReq.onerror = () => {
          db.close();
          resolve(false);
        };
      };
      request.onerror = () => resolve(false);
    });
  });
  if (!verified) throw new Error('IndexedDB session seed verification failed');

  // 刷新页面触发 restoreSession
  await page.reload();
}

/**
 * 捕获控制台错误，特别关注 React duplicate key 警告。
 */
function captureConsoleErrors(page: import('@playwright/test').Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      const text = msg.text();
      if (text.includes('duplicate key') || text.includes('Duplicate key') || text.includes('Encountered two children with the same key')) {
        errors.push(text);
      }
    }
  });
  page.on('pageerror', (err) => {
    const text = String(err);
    if (text.includes('duplicate key') || text.includes('Duplicate key') || text.includes('Encountered two children with the same key')) {
      errors.push(text);
    }
  });
  return errors;
}

test('刷新后新建文档：tab id 不冲突，仅一个 aria-selected，新 tab 编辑器为空', async ({ page }) => {
  const consoleErrors = captureConsoleErrors(page);

  // 1. 预置会话：两个 tab (tab-1, tab-2)，seedSessionWithTabs 内部已 reload
  await seedSessionWithTabs(page, 2);

  // 2. 等待页签条渲染（seedSessionWithTabs 结束时已在恢复后的页面）
  await expect(page.getByTestId('tab-strip')).toBeVisible();
  await expect(page.getByTestId('tab-strip').locator('[role="tab"]')).toHaveCount(2);

  // 3. 点击「新建文档」按钮（页签条右侧 +）
  await page.getByTestId('tab-add').click();

  // 4. 验证：现在应有 3 个 tab（2 个恢复的 + 1 个新建的）
  await expect(page.getByTestId('tab-strip').locator('[role="tab"]')).toHaveCount(3);

  // (a) 无 React duplicate-key 控制台报错
  const duplicateKeyErrors = consoleErrors.filter((e) =>
    e.includes('duplicate key') || e.includes('Duplicate key') || e.includes('Encountered two children with the same key')
  );
  expect(duplicateKeyErrors).toHaveLength(0);
  evidence.noDuplicateKeyError = true;

  // (b) 仅一个 [role=tab][aria-selected=true]
  const selectedTabs = page.getByTestId('tab-strip').locator('[role="tab"][aria-selected="true"]');
  await expect(selectedTabs).toHaveCount(1);
  evidence.singleAriaSelected = true;

  // (c) 新 tab（最后一个）的编辑器为空
  // 先切到编辑模式
  await page.getByTestId('mode-edit-btn').click();

  // 新建的 tab 应该是 active（addTab 会设置 activeId 为新 tab）
  const cmContent = page.locator('[data-testid="mode-pane-editor"] .cm-content');
  // 编辑器内容应为空（仅可能有空行）
  const editorText = await cmContent.textContent();
  expect(editorText?.trim()).toBe('');
  evidence.newTabEditorEmpty = true;
});

test.afterAll(() => {
  writeFileSync(join(RES, 'tab-id-collision.json'), JSON.stringify(evidence, null, 2));
});