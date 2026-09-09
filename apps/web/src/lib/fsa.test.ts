// lib/fsa 单元测试 —— FSA 能力层（任务 21）。
// 覆盖四分支：授权（grantWorkspaceFolder）/ 持久（persist+load structured clone）/
// 续权（requestReGrant granted）/ 拒权（denied/prompt/cancelled）。
// 能力检测（isFsaAvailable）覆盖三项 picker 逐一缺失的场景。
// 无真实 IndexedDB（jsdom 不含）—— 持久化走注入的 WorkspaceHandleStore 内存 fake，
// 其 get/set 用 structuredClone 模拟 IndexedDB 的 structured clone 序列化。
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isFsaAvailable,
  grantWorkspaceFolder,
  requestReGrant,
  persistWorkspaceHandle,
  loadWorkspaceHandle,
  clearWorkspaceHandle,
} from './fsa';
import type { WorkspaceHandleStore } from './fsa';

const here = dirname(fileURLToPath(import.meta.url));
const RES = join(here, '..', '..', 'test-results');

// 证据汇总（serial + afterAll 落盘）；tests 数须与 it() 数一致（keep in sync）。
const evidence = {
  tests: 0,
  fsaAvailable: false,
  fsaMissingOpenPicker: false,
  fsaMissingSavePicker: false,
  fsaMissingDirPicker: false,
  grantSuccess: false,
  grantUnavailable: false,
  grantCancelled: false,
  grantDenied: false,
  reGrantGranted: false,
  reGrantDenied: false,
  reGrantPrompt: false,
  reGrantCancelled: false,
  persistRoundTrip: false,
  loadEmpty: false,
  clearWorkspace: false,
  persistFailed: false,
  loadFailed: false,
};

// ── 测试替身 ──────────────────────────────────────────────────

type PickerName = 'showDirectoryPicker' | 'showSaveFilePicker' | 'showOpenFilePicker';

const PICKERS: readonly PickerName[] = [
  'showDirectoryPicker',
  'showSaveFilePicker',
  'showOpenFilePicker',
];

/** 构造假目录句柄（含 requestPermission，默认 granted）。 */
function makeDirHandle(
  name = 'Workspace',
  permission: PermissionState = 'granted',
): FileSystemDirectoryHandle {
  return {
    kind: 'directory',
    name,
    isSameEntry: async () => false,
    requestPermission: async () => permission,
  } as unknown as FileSystemDirectoryHandle;
}

/**
 * 构造 structured-clone 安全的目录句柄（仅 kind + name）。
 * 真实 FileSystemHandle 经 structured clone 只保留结构化身份（kind/name），
 * 方法由浏览器在反序列化时经内部槽位重新绑定 —— 故持久化替身仅含身份字段。
 */
function makePersistableHandle(name = 'Workspace'): FileSystemDirectoryHandle {
  return { kind: 'directory', name } as unknown as FileSystemDirectoryHandle;
}

const defaultDir = makeDirHandle('Workspace');
const fakeFile = { kind: 'file', name: 'a.md' } as unknown as FileSystemFileHandle;

/** 安装三项 picker（默认返回 defaultDir / fakeFile）。 */
function installPickers(dir: FileSystemDirectoryHandle = defaultDir): void {
  window.showDirectoryPicker = async () => dir;
  window.showSaveFilePicker = async () => fakeFile;
  window.showOpenFilePicker = async () => [fakeFile];
}

function removePicker(name: PickerName): void {
  Reflect.deleteProperty(window, name);
}

/** 内存存储 fake：get/set 用 structuredClone 模拟 IndexedDB 的序列化。 */
function makeMemoryStore(): WorkspaceHandleStore {
  let stored: FileSystemDirectoryHandle | null = null;
  return {
    async get() {
      return stored === null ? null : (structuredClone(stored) as FileSystemDirectoryHandle);
    },
    async set(handle) {
      stored = structuredClone(handle) as FileSystemDirectoryHandle;
    },
    async clear() {
      stored = null;
    },
  };
}

/** 恒抛存储：模拟 IndexedDB 不可用。 */
const throwingStore: WorkspaceHandleStore = {
  async get() {
    throw new Error('indexeddb unavailable');
  },
  async set() {
    throw new Error('indexeddb unavailable');
  },
  async clear() {
    throw new Error('indexeddb unavailable');
  },
};

beforeEach(() => {
  installPickers();
});

afterEach(() => {
  for (const p of PICKERS) removePicker(p);
});

// ── 能力检测 ──────────────────────────────────────────────────

describe('isFsaAvailable 能力检测', () => {
  it('三项 picker 齐备 → true', () => {
    expect(isFsaAvailable()).toBe(true);
    evidence.fsaAvailable = true;
    evidence.tests++;
  });

  it('缺 showOpenFilePicker → false', () => {
    removePicker('showOpenFilePicker');
    expect(isFsaAvailable()).toBe(false);
    evidence.fsaMissingOpenPicker = true;
    evidence.tests++;
  });

  it('缺 showSaveFilePicker → false', () => {
    removePicker('showSaveFilePicker');
    expect(isFsaAvailable()).toBe(false);
    evidence.fsaMissingSavePicker = true;
    evidence.tests++;
  });

  it('缺 showDirectoryPicker → false', () => {
    removePicker('showDirectoryPicker');
    expect(isFsaAvailable()).toBe(false);
    evidence.fsaMissingDirPicker = true;
    evidence.tests++;
  });
});

// ── 授权 ──────────────────────────────────────────────────────

describe('grantWorkspaceFolder 目录授权', () => {
  it('授权成功返回目录句柄，并请求 readwrite', async () => {
    let capturedMode: string | undefined;
    window.showDirectoryPicker = async (options) => {
      capturedMode = options?.mode;
      return defaultDir;
    };
    const res = await grantWorkspaceFolder();
    expect(res).toEqual({ ok: true, handle: defaultDir });
    expect(capturedMode).toBe('readwrite');
    evidence.grantSuccess = true;
    evidence.tests++;
  });

  it('FSA 不可用 → {error:unavailable}', async () => {
    for (const p of PICKERS) removePicker(p);
    const res = await grantWorkspaceFolder();
    expect(res).toEqual({ ok: false, error: 'unavailable' });
    evidence.grantUnavailable = true;
    evidence.tests++;
  });

  it('用户取消（AbortError）→ {error:cancelled}', async () => {
    window.showDirectoryPicker = async () => {
      throw new DOMException('The user aborted a request.', 'AbortError');
    };
    const res = await grantWorkspaceFolder();
    expect(res).toEqual({ ok: false, error: 'cancelled' });
    evidence.grantCancelled = true;
    evidence.tests++;
  });

  it('权限拒绝（SecurityError）→ {error:permission-denied}', async () => {
    window.showDirectoryPicker = async () => {
      throw new DOMException('Permission denied', 'SecurityError');
    };
    const res = await grantWorkspaceFolder();
    expect(res).toEqual({ ok: false, error: 'permission-denied' });
    evidence.grantDenied = true;
    evidence.tests++;
  });
});

// ── 续权 / 拒权 ──────────────────────────────────────────────

describe('requestReGrant 权限续期', () => {
  it('granted → {ok:true}', async () => {
    const res = await requestReGrant(makeDirHandle('Workspace', 'granted'));
    expect(res).toEqual({ ok: true });
    evidence.reGrantGranted = true;
    evidence.tests++;
  });

  it('denied → {error:permission-denied}', async () => {
    const res = await requestReGrant(makeDirHandle('Workspace', 'denied'));
    expect(res).toEqual({ ok: false, error: 'permission-denied' });
    evidence.reGrantDenied = true;
    evidence.tests++;
  });

  it('prompt（未授予）→ {error:permission-denied}', async () => {
    const res = await requestReGrant(makeDirHandle('Workspace', 'prompt'));
    expect(res).toEqual({ ok: false, error: 'permission-denied' });
    evidence.reGrantPrompt = true;
    evidence.tests++;
  });

  it('用户关闭弹窗（AbortError）→ {error:cancelled}', async () => {
    const handle = {
      kind: 'directory',
      name: 'Workspace',
      requestPermission: async () => {
        throw new DOMException('abort', 'AbortError');
      },
    } as unknown as FileSystemHandle;
    const res = await requestReGrant(handle);
    expect(res).toEqual({ ok: false, error: 'cancelled' });
    evidence.reGrantCancelled = true;
    evidence.tests++;
  });
});

// ── 持久化（structured clone） ───────────────────────────────

describe('工作区句柄持久化', () => {
  it('persist 后 load 返回同一句柄（structured clone 序列化）', async () => {
    const store = makeMemoryStore();
    const handle = makePersistableHandle('MyWorkspace');
    const saved = await persistWorkspaceHandle(handle, store);
    expect(saved).toEqual({ ok: true });

    const loaded = await loadWorkspaceHandle(store);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.handle.kind).toBe('directory');
      expect(loaded.handle.name).toBe('MyWorkspace');
    }
    evidence.persistRoundTrip = true;
    evidence.tests++;
  });

  it('无数据 → {ok:false,empty:true}', async () => {
    const store = makeMemoryStore();
    const res = await loadWorkspaceHandle(store);
    expect(res).toEqual({ ok: false, empty: true });
    evidence.loadEmpty = true;
    evidence.tests++;
  });

  it('clear 后 load → empty', async () => {
    const store = makeMemoryStore();
    await persistWorkspaceHandle(makePersistableHandle('Workspace'), store);
    const cleared = await clearWorkspaceHandle(store);
    expect(cleared).toEqual({ ok: true });
    const res = await loadWorkspaceHandle(store);
    expect(res).toEqual({ ok: false, empty: true });
    evidence.clearWorkspace = true;
    evidence.tests++;
  });

  it('persist 写失败 → {error:persist-failed}，不抛', async () => {
    const res = await persistWorkspaceHandle(makeDirHandle('Workspace'), throwingStore);
    expect(res).toEqual({ ok: false, error: 'persist-failed' });
    evidence.persistFailed = true;
    evidence.tests++;
  });

  it('load 读失败 → {error:load-failed}，不抛', async () => {
    const res = await loadWorkspaceHandle(throwingStore);
    expect(res).toEqual({ ok: false, error: 'load-failed' });
    evidence.loadFailed = true;
    evidence.tests++;
  });
});

afterAll(() => {
  writeFileSync(join(RES, 'fsa.json'), JSON.stringify(evidence, null, 2));
});
