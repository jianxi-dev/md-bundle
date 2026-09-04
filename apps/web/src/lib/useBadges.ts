// 徽章接线（任务 6.4）—— useBadges 钩子 + wireBadgeEvents 接线缝。
// useBadges：store 在 ref 上惰性创建（跨渲染存活，绝不重建）；toast 状态 + 3.5s 自动消失。
// wireBadgeEvents：把 4.1 的成功信号（saveDocument 返回值 / handleExport 结果 / 打开成功）
// 映射为徽章事件 —— 纯函数，单测注入 store + spy 断言映射正确性。
// 映射规则（与 badges.ts 头注释一致）：
//   saveDocument 返回 'mdpkg'（首次保存 .mdpkg）→ pack-saved；'md'/null → 无事件
//   导出成功（resolve true）→ export-succeeded；PNG 成功额外 → png-exported（双事件）
//   打开成功（状态机进入 md/mdpkg）→ file-opened
import { useCallback, useRef, useState } from 'react';
import {
  createBadgeStore,
  type BadgeEvent,
  type BadgeEventResult,
  type BadgeId,
  type BadgeStore,
  type Rarity,
} from './badges';
import type { SaveKind } from './save';

/** 导出格式（与 Toolbar 的 ExportFormat 结构一致，lib 层不依赖组件）。 */
export type ExportFormat = 'md' | 'mdpkg' | 'html' | 'png';

/** 徽章 id → 用户可见文案（toast 用）。 */
export const BADGE_LABELS: Record<BadgeId, string> = {
  'first-open': '首次打开',
  'first-pack': '首次打包',
  'first-png': '首次长图',
  'export-master': '导出大师',
};

/** toast 展示状态。 */
export interface BadgeToastState {
  text: string;
  rarity: Rarity;
}

export interface UseBadges {
  /** 稳定引用（跨渲染存活；持久化经注入的 localStorage）。 */
  badgeStore: BadgeStore;
  /** 当前 toast（null = 无）。latest wins —— 新解锁覆盖旧 toast。 */
  toast: BadgeToastState | null;
  /** 按 recordEvent 结果弹 toast；unlocked 空 → 无操作（绝不重复弹）。 */
  showToastFor: (result: BadgeEventResult) => void;
  /** 立即关闭 toast（点击 / 手动）。 */
  dismiss: () => void;
  /** 记录事件 + 按结果弹 toast（App 接线用）。 */
  recordAndToast: (event: BadgeEvent) => void;
}

/** toast 自动消失时长（ms）。 */
export const TOAST_MS = 3500;

/**
 * localStorage 安全包装：隐私模式 / 配额 / SSR 下 getItem 可能直接 throw ——
 * 探测失败则退回静默 no-op 存储（徽章内存态仍可用，符合 badges.ts 安全降级契约）。
 */
function safeStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  try {
    const s = window.localStorage;
    s.getItem('md-bundle.probe');
    return s;
  } catch {
    return {
      getItem: () => null,
      setItem: () => {},
    };
  }
}

export function useBadges(): UseBadges {
  // 惰性创建：ref 保证 store 跨渲染存活（重建会丢内存态 + 重复读存储）。
  const storeRef = useRef<BadgeStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createBadgeStore(safeStorage());
  }
  const [toast, setToast] = useState<BadgeToastState | null>(null);
  const timerRef = useRef<number | null>(null);

  const dismiss = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    setToast(null);
  }, []);

  const showToastFor = useCallback((result: BadgeEventResult) => {
    if (result.unlocked.length === 0) return; // 无新徽章 → 绝不弹（去重由 badges lib 保证）
    if (result.upgraded) {
      // 升级行：与 unlocked 条目不同（firstTime:false）—— 弹升级文案。
      setToast({
        text: `徽章升级：${BADGE_LABELS[result.upgraded.id]} → ${result.upgraded.to}`,
        rarity: result.upgraded.to,
      });
    } else {
      const last = result.unlocked[result.unlocked.length - 1];
      setToast({
        text: `解锁徽章：${BADGE_LABELS[last.id]}（${last.rarity}）`,
        rarity: last.rarity,
      });
    }
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  const recordAndToast = useCallback(
    (event: BadgeEvent) => {
      const result = storeRef.current!.recordEvent(event);
      showToastFor(result);
    },
    [showToastFor],
  );

  return { badgeStore: storeRef.current, toast, showToastFor, dismiss, recordAndToast };
}

/** 接线缝的成功信号回调（App 传入 → 弹 toast；单测传入 spy → 断言映射）。 */
export interface BadgeWireHandlers {
  /** saveDocument 返回 'mdpkg' 时触发（result 为 pack-saved 的 recordEvent 结果）。 */
  onSaveSuccess: (result: BadgeEventResult) => void;
  /** PNG 导出成功时触发（result 为 png-exported 的结果）。 */
  onPngExportSuccess: (result: BadgeEventResult) => void;
  /** 任意格式导出成功时触发（result 为 export-succeeded 的结果）。 */
  onExportSuccess: (result: BadgeEventResult) => void;
  /** 文件打开成功时触发（result 为 file-opened 的结果）。 */
  onFileOpen: (result: BadgeEventResult) => void;
}

/** App 实际调用的原始信号入口。 */
export interface BadgeWire {
  /** 保存结果 → 事件（'mdpkg' → pack-saved；'md'/null → 无）。 */
  onSaveResult: (kind: SaveKind | null) => void;
  /** 导出结果 → 事件（png 成功 → png-exported + export-succeeded；其它成功 → export-succeeded；失败 → 无）。 */
  onExportResult: (format: ExportFormat, ok: boolean) => void;
  /** 打开成功 → file-opened。 */
  onFileOpened: () => void;
}

/**
 * 接线缝（6.4）：把 4.1 的成功信号映射为徽章事件并记录。
 * 纯函数 —— 单测注入 store + spy 断言：pack-saved 仅在 saveDocument 返回 'mdpkg' 时触发；
 * png-exported 仅在 PNG 成功时；export-succeeded 任意成功；file-opened 打开成功。
 */
export function wireBadgeEvents(store: BadgeStore, handlers: BadgeWireHandlers): BadgeWire {
  const record = (e: BadgeEvent): BadgeEventResult => store.recordEvent(e);
  return {
    onSaveResult(kind: SaveKind | null) {
      if (kind === 'mdpkg') handlers.onSaveSuccess(record('pack-saved'));
    },
    onExportResult(format: ExportFormat, ok: boolean) {
      if (!ok) return;
      if (format === 'png') handlers.onPngExportSuccess(record('png-exported'));
      handlers.onExportSuccess(record('export-succeeded'));
    },
    onFileOpened() {
      handlers.onFileOpen(record('file-opened'));
    },
  };
}