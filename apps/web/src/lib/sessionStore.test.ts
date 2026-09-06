// sessionStore 单元测试 —— IndexedDB round-trip + QuotaExceeded 降级。
// 任务 18：saveSession/restoreSession/createRecentEntry。
// 使用 fake-indexeddb 风格的内存 mock（无需外部依赖，jsdom 自带 indexedDB 不可用）。
import { afterAll, describe, expect, it, beforeEach, afterEach } from 'vitest';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  saveSession,
  restoreSession,
  createRecentEntry,
  MAX_RECENT_DOCS,
} from './sessionStore';
import type { RecentDocEntry } from './sessionStore';
import { createTabsState, addTab } from './tabs';

const here = dirname(fileURLToPath(import.meta.url));
const RES = join(here, '..', '..', 'test-results');

// ── 证据汇总 ──
const evidence = {
  tests: 0,
  roundTrip: false,
  emptyRestore: false,
  quotaExceededDegrades: false,
  corruptDataFallback: false,
  recentEntryCreated: false,
  maxRecentLimit: false,
  sanitizeSkipsBadEntries: false,
};

// ── 全局 indexedDB mock ──────────────────────────────────────────

// 共享存储（跨 open 调用持久化，模拟真实 IndexedDB 磁盘行为）
let sharedStore = new Map<string, unknown>();
let shouldFailWithQuota = false;

function createSharedMemoryIDB() {
  const db = {
    objectStoreNames: {
      contains: () => true, // store 始终存在（由共享存储管理）
    },
    createObjectStore: () => {},
    transaction: (_storeName: string, _mode: string) => {
      return {
        objectStore: () => ({
          get: (key: string) => {
            const req = {
              result: undefined as unknown,
              onsuccess: null as (() => void) | null,
              onerror: null as ((e?: unknown) => void) | null,
              error: null as DOMException | null,
            };
            queueMicrotask(() => {
              req.result = sharedStore.get(key);
              if (req.onsuccess) req.onsuccess();
            });
            return req;
          },
          put: (value: unknown, key: string) => {
            const req = {
              result: undefined as unknown,
              onsuccess: null as (() => void) | null,
              onerror: null as ((e?: unknown) => void) | null,
              error: null as DOMException | null,
            };
            queueMicrotask(() => {
              if (shouldFailWithQuota) {
                req.error = new DOMException('Quota exceeded', 'QuotaExceededError');
                if (req.onerror) req.onerror(req.error);
                return;
              }
              sharedStore.set(key, value);
              req.result = key;
              if (req.onsuccess) req.onsuccess();
            });
            return req;
          },
        }),
      };
    },
    close: () => {},
  };
  return db;
}

function installIDBMock() {
  const factory = {
    open: (_name: string, _version?: number) => {
      const db = createSharedMemoryIDB();
      const req = {
        result: db,
        onupgradeneeded: null as ((e: { target: { result: typeof db } }) => void) | null,
        onsuccess: null as (() => void) | null,
        onerror: null as ((e?: unknown) => void) | null,
        error: null as DOMException | null,
      };
      queueMicrotask(() => {
        if (req.onupgradeneeded) req.onupgradeneeded({ target: { result: db } });
        if (req.onsuccess) req.onsuccess();
      });
      return req;
    },
  };
  globalThis.indexedDB = factory as unknown as IDBFactory;
  return factory;
}

// ── 测试 ─────────────────────────────────────────────────────────

describe('sessionStore', () => {
  beforeEach(() => {
    sharedStore = new Map();
    shouldFailWithQuota = false;
    installIDBMock();
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).indexedDB;
  });

  it('saveSession + restoreSession round-trip', async () => {
    const s0 = createTabsState();
    const { state: s1, tabId } = addTab(s0, { kind: 'md', name: 'hello.md', source: '# Hello' });
    const recent = [createRecentEntry({ name: 'old.md', kind: 'md', source: 'old', mode: 'edit', scrollPos: 0 })];

    const saveResult = await saveSession(s1, recent);
    expect(saveResult.ok).toBe(true);

    const restoreResult = await restoreSession();
    expect(restoreResult.ok).toBe(true);
    if (restoreResult.ok) {
      expect(restoreResult.snapshot.tabs.tabs).toHaveLength(1);
      expect(restoreResult.snapshot.tabs.activeId).toBe(tabId);
      expect(restoreResult.snapshot.recentDocs).toHaveLength(1);
      expect(restoreResult.snapshot.recentDocs[0].name).toBe('old.md');
    }
    evidence.roundTrip = true;
    evidence.tests++;
  });

  it('restoreSession 无数据 → empty', async () => {
    const result = await restoreSession();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect('empty' in result && result.empty).toBe(true);
    }
    evidence.emptyRestore = true;
    evidence.tests++;
  });

  it('saveSession QuotaExceeded → {ok:false,error} 不崩', async () => {
    shouldFailWithQuota = true;

    const s = createTabsState();
    const result = await saveSession(s, []);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('会话保存失败');
    }
    evidence.quotaExceededDegrades = true;
    evidence.tests++;
  });

  it('restoreSession 损坏数据 → 静默回退 empty', async () => {
    // 直接写入损坏数据到共享存储
    sharedStore.set('current', { version: 999, tabs: 'not-an-object' });

    const result = await restoreSession();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect('empty' in result && result.empty).toBe(true);
    }
    evidence.corruptDataFallback = true;
    evidence.tests++;
  });

  it('createRecentEntry 正确构造条目', () => {
    const entry = createRecentEntry({
      name: 'test.md',
      kind: 'md',
      source: '# Test',
      mode: 'edit',
      scrollPos: 42,
    });
    expect(entry.name).toBe('test.md');
    expect(entry.kind).toBe('md');
    expect(entry.source).toBe('# Test');
    expect(entry.mode).toBe('edit');
    expect(entry.scrollPos).toBe(42);
    expect(typeof entry.closedAt).toBe('number');
    evidence.recentEntryCreated = true;
    evidence.tests++;
  });

  it('saveSession 超过 MAX_RECENT_DOCS 自动截断', async () => {
    const s = createTabsState();
    const manyRecent = Array.from({ length: MAX_RECENT_DOCS + 5 }, (_, i) =>
      createRecentEntry({ name: `doc${i}.md`, kind: 'md', source: `${i}`, mode: 'edit', scrollPos: 0 }),
    );

    await saveSession(s, manyRecent);
    const result = await restoreSession();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.recentDocs.length).toBe(MAX_RECENT_DOCS);
    }
    evidence.maxRecentLimit = true;
    evidence.tests++;
  });

  it('sanitize 跳过损坏的 recentDoc 条目', async () => {
    // 构造含损坏条目的 recentDocs 数组
    const recentDocs: RecentDocEntry[] = [
      createRecentEntry({ name: 'good.md', kind: 'md', source: 'ok', mode: 'edit', scrollPos: 0 }),
      { name: '', kind: 'md', source: '', mode: 'edit', scrollPos: 0, closedAt: 0 },
      null as unknown as RecentDocEntry,
      { name: 'bad.md', kind: 'invalid' as 'md', source: 'x', mode: 'edit', scrollPos: 0, closedAt: 0 },
    ];

    // 通过 saveSession 写入（它会序列化）
    await saveSession(createTabsState(), recentDocs);

    const result = await restoreSession();
    expect(result.ok).toBe(true);
    if (result.ok) {
      const names = result.snapshot.recentDocs.map((e) => e.name);
      expect(names).toContain('good.md');
      expect(names).not.toContain('bad.md');
    }
    evidence.sanitizeSkipsBadEntries = true;
    evidence.tests++;
  });
});

afterAll(() => {
  writeFileSync(join(RES, 'sessionStore.json'), JSON.stringify(evidence, null, 2));
});
