// TabStrip 组件 —— 页签条 + 脏点指示器 + 关闭确认对话框（任务 4.3）。
import { useState, useRef, useEffect } from 'react';
import type { Tab } from '../lib/tabs';

// ── 类型 ────────────────────────────────────────────────────────

export interface TabStripProps {
  tabs: Tab[];
  activeId: string | null;
  onSelect: (tabId: string) => void;
  onClose: (tabId: string) => void;
}

/** 关闭决策：保存 / 丢弃。 */
export type CloseAction = 'save' | 'discard';

/** 异步关闭回调 — 由父组件提供，用于脏页签的保存/丢弃分支。 */
export type OnCloseWithConfirm = (
  tabId: string,
  action: CloseAction,
) => Promise<void>;

export interface TabStripWithConfirmProps extends TabStripProps {
  /** 当脏页签需要保存/丢弃时调用（返回 promise）。 */
  onCloseWithConfirm?: OnCloseWithConfirm;
}

// ── DirtyDialog ─────────────────────────────────────────────────

function DirtyDialog({ onSave, onDiscard, onCancel }: {
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩 */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* 面板 */}
      <div className="relative w-[360px] rounded-lg border border-[#30363d] bg-[#161b22] p-5 shadow-xl">
        <h3 className="mb-1 text-base font-semibold text-[#e6edf3]">
          是否保存更改？
        </h3>
        <p className="mb-4 text-sm text-[#8b949e]">
          此页签有未保存的更改。保存以保留更改，或丢弃直接关闭。
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            data-testid="tab-close-save"
            onClick={onSave}
            className="flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[#1f6feb]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6feb]"
          >
            保存
          </button>

          <button
            type="button"
            data-testid="tab-close-discard"
            onClick={onDiscard}
            className="flex-1 rounded border border-[#30363d] px-3 py-1.5 text-sm font-medium text-[#8b949e] transition-colors hover:border-[#586069] hover:text-[#e6edf3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6feb]"
          >
            丢弃
          </button>

          <button
            type="button"
            data-testid="tab-close-cancel"
            onClick={onCancel}
            className="flex-1 rounded border border-[#30363d] px-3 py-1.5 text-sm font-medium text-[#8b949e] transition-colors hover:border-[#586069] hover:text-[#e6edf3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6feb]"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

// ── TabStrip ────────────────────────────────────────────────────

export function TabStrip({
  tabs,
  activeId,
  onSelect,
  onClose,
  onCloseWithConfirm,
}: TabStripWithConfirmProps): JSX.Element | null {
  // 当前正在等待确认的页签 id；null = 无对话框。
  const [pendingCloseTab, setPendingCloseTab] = useState<string | null>(null);

  // 延迟关闭 ref — useEffect 设置后执行。
  const deferredCloseRef = useRef<(() => void) | null>(null);

  // 监听页签列表变化：若 pendingCloseTab 对应的 tab 已被移除，清除状态并延迟执行 deferred close。
  useEffect(() => {
    if (!pendingCloseTab) return;
    if (!tabs.some((t) => t.id === pendingCloseTab)) {
      setPendingCloseTab(null);
      deferredCloseRef.current?.();
      deferredCloseRef.current = null;
    }
  }, [tabs, pendingCloseTab]);

  // 处理脏页签关闭点击 — 显示确认框。
  const handleDirtyCloseClick = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    // 非脏页签 → 直接关闭。
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab || !tab.dirty) {
      onClose(tabId);
      return;
    }

    // 无 confirm 回调 → 也直接关闭（向后兼容）。
    if (!onCloseWithConfirm) {
      onClose(tabId);
      return;
    }

    // 有回调 → 显示确认框。
    setPendingCloseTab(tabId);
  };

  // 用户选择「保存」→ 先 save 再 close。
  const handleSaveAndClose = async () => {
    if (!pendingCloseTab || !onCloseWithConfirm) return;

    // 用 ref 保存 deferred close — await 期间 state 可能变。
    const doDeferredClose = () => {
      setPendingCloseTab(null);
      deferredCloseRef.current = null;
      onClose(pendingCloseTab);
    };

    deferredCloseRef.current = doDeferredClose;
    await onCloseWithConfirm(pendingCloseTab, 'save');
  };

  // 用户选择「丢弃」→ 直接关闭。
  const handleDiscardAndClose = () => {
    if (!pendingCloseTab) return;
    setPendingCloseTab(null);
    deferredCloseRef.current = null;
    onClose(pendingCloseTab);
  };

  // 用户选择「取消」→ 关对话框。
  const handleCancelClose = () => {
    setPendingCloseTab(null);
    deferredCloseRef.current = null;
  };

  if (tabs.length === 0) return null;

  return (
    <>
      <div
        data-testid="tab-strip"
        className="flex items-center gap-0 overflow-x-auto border-b border-[#30363d] bg-[#0d1117]"
        role="tablist"
        aria-label="文档页签"
      >
        {tabs.map((tab) => (
          <div
            key={tab.id}
            role="tab"
            aria-selected={tab.id === activeId}
            tabIndex={0}
            className={`group flex cursor-pointer items-center gap-1.5 border-r border-[#30363d] px-3 py-1.5 text-xs transition-colors ${
              tab.id === activeId
                ? 'bg-[#161b22] text-[#e6edf3]'
                : 'text-[#8b949e] hover:bg-[#161b22]/50 hover:text-[#e6edf3]'
            }`}
            onClick={() => onSelect(tab.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(tab.id);
              }
            }}
          >
            {/* 脏点指示器 */}
            <span
              data-testid={tab.dirty ? 'tab-dirty-indicator' : undefined}
              className={tab.dirty ? 'mr-1 inline-block w-4 shrink-0 text-center text-yellow-400' : ''}
              title={tab.dirty ? '未保存的更改' : undefined}
            >
              {tab.dirty ? '●' : ''}
            </span>

            <span className="max-w-[120px] truncate">{tab.name}</span>

            <button
              type="button"
              aria-label={`关闭 ${tab.name}`}
              className="ml-1 rounded p-0.5 text-[#8b949e] opacity-0 transition-opacity hover:bg-[#30363d] hover:text-[#e6edf3] group-hover:opacity-100"
              onClick={(e) => handleDirtyCloseClick(tab.id, e)}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* 关闭确认对话框 */}
      {pendingCloseTab && (
        <DirtyDialog
          onSave={handleSaveAndClose}
          onDiscard={handleDiscardAndClose}
          onCancel={handleCancelClose}
        />
      )}
    </>
  );
}
