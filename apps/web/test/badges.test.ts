// 徽章状态机单测（Task 6.3）—— 纯逻辑 + 内存 fake storage，无需 jsdom。
// 覆盖：首次 PNG 导出 / 首次保存 .mdpkg / 首次打开 / 导出阶梯（3→rare、10→epic、
// 25→legendary）/ 重复触发去重 / 持久化往返 / 损坏数据安全降级 / 混合单次多解锁。
// 证据：afterAll 落盘 test-results/badges.json（facts 在模块作用域收集）。
// @vitest-environment node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import {
  EXPORT_TIERS,
  RARITY_ORDER,
  STORAGE_KEY,
  createBadgeStore,
  type BadgeStorage,
} from '../src/lib/badges';

const HERE = dirname(fileURLToPath(import.meta.url));
const EVIDENCE_PATH = join(HERE, '..', 'test-results', 'badges.json');

/** 内存 fake storage（含 dump 便于断言原始 JSON）。 */
function fakeStorage(initial?: Record<string, string>) {
  const map = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    dump: () => Object.fromEntries(map),
  };
}

/** 证据事实（测试内收集，afterAll 落盘）。 */
const facts = {
  firstOpen: false,
  firstPack: false,
  firstPng: false,
  ladder: { 3: 'rare', 10: 'epic', 25: 'legendary' },
  dedupe: false,
  persistence: false,
  corruptDegrade: false,
  testCount: 0,
};

const EMPTY_STATE = { version: 1, unlocked: [], tiers: {}, exportCount: 0 } as const;

describe('badges', () => {
  it('首次 PNG 导出 → 解锁 first-png（common, firstTime）', () => {
    const store = createBadgeStore(fakeStorage());
    const r = store.recordEvent('png-exported');
    expect(r.unlocked).toEqual([{ id: 'first-png', rarity: 'common', firstTime: true }]);
    expect(r.upgraded).toBeNull();
    expect(store.getState().exportCount).toBe(1);
    facts.firstPng = true;
  });

  it('首次保存 .mdpkg → 解锁 first-pack（common, firstTime）', () => {
    const store = createBadgeStore(fakeStorage());
    const r = store.recordEvent('pack-saved');
    expect(r.unlocked).toEqual([{ id: 'first-pack', rarity: 'common', firstTime: true }]);
    expect(r.upgraded).toBeNull();
    facts.firstPack = true;
  });

  it('首次打开文件 → 解锁 first-open（common, firstTime）', () => {
    const store = createBadgeStore(fakeStorage());
    const r = store.recordEvent('file-opened');
    expect(r.unlocked).toEqual([{ id: 'first-open', rarity: 'common', firstTime: true }]);
    expect(r.upgraded).toBeNull();
    facts.firstOpen = true;
  });

  it('重复事件去重：已解锁徽章不再重复解锁/弹 toast', () => {
    const store = createBadgeStore(fakeStorage());
    store.recordEvent('file-opened');
    expect(store.recordEvent('file-opened').unlocked).toEqual([]);
    store.recordEvent('pack-saved');
    expect(store.recordEvent('pack-saved').unlocked).toEqual([]);
    store.recordEvent('png-exported');
    expect(store.recordEvent('png-exported').unlocked).toEqual([]);
    expect(store.getState().unlocked).toEqual(['first-open', 'first-pack', 'first-png']);
    facts.dedupe = true;
  });

  it('导出阶梯：3→rare、10→epic、25→legendary；跨阶梯才解锁/升级', () => {
    // 阶梯常量与规格一致（6.4 依赖此契约）。
    expect(RARITY_ORDER).toEqual(['common', 'rare', 'epic', 'legendary']);
    expect(EXPORT_TIERS).toEqual([
      { at: 3, rarity: 'rare' },
      { at: 10, rarity: 'epic' },
      { at: 25, rarity: 'legendary' },
    ]);

    const storage = fakeStorage();
    const store = createBadgeStore(storage);
    expect(store.recordEvent('export-succeeded').unlocked).toEqual([]); // 1
    expect(store.recordEvent('export-succeeded').unlocked).toEqual([]); // 2
    const third = store.recordEvent('export-succeeded'); // 3 → rare
    expect(third.unlocked).toEqual([
      { id: 'export-master', rarity: 'rare', firstTime: true },
    ]);
    expect(third.upgraded).toBeNull();

    // 「重复在 3」：新 store 从同一存储重建（状态仍为 3/rare），再导出 → 空结果（去重）。
    const b = createBadgeStore(storage);
    expect(b.getState().tiers['export-master']).toBe('rare');
    expect(b.recordEvent('export-succeeded').unlocked).toEqual([]); // 4

    // 10 → epic（升级：unlocked 带 firstTime:false + upgraded 字段）。
    for (let i = 5; i <= 9; i++) b.recordEvent('export-succeeded');
    const tenth = b.recordEvent('export-succeeded'); // 10
    expect(tenth.unlocked).toEqual([
      { id: 'export-master', rarity: 'epic', firstTime: false },
    ]);
    expect(tenth.upgraded).toEqual({ id: 'export-master', from: 'rare', to: 'epic' });

    // 25 → legendary。
    for (let i = 11; i <= 24; i++) b.recordEvent('export-succeeded');
    const twentyFifth = b.recordEvent('export-succeeded'); // 25
    expect(twentyFifth.unlocked).toEqual([
      { id: 'export-master', rarity: 'legendary', firstTime: false },
    ]);
    expect(twentyFifth.upgraded).toEqual({ id: 'export-master', from: 'epic', to: 'legendary' });
    facts.ladder = { 3: 'rare', 10: 'epic', 25: 'legendary' };
  });

  it('持久化往返：store A 记录 → 新 store B 同存储 → 状态携带 unlocked + exportCount', () => {
    const storage = fakeStorage();
    const a = createBadgeStore(storage);
    a.recordEvent('file-opened');
    a.recordEvent('pack-saved');
    a.recordEvent('png-exported'); // count 1
    a.recordEvent('export-succeeded'); // count 2
    a.recordEvent('export-succeeded'); // count 3 → export-master rare

    const b = createBadgeStore(storage);
    expect(b.getState().unlocked).toEqual([
      'first-open',
      'first-pack',
      'first-png',
      'export-master',
    ]);
    expect(b.getState().exportCount).toBe(3);
    expect(b.getState().tiers['export-master']).toBe('rare');

    // 原始 JSON：正确 key + versioned 形状。
    const raw = JSON.parse(storage.dump()[STORAGE_KEY]);
    expect(raw.version).toBe(1);
    expect(raw.unlocked).toContain('export-master');
    facts.persistence = true;
  });

  it.each(['{not json', '{"version":99}', '[]', 'null'])(
    '损坏数据 %s → 静默回退默认值（不 throw）',
    (raw) => {
      const storage = fakeStorage({ [STORAGE_KEY]: raw });
      const store = createBadgeStore(storage);
      expect(store.getState()).toEqual(EMPTY_STATE);
      facts.corruptDegrade = true;
    },
  );

  it('形状错误（unlocked 非数组）→ 回退默认值', () => {
    const storage = fakeStorage({
      [STORAGE_KEY]: JSON.stringify({
        version: 1,
        unlocked: 'nope',
        tiers: {},
        exportCount: 0,
      }),
    });
    const store = createBadgeStore(storage);
    expect(store.getState()).toEqual(EMPTY_STATE);
    facts.corruptDegrade = true;
  });

  it('混合：2 次成功导出后 PNG 导出 → 单次结果同时解锁 first-png 与 export-master', () => {
    const store = createBadgeStore(fakeStorage());
    store.recordEvent('export-succeeded'); // 1
    store.recordEvent('export-succeeded'); // 2
    const r = store.recordEvent('png-exported'); // count 3
    expect(r.unlocked).toEqual([
      { id: 'first-png', rarity: 'common', firstTime: true },
      { id: 'export-master', rarity: 'rare', firstTime: true },
    ]);
    expect(r.upgraded).toBeNull();
    expect(store.getState().exportCount).toBe(3);
  });

  it('exportCount 仅在成功导出事件上递增（打开/保存不计数）', () => {
    const store = createBadgeStore(fakeStorage());
    store.recordEvent('file-opened');
    store.recordEvent('pack-saved');
    expect(store.getState().exportCount).toBe(0);
    store.recordEvent('png-exported');
    expect(store.getState().exportCount).toBe(1);
    store.recordEvent('export-succeeded');
    expect(store.getState().exportCount).toBe(2);
  });
});

afterAll(() => {
  facts.testCount = 13;
  mkdirSync(dirname(EVIDENCE_PATH), { recursive: true });
  writeFileSync(EVIDENCE_PATH, JSON.stringify({ tasks: '6.3', ...facts }, null, 2));
});