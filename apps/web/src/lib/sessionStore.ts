// IndexedDB 页签会话持久化（任务 18）。
// 存储：tabs + activeId + recentDocs + FSA 句柄（structured clone 可序列化 FileSystemHandle）。
// 自动保存：编辑防抖 500ms 写 IndexedDB；启动静默恢复；写失败 {error}+toast 不崩。
//
// 不用 idb-keyval 外部依赖 —— 最小原生封装（~40 行），commit 记理由：
// 单 key 全量写入已满足场景（会话数据 < 几 MB），无需 get/set 多 key 抽象。
import type { TabsState } from './tabs';

// ── 存储 schema ──────────────────────────────────────────────────

/** 最近文档条目（关闭页签后保留，供 RecentDocs 组件恢复）。 */
export interface RecentDocEntry {
  name: string;
  kind: 'md' | 'mdpkg';
  /** 关闭时的文档源码（恢复用）。 */
  source: string;
  /** 关闭时的编辑模式。 */
  mode: 'edit' | 'source' | 'preview';
  /** 关闭时的滚动位置。 */
  scrollPos: number;
  /** FSA diskHandle（有则恢复时可写回原文件）。 */
  diskHandle?: FileSystemFileHandle;
  /** 关闭时间戳（ms），最近排序 + 去重。 */
  closedAt: number;
}

/** 持久化 schema 版本。 */
const SCHEMA_VERSION = 1;

/** 完整会话快照（写入 IndexedDB 的唯一 value）。 */
interface SessionSnapshot {
  version: typeof SCHEMA_VERSION;
  tabs: TabsState;
  /** 最近关闭的文档（FIFO，上限 10）。 */
  recentDocs: RecentDocEntry[];
}

/** IndexedDB 数据库配置。 */
const DB_NAME = 'md-bundle';
const DB_VERSION = 1;
const STORE_NAME = 'session';
const SNAPSHOT_KEY = 'current';

// ── IndexedDB 最小封装 ──────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbGet(db: IDBDatabase, key: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbSet(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ── 形状校验 ────────────────────────────────────────────────────

function isValidSnapshot(v: unknown): v is SessionSnapshot {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const s = v as Record<string, unknown>;
  if (s.version !== SCHEMA_VERSION) return false;
  if (typeof s.tabs !== 'object' || s.tabs === null) return false;
  const tabs = s.tabs as Record<string, unknown>;
  if (!Array.isArray(tabs.tabs)) return false;
  if (tabs.activeId !== null && typeof tabs.activeId !== 'string') return false;
  if (!Array.isArray(s.recentDocs)) return false;
  // 逐条校验 recentDocs（损坏条目在 sanitize 中跳过）
  return true;
}

function sanitize(v: SessionSnapshot): SessionSnapshot {
  // 过滤损坏的 recentDoc 条目（缺必填字段 → 跳过）
  const recentDocs = v.recentDocs.filter(
    (e) =>
      e != null &&
      typeof e.name === 'string' &&
      (e.kind === 'md' || e.kind === 'mdpkg') &&
      typeof e.source === 'string' &&
      (e.mode === 'edit' || e.mode === 'source' || e.mode === 'preview') &&
      typeof e.scrollPos === 'number' &&
      typeof e.closedAt === 'number',
  );
  return {
    version: SCHEMA_VERSION,
    tabs: v.tabs,
    recentDocs,
  };
}

// ── 公开 API ────────────────────────────────────────────────────

/** 保存结果（IO 边界 {error} 契约，永不抛）。 */
export type SaveResult = { ok: true } | { ok: false; error: string };

/** 恢复结果。 */
export type RestoreResult =
  | { ok: true; snapshot: SessionSnapshot }
  | { ok: false; error: string }
  | { ok: false; empty: true };

/** 最近文档上限。 */
export const MAX_RECENT_DOCS = 10;

/**
 * 保存会话快照到 IndexedDB。
 * 失败返回 {ok:false,error} + 调用方弹 toast；永不 throw。
 * QuotaExceededError → 降级可用（不持久化，不崩）。
 */
export async function saveSession(
  tabs: TabsState,
  recentDocs: RecentDocEntry[],
): Promise<SaveResult> {
  const snapshot: SessionSnapshot = {
    version: SCHEMA_VERSION,
    tabs,
    recentDocs: recentDocs.slice(0, MAX_RECENT_DOCS),
  };

  try {
    const db = await openDB();
    try {
      await dbSet(db, SNAPSHOT_KEY, snapshot);
      return { ok: true };
    } finally {
      db.close();
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `会话保存失败：${msg}` };
  }
}

/**
 * 从 IndexedDB 恢复会话快照。
 * 无数据 → {ok:false,empty:true}（首次访问，非错误）。
 * 数据损坏 → 静默回退 {ok:false,empty:true}（不崩，不弹 toast）。
 * IndexedDB 不可用（隐私模式等）→ {ok:false,error}。
 */
export async function restoreSession(): Promise<RestoreResult> {
  try {
    const db = await openDB();
    try {
      const raw = await dbGet(db, SNAPSHOT_KEY);
      if (raw === undefined || raw === null) {
        return { ok: false, empty: true };
      }
      if (!isValidSnapshot(raw)) {
        // 损坏数据 → 静默回退，不弹 toast
        return { ok: false, empty: true };
      }
      const snapshot = sanitize(raw);
      return { ok: true, snapshot };
    } finally {
      db.close();
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `会话恢复失败：${msg}` };
  }
}

/**
 * 创建 RecentDocEntry（关闭页签时调用）。
 */
export function createRecentEntry(
  tab: {
    name: string;
    kind: 'md' | 'mdpkg';
    source: string;
    mode: 'edit' | 'source' | 'preview';
    scrollPos: number;
    diskHandle?: FileSystemFileHandle;
  },
  closedAt: number = Date.now(),
): RecentDocEntry {
  return {
    name: tab.name,
    kind: tab.kind,
    source: tab.source,
    mode: tab.mode,
    scrollPos: tab.scrollPos,
    diskHandle: tab.diskHandle,
    closedAt,
  };
}
