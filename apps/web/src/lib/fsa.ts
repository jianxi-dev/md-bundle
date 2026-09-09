// FSA 能力层（任务 21，Wave 5）—— 文件系统访问 API 的能力检测 / 目录授权 /
// 权限续期 / 工作区句柄持久化。仅 Chromium 渐进增强，无 FSA 环境整体禁用不报错。
//
// 职责边界：
// - isFsaAvailable：三项 picker（showDirectoryPicker/showSaveFilePicker/showOpenFilePicker）
//   存在性检测，任一缺失 → false（调用方据此降级隐藏文件树）。
// - grantWorkspaceFolder：showDirectoryPicker({ mode:'readwrite' }) 授权工作区目录。
// - requestReGrant：handle.requestPermission() 续权，拒权 → { error:'permission-denied' }。
// - persist/load/clearWorkspaceHandle：工作区目录句柄的 IndexedDB 持久化
//   （FileSystemHandle 是 structured clone 可序列化类型）。
// - 文件树 UI（任务 22）与保存模型（任务 24）为独立任务；完整会话
//   （tabs/recentDocs/单文件句柄）由 sessionStore（任务 18）负责，本模块只管理
//   「工作区目录句柄」——FileTree（任务 22）重入后免二次授权的依据。
//
// 契约：所有公开函数返回 {ok}|{error} 判别联合，永不 throw（IO 边界契约）。

// ── 全局类型补齐 ──────────────────────────────────────────────
// lib.dom 自带 FileSystemHandle/FileSystemDirectoryHandle/FileSystemFileHandle，
// 但缺少 picker 方法与 requestPermission（属 @types/wicg-file-system-access）。
// 此处最小补齐本模块所需类型（interface 合并，不影响其他模块）。

declare global {
  interface FileSystemDirectoryPickerOptions {
    id?: string;
    mode?: 'read' | 'readwrite';
    startIn?:
      | 'desktop'
      | 'documents'
      | 'downloads'
      | 'music'
      | 'pictures'
      | 'videos'
      | FileSystemHandle;
  }

  interface FileSystemHandle {
    requestPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
  }

  interface Window {
    showDirectoryPicker(
      options?: FileSystemDirectoryPickerOptions,
    ): Promise<FileSystemDirectoryHandle>;
    showSaveFilePicker(options?: object): Promise<FileSystemFileHandle>;
    showOpenFilePicker(options?: object): Promise<FileSystemFileHandle[]>;
  }
}

/** FSA 失败错误码（确定性字面量，调用方据此分流 UI 文案）。 */
export type FsaError =
  | 'unavailable'
  | 'cancelled'
  | 'permission-denied'
  | 'persist-failed'
  | 'load-failed';

/** 授权结果。 */
export type FsaGrantResult =
  | { ok: true; handle: FileSystemDirectoryHandle }
  | { ok: false; error: FsaError };

/** 续权结果。 */
export type FsaReGrantResult = { ok: true } | { ok: false; error: FsaError };

/** 持久化 / 清除结果。 */
export type FsaPersistResult = { ok: true } | { ok: false; error: FsaError };

/** 读取已持久化句柄结果；empty=true 表示无数据（首次访问，非错误）。 */
export type FsaLoadResult =
  | { ok: true; handle: FileSystemDirectoryHandle }
  | { ok: false; empty: true }
  | { ok: false; error: FsaError };

/**
 * 能力检测：三项 picker 均存在且为函数才返回 true。
 * 任一缺失 → false（调用方整体降级隐藏文件树，不报错）。
 */
export function isFsaAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    typeof window.showDirectoryPicker === 'function' &&
    typeof window.showSaveFilePicker === 'function' &&
    typeof window.showOpenFilePicker === 'function'
  );
}

/** 判断用户取消（AbortError）；DOMException 缺失时退回 name 字段判断。 */
function isAbortError(e: unknown): boolean {
  if (e instanceof DOMException) return e.name === 'AbortError';
  return (
    e !== null &&
    typeof e === 'object' &&
    (e as { name?: unknown }).name === 'AbortError'
  );
}

/**
 * 授权工作区目录（readwrite）。成功返回目录句柄；用户取消 → {error:'cancelled'}；
 * FSA 不可用 → {error:'unavailable'}；权限拒绝等异常 → {error:'permission-denied'}。
 * 不在此持久化 —— 调用方需显式 persistWorkspaceHandle（任务 22 接线）。
 */
export async function grantWorkspaceFolder(): Promise<FsaGrantResult> {
  if (!isFsaAvailable()) {
    return { ok: false, error: 'unavailable' };
  }
  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    return { ok: true, handle };
  } catch (e) {
    if (isAbortError(e)) return { ok: false, error: 'cancelled' };
    return { ok: false, error: 'permission-denied' };
  }
}

/**
 * 续权：requestPermission({ mode:'readwrite' })。granted → {ok:true}；
 * denied/prompt（用户未授予）→ {error:'permission-denied'}；用户关闭弹窗 → 'cancelled'。
 */
export async function requestReGrant(handle: FileSystemHandle): Promise<FsaReGrantResult> {
  try {
    const state = await handle.requestPermission({ mode: 'readwrite' });
    if (state === 'granted') return { ok: true };
    return { ok: false, error: 'permission-denied' };
  } catch (e) {
    if (isAbortError(e)) return { ok: false, error: 'cancelled' };
    return { ok: false, error: 'permission-denied' };
  }
}

// ── 工作区句柄持久化（IndexedDB + structured clone） ──────────

/** 存储注入缝：测试注入内存 fake；生产用 IndexedDB 实现（structured clone 序列化句柄）。 */
export interface WorkspaceHandleStore {
  /** 读取已持久化的目录句柄；无 → null。 */
  get(): Promise<FileSystemDirectoryHandle | null>;
  /** 写入目录句柄（structured clone 序列化）。 */
  set(handle: FileSystemDirectoryHandle): Promise<void>;
  /** 清除（撤销授权后调用）。 */
  clear(): Promise<void>;
}

const FSA_DB_NAME = 'md-bundle-fsa';
const FSA_DB_VERSION = 1;
const FSA_STORE_NAME = 'handles';
const WORKSPACE_KEY = 'workspace';

function openFsaDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(FSA_DB_NAME, FSA_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(FSA_STORE_NAME)) {
        db.createObjectStore(FSA_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function fsaDbGet(db: IDBDatabase): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FSA_STORE_NAME, 'readonly');
    const req = tx.objectStore(FSA_STORE_NAME).get(WORKSPACE_KEY);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function fsaDbPut(db: IDBDatabase, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FSA_STORE_NAME, 'readwrite');
    const req = tx.objectStore(FSA_STORE_NAME).put(value, WORKSPACE_KEY);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function fsaDbDelete(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FSA_STORE_NAME, 'readwrite');
    const req = tx.objectStore(FSA_STORE_NAME).delete(WORKSPACE_KEY);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** 默认 IndexedDB 存储实现。 */
function defaultStore(): WorkspaceHandleStore {
  return {
    async get() {
      const db = await openFsaDb();
      try {
        const v = await fsaDbGet(db);
        return (v as FileSystemDirectoryHandle | null | undefined) ?? null;
      } finally {
        db.close();
      }
    },
    async set(handle) {
      const db = await openFsaDb();
      try {
        await fsaDbPut(db, handle);
      } finally {
        db.close();
      }
    },
    async clear() {
      const db = await openFsaDb();
      try {
        await fsaDbDelete(db);
      } finally {
        db.close();
      }
    },
  };
}

/**
 * 持久化工作区目录句柄（structured clone 写入 IndexedDB）。
 * 失败（配额 / 隐私模式）→ {error:'persist-failed'}，不抛。
 */
export async function persistWorkspaceHandle(
  handle: FileSystemDirectoryHandle,
  store: WorkspaceHandleStore = defaultStore(),
): Promise<FsaPersistResult> {
  try {
    await store.set(handle);
    return { ok: true };
  } catch {
    return { ok: false, error: 'persist-failed' };
  }
}

/**
 * 读取已持久化的工作区句柄；无数据 → {ok:false,empty:true}（首次访问，非错误）。
 * IndexedDB 不可用 → {error:'load-failed'}。
 */
export async function loadWorkspaceHandle(
  store: WorkspaceHandleStore = defaultStore(),
): Promise<FsaLoadResult> {
  try {
    const handle = await store.get();
    if (handle === null) return { ok: false, empty: true };
    return { ok: true, handle };
  } catch {
    return { ok: false, error: 'load-failed' };
  }
}

/**
 * 清除已持久化的工作区句柄（撤销授权后调用）。
 */
export async function clearWorkspaceHandle(
  store: WorkspaceHandleStore = defaultStore(),
): Promise<FsaPersistResult> {
  try {
    await store.clear();
    return { ok: true };
  } catch {
    return { ok: false, error: 'persist-failed' };
  }
}
