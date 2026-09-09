// TabStrip 组件 —— 页签条 + 脏点指示器 + 关闭确认对话框（任务 4.3）。
import { useState, useRef, useEffect } from 'react'
import type { Tab } from '../lib/tabs'

// ── 类型 ────────────────────────────────────────────────────────

export interface TabStripProps {
  tabs: Tab[]
  activeId: string | null
  onSelect: (tabId: string) => void
  onClose: (tabId: string) => void
}

/** 关闭决策：保存 / 丢弃。 */
export type CloseAction = 'save' | 'discard'

/** 异步关闭回调 — 由父组件提供，用于脏页签的保存/丢弃分支。 */
export type OnCloseWithConfirm = (tabId: string, action: CloseAction) => Promise<void>

export interface TabStripWithConfirmProps extends TabStripProps {
  /** 当脏页签需要保存/丢弃时调用（返回 promise）。 */
  onCloseWithConfirm?: OnCloseWithConfirm
  /** 页签条右侧「+」新建文档按钮回调。 */
  onAddTab?: () => void
}

// ── DirtyDialog ─────────────────────────────────────────────────

function DirtyDialog({
  onSave,
  onDiscard,
  onCancel,
}: {
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />

      {/* 面板 */}
      <div className="relative w-[360px] rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl">
        <h3 className="mb-1 text-base font-semibold text-[var(--fg)]">是否保存更改？</h3>
        <p className="mb-4 text-sm text-[var(--muted)]">
          此页签有未保存的更改。保存以保留更改，或丢弃直接关闭。
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            data-testid="tab-close-save"
            onClick={onSave}
            className="flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--accent)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            保存
          </button>

          <button
            type="button"
            data-testid="tab-close-discard"
            onClick={onDiscard}
            className="flex-1 rounded border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--muted)] transition-colors hover:border-[var(--border)] hover:text-[var(--fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            丢弃
          </button>

          <button
            type="button"
            data-testid="tab-close-cancel"
            onClick={onCancel}
            className="flex-1 rounded border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--muted)] transition-colors hover:border-[var(--border)] hover:text-[var(--fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  )
}

// ── TabStrip ────────────────────────────────────────────────────

export function TabStrip({
  tabs,
  activeId,
  onSelect,
  onClose,
  onCloseWithConfirm,
  onAddTab,
}: TabStripWithConfirmProps): JSX.Element | null {
  // 当前正在等待确认的页签 id；null = 无对话框。
  const [pendingCloseTab, setPendingCloseTab] = useState<string | null>(null)

  // 延迟关闭 ref — useEffect 设置后执行。
  const deferredCloseRef = useRef<(() => void) | null>(null)

  // 监听页签列表变化：若 pendingCloseTab 对应的 tab 已被移除，清除状态并延迟执行 deferred close。
  useEffect(() => {
    if (!pendingCloseTab) return
    if (!tabs.some((t) => t.id === pendingCloseTab)) {
      setPendingCloseTab(null)
      deferredCloseRef.current?.()
      deferredCloseRef.current = null
    }
  }, [tabs, pendingCloseTab])

  // 处理脏页签关闭点击 — 显示确认框。
  const handleDirtyCloseClick = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation()

    // 非脏页签 → 直接关闭。
    const tab = tabs.find((t) => t.id === tabId)
    if (!tab || !tab.dirty) {
      onClose(tabId)
      return
    }

    // 无 confirm 回调 → 也直接关闭（向后兼容）。
    if (!onCloseWithConfirm) {
      onClose(tabId)
      return
    }

    // 有回调 → 显示确认框。
    setPendingCloseTab(tabId)
  }

  // 用户选择「保存」→ 先 save 再 close。
  const handleSaveAndClose = async () => {
    if (!pendingCloseTab || !onCloseWithConfirm) return

    // 用 ref 保存 deferred close — await 期间 state 可能变。
    const doDeferredClose = () => {
      setPendingCloseTab(null)
      deferredCloseRef.current = null
      onClose(pendingCloseTab)
    }

    deferredCloseRef.current = doDeferredClose
    await onCloseWithConfirm(pendingCloseTab, 'save')
  }

  // 用户选择「丢弃」→ 直接关闭。
  const handleDiscardAndClose = () => {
    if (!pendingCloseTab) return
    setPendingCloseTab(null)
    deferredCloseRef.current = null
    onClose(pendingCloseTab)
  }

  // 用户选择「取消」→ 关对话框。
  const handleCancelClose = () => {
    setPendingCloseTab(null)
    deferredCloseRef.current = null
  }

  if (tabs.length === 0) return null

  return (
    <>
      <div
        data-testid="tab-strip"
        className="flex h-10 items-end gap-[3px] overflow-x-auto border-b border-[var(--border)] bg-[var(--surface-2)] px-3"
        role="tablist"
        aria-label="文档页签"
      >
        {tabs.map((tab) => (
          <div
            key={tab.id}
            role="tab"
            aria-selected={tab.id === activeId}
            tabIndex={0}
            className={`group relative flex h-[33px] shrink-0 cursor-pointer items-center gap-1.5 rounded-t-[9px] border border-b-0 px-3 text-xs transition-colors ${
              tab.id === activeId
                ? 'border-[var(--border)] bg-[var(--surface)] text-[var(--fg)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--fg)]'
            }`}
            onClick={() => onSelect(tab.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect(tab.id)
              }
            }}
          >
            {tab.id === activeId && (
              <span
                className="absolute -top-px left-3 right-3 h-[2px] rounded-[2px] bg-[var(--accent-fill)]"
                aria-hidden="true"
              />
            )}

            <span className="max-w-[120px] truncate">{tab.name}</span>

            {tab.dirty && (
              <span
                data-testid={`tab-dirty-${tab.name}`}
                aria-label={`${tab.name} 有未保存更改`}
                className="dirty shrink-0"
              />
            )}

            <button
              type="button"
              aria-label={`关闭 ${tab.name}`}
              className="ml-1 rounded p-0.5 text-[var(--muted)] opacity-0 transition-opacity hover:bg-[var(--surface-3)] hover:text-[var(--fg)] group-hover:opacity-100"
              onClick={(e) => handleDirtyCloseClick(tab.id, e)}
            >
              ×
            </button>
          </div>
        ))}

        {/* 新建文档按钮（任务 4.3：页签条右侧 +） */}
        {onAddTab && (
          <button
            type="button"
            data-testid="tab-add"
            aria-label="新建文档"
            className="tab-add shrink-0"
            onClick={onAddTab}
          >
            +
          </button>
        )}
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
  )
}
