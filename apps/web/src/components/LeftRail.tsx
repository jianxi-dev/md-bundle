// 左栏（任务 2.4 + 2.7 + Wave 5.2）—— 桌面 260px 可收起侧栏；移动端底部抽屉（鸡蛋形 toggle）。
// 默认收起（toggle 按钮 ghost 风格）；收起/展开状态记忆 localStorage。
// 文件页签承载 FileTree（Wave 5.2）；最近页签承载 RecentFilesSection；资源页签承载 AssetPanel。
// 资源有孤儿时 toggle 显示徽标点。
// 任务 2.7：移动端 <768px → 底部抽屉（横向椭圆鸡蛋形 toggle + fixed 抽屉面板）。
import { useEffect, useMemo, useState } from 'react'
import { AssetPanel, type AssetPanelProps } from './AssetPanel'
import { FileTree } from './FileTree'
import { computeOrphans } from '../lib/assets'
import type { RecentDocItem } from './Landing'

export interface LeftRailProps {
  /** 资产清单（传给 AssetPanel）。 */
  assets: AssetPanelProps['assets']
  /** 文档文本（传给 AssetPanel 计算孤儿）。 */
  documentText: AssetPanelProps['documentText']
  /** 删除资产回调。 */
  onDelete: AssetPanelProps['onDelete']
  /** 替换资产回调。 */
  onReplace: AssetPanelProps['onReplace']
  /** 打开文件回调（FileTree 点击 .md/.mdpkg → 新增 tab + 持有 handle）。 */
  onOpenFile: (file: File, handle: FileSystemFileHandle) => void
  /** 当前活动页签文件名（FileTree 高亮匹配节点）。 */
  activeTabName: string | null
  /** 最近关闭的文档（最近页签「最近文件」卡片区）。 */
  recentDocs: RecentDocItem[]
  /** 恢复最近文档。 */
  onOpenRecentDoc: (doc: RecentDocItem) => void
  /** 左栏是否展开（受控，开关按钮由顶栏持有）。 */
  open: boolean
  /** 切换左栏展开态。 */
  onToggle: () => void
}

type RailTab = 'files' | 'recent' | 'assets'

/** 相对关闭时间（与 Landing 最近文档同口径）。 */
function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)} 天前`
  return new Date(ts).toLocaleDateString('zh-CN')
}

/** 最近文件卡片区（最近页签，样式对齐 Landing RecentDocsSection 的紧凑版）。 */
function RecentFilesSection({
  docs,
  onOpenDoc,
}: {
  docs: RecentDocItem[]
  onOpenDoc: (doc: RecentDocItem) => void
}): JSX.Element {
  return (
    <section data-testid="recent-files-section">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        最近文件
      </h3>
      {docs.length === 0 ? (
        <p
          data-testid="recent-files-empty"
          className="rounded-lg border border-dashed border-[var(--border)] px-3 py-4 text-center text-sm text-[var(--meta)]"
        >
          暂无最近文件
        </p>
      ) : (
        <div className="space-y-2">
          {docs.map((doc, i) => {
            if (!doc || typeof doc.name !== 'string' || !doc.kind || !doc.source) return null
            return (
              <button
                key={`${doc.closedAt}-${i}`}
                type="button"
                data-testid={`recent-file-item-${i}`}
                onClick={() => onOpenDoc(doc)}
                className="group w-full overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-left transition-all hover:border-[var(--accent)] hover:shadow-md hover:shadow-[var(--accent)]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-[var(--fg-2)] group-hover:text-[var(--fg)]">
                        {doc.name}
                      </span>
                      <span className="shrink-0 rounded bg-[var(--accent)]/20 px-1 py-0.5 text-xs text-[var(--accent-bright)]">
                        .{doc.kind}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--meta)]">
                      {formatRelativeTime(doc.closedAt)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded bg-[var(--surface-2)] px-1 py-0.5 text-[10px] uppercase text-[var(--muted)]">
                    {doc.mode === 'source' ? '源码' : doc.mode === 'preview' ? '预览' : '编辑'}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}

/** 窄屏检测（<768px）。 */
function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(max-width: 767px)').matches
  })
  useEffect(() => {
    if (!window.matchMedia) return
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = (e: MediaQueryListEvent) => setNarrow(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return narrow
}

/** 页签内容（桌面侧栏与移动端抽屉共用）。 */
function RailContent({
  tab,
  setTab,
  hasOrphans,
  assets,
  documentText,
  onDelete,
  onReplace,
  onOpenFile,
  activeTabName,
  recentDocs,
  onOpenRecentDoc,
}: {
  tab: RailTab
  setTab: (t: RailTab) => void
  hasOrphans: boolean
  assets: AssetPanelProps['assets']
  documentText: AssetPanelProps['documentText']
  onDelete: AssetPanelProps['onDelete']
  onReplace: AssetPanelProps['onReplace']
  onOpenFile: (file: File, handle: FileSystemFileHandle) => void
  activeTabName: string | null
  recentDocs: RecentDocItem[]
  onOpenRecentDoc: (doc: RecentDocItem) => void
}): JSX.Element {
  return (
    <>
      {/* 页签栏 */}
      <div className="flex border-b border-[var(--border)]" role="tablist" aria-label="左栏页签">
        <button
          type="button"
          role="tab"
          data-testid="left-rail-tab-files"
          aria-selected={tab === 'files'}
          onClick={() => setTab('files')}
          className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
            tab === 'files'
              ? 'border-b-2 border-[var(--accent)] text-[var(--fg)]'
              : 'text-[var(--muted)] hover:text-[var(--fg)]'
          }`}
        >
          文件
        </button>
        <button
          type="button"
          role="tab"
          data-testid="left-rail-tab-recent"
          aria-selected={tab === 'recent'}
          onClick={() => setTab('recent')}
          className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
            tab === 'recent'
              ? 'border-b-2 border-[var(--accent)] text-[var(--fg)]'
              : 'text-[var(--muted)] hover:text-[var(--fg)]'
          }`}
        >
          最近
        </button>
        <button
          type="button"
          role="tab"
          data-testid="left-rail-tab-assets"
          aria-selected={tab === 'assets'}
          onClick={() => setTab('assets')}
          className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
            tab === 'assets'
              ? 'border-b-2 border-[var(--accent)] text-[var(--fg)]'
              : 'text-[var(--muted)] hover:text-[var(--fg)]'
          }`}
        >
          资源
          {hasOrphans && tab !== 'assets' && (
            <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-[var(--warn)] align-middle" />
          )}
        </button>
      </div>

      {/* 页签内容 */}
      <div className="flex-1 overflow-auto p-3">
        {tab === 'files' ? (
          <FileTree onOpenFile={onOpenFile} activeTabName={activeTabName} />
        ) : tab === 'recent' ? (
          <RecentFilesSection docs={recentDocs} onOpenDoc={onOpenRecentDoc} />
        ) : (
          <AssetPanel
            assets={assets}
            documentText={documentText}
            onDelete={onDelete}
            onReplace={onReplace}
          />
        )}
      </div>
    </>
  )
}

export function LeftRail({
  assets,
  documentText,
  onDelete,
  onReplace,
  onOpenFile,
  activeTabName,
  recentDocs,
  onOpenRecentDoc,
  open,
  onToggle,
}: LeftRailProps): JSX.Element {
  const [tab, setTab] = useState<RailTab>('files')
  const isNarrow = useIsNarrow()

  // 孤儿计算（与 AssetPanel 同一口径）
  const orphans = useMemo(() => computeOrphans(assets, documentText), [assets, documentText])
  const hasOrphans = orphans.size > 0

  const content = (
    <RailContent
      tab={tab}
      setTab={setTab}
      hasOrphans={hasOrphans}
      assets={assets}
      documentText={documentText}
      onDelete={onDelete}
      onReplace={onReplace}
      onOpenFile={onOpenFile}
      activeTabName={activeTabName}
      recentDocs={recentDocs}
      onOpenRecentDoc={onOpenRecentDoc}
    />
  )

  // 移动端：鸡蛋形 toggle + 底部抽屉
  if (isNarrow) {
    return (
      <>
        <button
          type="button"
          data-testid="mobile-rail-toggle"
          onClick={onToggle}
          aria-label={open ? '关闭文件面板' : '打开文件面板'}
          title={open ? '关闭文件面板' : '打开文件面板'}
          className="fixed bottom-5 left-4 z-40 flex h-8 w-11 items-center justify-center rounded-[40%_60%_60%_40%/60%_40%_60%_40%] border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--muted)] opacity-80 shadow-lg transition-colors hover:text-[var(--fg)] hover:opacity-100"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 3v18" />
            <path d={open ? 'm16 15-3-3 3-3' : 'm14 9 3 3-3 3'} />
          </svg>
          {!open && hasOrphans && (
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--warn)]" />
          )}
        </button>

        {open && (
          <div
            data-testid="mobile-rail-drawer"
            className="fixed inset-x-0 bottom-0 z-30 flex max-h-[60vh] flex-col rounded-t-2xl border-t border-[var(--border)] bg-[var(--surface)] shadow-2xl"
          >
            <div className="flex justify-center py-2">
              <div className="h-1 w-8 rounded-full bg-[var(--border)]" />
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{content}</div>
          </div>
        )}
      </>
    )
  }

  // 桌面：仅渲染 260px 侧栏（开关按钮在顶栏最左）。
  return (
    <>
      {open && (
        <aside
          data-testid="left-rail"
          className="flex h-full w-[260px] shrink-0 flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--surface)]"
        >
          {content}
        </aside>
      )}
    </>
  )
}
