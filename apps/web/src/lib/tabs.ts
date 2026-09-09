// 多页签模型 —— 纯逻辑，可单测。任务 4.1。
// 决策 #21/#27：打开文件/示例 = 新页签，永不静默替换；无上限。
// Tab 类型包含 4.2/4.3/Wave5 预留字段（mode/scrollPos/dirty/diskHandle）。
import type { Asset } from './assets';
import type { Manifest, ValidationResult } from './mdpkg';

// ── Tab 类型 ──────────────────────────────────────────────────

export type TabKind = 'md' | 'mdpkg';

export interface Tab {
  /** 唯一标识（crypto.randomUUID 或自增）。 */
  id: string;
  /** 文件类型。 */
  kind: TabKind;
  /** 文件名（含扩展名）。 */
  name: string;
  /** 文档源码（md 纯文本 / mdpkg 入口源码）。 */
  source: string;
  /** 图片资产清单（各 tab 独立）。 */
  assets: Asset[];
  /** mdpkg 包内文件（仅 mdpkg 类型）。 */
  mdpkgFiles?: Map<string, Uint8Array>;
  /** mdpkg manifest（透传重打包；null = 无 manifest）。 */
  manifest?: Manifest | null;
  /** mdpkg 校验结果（仅 mdpkg 类型）。 */
  validation?: ValidationResult | null;
  /** 编辑器模式（4.3 TabStrip 扩展用）。 */
  mode: 'edit' | 'source' | 'preview';
  /** 滚动位置（4.2 持久化用）。 */
  scrollPos: number;
  /** 脏标记：编辑后 true；保存后 false（4.3/4.4/Wave5）。 */
  dirty: boolean;
  /** FSA diskHandle（Wave5 持久化用；本任务预留）。 */
  diskHandle?: FileSystemFileHandle;
}

// ── TabsState ─────────────────────────────────────────────────

export interface TabsState {
  /** 所有页签（有序，按添加顺序）。 */
  tabs: Tab[];
  /** 当前 active 页签 id；null = 空态。 */
  activeId: string | null;
}

// ── id 生成 ───────────────────────────────────────────────────

let seq = 0;

/** 生成唯一 tab id。测试可重置 seq。 */
export function generateTabId(): string {
  return `tab-${++seq}`;
}

/** 测试辅助：重置 id 序列。 */
export function resetTabIdSeq(): void {
  seq = 0;
}

// ── 纯函数操作 ───────────────────────────────────────────────

/** 创建空 tabs state。 */
export function createTabsState(): TabsState {
  return { tabs: [], activeId: null };
}

/** 新增页签（永远新增，永不替换）。返回新 state + tabId。 */
export function addTab(
  state: TabsState,
  props: {
    kind: TabKind;
    name: string;
    source: string;
    assets?: Asset[];
    mdpkgFiles?: Map<string, Uint8Array>;
    manifest?: Manifest | null;
    validation?: ValidationResult | null;
    /** FSA diskHandle（Wave5 文件树打开时持有；供保存回写）。 */
    diskHandle?: FileSystemFileHandle;
  },
): { state: TabsState; tabId: string } {
  const id = generateTabId();
  const tab: Tab = {
    id,
    kind: props.kind,
    name: props.name,
    source: props.source,
    assets: props.assets ?? [],
    mdpkgFiles: props.mdpkgFiles,
    manifest: props.manifest,
    validation: props.validation ?? null,
    mode: 'edit',
    scrollPos: 0,
    dirty: false,
    diskHandle: props.diskHandle,
  };
  return {
    state: {
      tabs: [...state.tabs, tab],
      activeId: id,
    },
    tabId: id,
  };
}

/** 移除页签。若移除的是 active，active 切到最后一个；无 tab 时 active=null。 */
export function removeTab(state: TabsState, tabId: string): TabsState {
  const idx = state.tabs.findIndex((t) => t.id === tabId);
  if (idx === -1) return state; // 不存在 → 原样返回

  const nextTabs = state.tabs.filter((t) => t.id !== tabId);
  let nextActiveId = state.activeId;

  if (state.activeId === tabId) {
    // 关闭的是 active → 切到最后一个
    nextActiveId = nextTabs.length > 0 ? nextTabs[nextTabs.length - 1].id : null;
  }

  return { tabs: nextTabs, activeId: nextActiveId };
}

/** 更新页签字段（部分更新，只改传入的字段）。 */
export function updateTab(
  state: TabsState,
  tabId: string,
  patch: Partial<Pick<Tab, 'source' | 'dirty' | 'assets' | 'mode' | 'scrollPos' | 'diskHandle'>>,
): TabsState {
  return {
    ...state,
    tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, ...patch } : t)),
  };
}

/** 切换 active 页签（不存在则原样返回）。 */
export function setActiveTab(state: TabsState, tabId: string): TabsState {
  if (!state.tabs.some((t) => t.id === tabId)) return state;
  return { ...state, activeId: tabId };
}

/** 获取当前 active tab（无则 null）。 */
export function getActiveTab(state: TabsState): Tab | null {
  if (!state.activeId) return null;
  return state.tabs.find((t) => t.id === state.activeId) ?? null;
}
