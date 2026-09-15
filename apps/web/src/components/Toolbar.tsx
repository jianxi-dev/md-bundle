// 顶栏 v2（任务 2.1）—— .gbtn ghost 图标动作区 + 三模式切换 + .btn primary 主按钮。
// 右起读：主题◐（最右）→ 分享 → 导出▾ → 保存（主按钮）→ 打开新文件（最左）
// + 三模式 .gbtn 图标（铅笔/代码/眼睛）在左侧独立区域（active 以靛青高亮）。
// 图标全部用内联 SVG（无 emoji 即图标）；颜色走设计 token（var(--accent) 等）。
// 禁用组按动作分：无文档时保存/导出 disabled；打开/分享/主题已接线可用。
import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

export type ExportFormat = 'md' | 'mdpkg' | 'html' | 'png' | 'zip' | 'docx'
export type EditorMode = 'edit' | 'source' | 'preview'

export interface ToolbarProps {
  /** 保存按钮可用性（空态禁用）。 */
  canSave: boolean
  /** 当前文档来源（决定保存目标提示）。 */
  sourceKind: 'md' | 'mdpkg'
  /** 导出失败的内联错误文案（role=status 展示；null = 无错误）。 */
  error?: string | null
  /** 点击保存（内容驱动：有图 → .mdpkg，无图 → .md，打开 .mdpkg → 重打包）。 */
  onSave: () => void
  /** 点击导出下拉项（显式格式：.md / .mdpkg / HTML / PNG 长图）。 */
  onExport: (format: ExportFormat) => void
  /** 点击「打开新文件」（触发隐藏 FileOpen 文件选择器）。 */
  onOpenFile: () => void
  /** 当前编辑模式（编辑/源码/预览）。 */
  currentMode?: EditorMode
  /** 切换编辑模式（派发 setMode 到 App 状态）。 */
  onModeChange?: (mode: EditorMode) => void
  /** 主题按钮点击（循环 system → dark → light）。 */
  onThemeClick?: () => void
  /** 当前主题偏好（三态）——决定主题按钮图标与可访问文案。 */
  themeProp: 'system' | 'dark' | 'light'
  /** 复制邀请链接。 */
  onCopyInviteLink?: () => void
  /** 生成邀请卡（随机模板 → PNG → 剪贴板/下载）。 */
  onGenerateInviteCard?: () => void
  /** 复制正文为图片：导出 PNG → 尝试复制，失败兜底下载。 */
  onCopyBodyAsImage?: () => void
  /** FSA 可用时 true（决策 #42 三态主按钮：保存/保存/下载）。缺省 false → 按钮显示「下载」。 */
  fsaAvailable?: boolean
  /** 文档已持久化（持 diskHandle 或已保存过）→ 按钮文案「保存」；否则 FSA 可用时也为「保存」（首次另存为）。缺省 false。 */
  canPersist?: boolean
}

const EXPORT_ITEMS: { format: ExportFormat; label: string }[] = [
  { format: 'md', label: 'Markdown 单文件 (.md)' },
  { format: 'mdpkg', label: '自包含包 (.mdpkg)' },
  { format: 'html', label: '网页 (.html)' },
  { format: 'png', label: '长图 (.png)' },
  { format: 'docx', label: 'Word (.docx)' },
  { format: 'zip', label: '压缩包 (.zip)' },
]

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

/** 点击外部检测（Bug 20）：ref 容器外的点击触发 onOutside，用于下拉菜单自动关闭。 */
function useClickOutside(ref: RefObject<HTMLElement | null>, onOutside: () => void): void {
  const onOutsideRef = useRef(onOutside)
  onOutsideRef.current = onOutside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const el = ref.current
      if (!el) return
      if (e.target instanceof Node && el.contains(e.target)) return
      onOutsideRef.current()
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [ref])
}

// ── 图标（内联 SVG，16×16 stroke 风格，与设计稿同源） ──────────────
const ICON = {
  edit: (
    <svg viewBox="0 0 24 24">
      <path d="M17 3l4 4L8 20l-5 1 1-5L17 3z" />
    </svg>
  ),
  source: (
    <svg viewBox="0 0 24 24">
      <path d="M8 6l-6 6 6 6M16 6l6 6-6 6" />
    </svg>
  ),
  preview: (
    <svg viewBox="0 0 24 24">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  open: (
    <svg viewBox="0 0 24 24">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  ),
  save: (
    <svg viewBox="0 0 24 24">
      <path d="M12 4v12m0 0l-4-4m4 4l4-4" />
      <path d="M4 20h16" />
    </svg>
  ),
  export: (
    <svg viewBox="0 0 24 24">
      <path d="M14 4h6v6" />
      <path d="M20 4 10 14" />
      <path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
    </svg>
  ),
  copyBody: (
    <svg viewBox="0 0 24 24">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="M21 15l-5-5-8 8" />
    </svg>
  ),
  share: (
    <svg viewBox="0 0 24 24">
      <path d="M12 16V4m0 0l-4 4m4-4l4 4" />
      <path d="M4 14v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" />
    </svg>
  ),
  invite: (
    <svg viewBox="0 0 24 24">
      <path d="M12 16V4m0 0l-4 4m4-4l4 4" />
      <path d="M4 14v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" />
    </svg>
  ),
  card: (
    <svg viewBox="0 0 24 24">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="M21 15l-5-5-8 8" />
    </svg>
  ),
  // 主题三态图标（change: theme-icon-tri-state）：跟随系统 = 半月，浅色 = 太阳，深色 = 月亮。
  themeSystem: (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" stroke="none" />
    </svg>
  ),
  themeLight: (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  ),
  themeDark: (
    <svg viewBox="0 0 24 24">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ),
  more: (
    <svg viewBox="0 0 24 24">
      <circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  ),
} as const

export function Toolbar({
  canSave,
  sourceKind,
  error,
  onSave,
  onExport,
  onOpenFile,
  currentMode = 'edit',
  onModeChange,
  onThemeClick,
  themeProp,
  onCopyInviteLink,
  onGenerateInviteCard,
  onCopyBodyAsImage,
  fsaAvailable = false,
  canPersist = false,
}: ToolbarProps): JSX.Element {
  const [exportOpen, setExportOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const isNarrow = useIsNarrow()

  const exportMenuRef = useRef<HTMLDivElement>(null)
  const moreMenuRef = useRef<HTMLDivElement>(null)
  const shareMenuRef = useRef<HTMLDivElement>(null)
  useClickOutside(exportMenuRef, () => setExportOpen(false))
  useClickOutside(moreMenuRef, () => setMoreOpen(false))
  useClickOutside(shareMenuRef, () => setShareOpen(false))

  // 决策 #42 三态主按钮：FSA 可用或已持久化 → 「保存」；无 FSA → 「下载」。
  const saveLabel = fsaAvailable || canPersist ? '保存' : '下载'
  const saveIsPrimary = fsaAvailable || canPersist

  const closeMore = useCallback(() => setMoreOpen(false), [])

  const modeButtons = (
    <>
      <button
        type="button"
        data-testid="mode-edit-btn"
        aria-label="编辑模式"
        aria-pressed={currentMode === 'edit'}
        disabled={!canSave}
        onClick={() => onModeChange?.('edit')}
        title="编辑模式"
        className="mode-btn disabled:cursor-not-allowed disabled:opacity-30"
      >
        {ICON.edit}
      </button>
      <button
        type="button"
        data-testid="mode-source-btn"
        aria-label="源码模式"
        aria-pressed={currentMode === 'source'}
        disabled={!canSave}
        onClick={() => onModeChange?.('source')}
        title="源码模式"
        className="mode-btn disabled:cursor-not-allowed disabled:opacity-30"
      >
        {ICON.source}
      </button>
      <button
        type="button"
        data-testid="mode-preview-btn"
        aria-label="预览模式"
        aria-pressed={currentMode === 'preview'}
        disabled={!canSave}
        onClick={() => onModeChange?.('preview')}
        title="预览模式"
        className="mode-btn disabled:cursor-not-allowed disabled:opacity-30"
      >
        {ICON.preview}
      </button>
    </>
  )

  // 桌面：三模式切换居中于顶栏（.mode-switch 绝对居中），其余动作靠右。
  const desktopModeSwitch = (
    <div
      className="mode-switch flex items-center gap-0.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-2)] p-0.5"
      role="group"
      aria-label="视图模式"
    >
      {modeButtons}
    </div>
  )

  // 主题按钮按偏好呈现：浅色 → 太阳，深色 → 月亮，跟随系统 → 半月（文案同步提示下一步）。
  const THEME_BUTTON: Record<
    'system' | 'dark' | 'light',
    { icon: JSX.Element; title: string; label: string }
  > = {
    light: {
      icon: ICON.themeLight,
      title: '当前：浅色（点击切换到跟随系统）',
      label: '当前浅色主题',
    },
    dark: {
      icon: ICON.themeDark,
      title: '当前：深色（点击切换到浅色）',
      label: '当前深色主题',
    },
    system: {
      icon: ICON.themeSystem,
      title: '当前：跟随系统（点击切换到深色）',
      label: '当前跟随系统主题',
    },
  }
  const themeButton = THEME_BUTTON[themeProp]

  const themeBtn = (
    <button
      type="button"
      data-testid="theme-btn"
      onClick={onThemeClick}
      title={themeButton.title}
      aria-label={themeButton.label}
      className="gbtn"
    >
      {themeButton.icon}
    </button>
  )

  // 移动端：打开新文件 + 模式图标 + more-btn + 主题
  if (isNarrow) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          data-testid="open-file-btn"
          onClick={onOpenFile}
          title="打开新文件"
          aria-label="打开新文件"
          className="gbtn"
        >
          {ICON.open}
        </button>

        <div className="flex items-center gap-0.5" role="group" aria-label="视图模式">
          {modeButtons}
        </div>

        <div className="relative" ref={moreMenuRef}>
          <button
            type="button"
            data-testid="more-menu-btn"
            onClick={() => setMoreOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            title="更多操作"
            aria-label="更多操作"
            className="gbtn"
          >
            {ICON.more}
          </button>
          {moreOpen && (
            <div
              role="menu"
              data-testid="more-menu"
              className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--glass-strong)] shadow-[var(--shadow)] backdrop-blur"
            >
              <button
                type="button"
                role="menuitem"
                data-testid="more-copy-body"
                onClick={() => {
                  closeMore()
                  onCopyBodyAsImage?.()
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[var(--fg)] transition-colors hover:bg-[var(--surface-2)]"
              >
                <span className="gbtn" style={{ height: 24, minWidth: 24, padding: 0 }}>
                  {ICON.copyBody}
                </span>
                复制正文为图片
              </button>
              <button
                type="button"
                role="menuitem"
                data-testid="more-share"
                onClick={() => {
                  closeMore()
                  onCopyInviteLink?.()
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[var(--fg)] transition-colors hover:bg-[var(--surface-2)]"
              >
                <span className="gbtn accent" style={{ height: 24, minWidth: 24, padding: 0 }}>
                  {ICON.share}
                </span>
                复制邀请链接
              </button>
              <button
                type="button"
                role="menuitem"
                data-testid="more-invite-card"
                onClick={() => {
                  closeMore()
                  onGenerateInviteCard?.()
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[var(--fg)] transition-colors hover:bg-[var(--surface-2)]"
              >
                <span className="gbtn accent" style={{ height: 24, minWidth: 24, padding: 0 }}>
                  {ICON.card}
                </span>
                邀请卡
              </button>
              <button
                type="button"
                role="menuitem"
                data-testid="more-save"
                disabled={!canSave}
                onClick={() => {
                  closeMore()
                  onSave()
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[var(--fg)] transition-colors hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="gbtn" style={{ height: 24, minWidth: 24, padding: 0 }}>
                  {ICON.save}
                </span>
                {saveLabel}
              </button>
              <div className="border-t border-[var(--border-soft)]" />
              <div className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--meta)]">
                导出交付物
              </div>
              {EXPORT_ITEMS.map(({ format, label }) => (
                <button
                  key={format}
                  type="button"
                  role="menuitem"
                  data-testid={`more-export-${format}`}
                  disabled={!canSave}
                  onClick={() => {
                    closeMore()
                    onExport(format)
                  }}
                  className="block w-full px-3 py-1.5 text-left text-xs text-[var(--fg)] transition-colors hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {label}
                </button>
              ))}
              </div>
          )}
        </div>

        {themeBtn}

        {error && (
          <p
            role="status"
            aria-live="polite"
            data-testid="export-error"
            className="text-xs text-[var(--danger)]"
          >
            {error}
          </p>
        )}
      </div>
    )
  }

  // 桌面：三模式切换居中于顶栏（.mode-switch 绝对居中），动作簇靠右。
  return (
    <>
      {desktopModeSwitch}
      <div className="flex items-center gap-1">
        <button
          type="button"
          data-testid="open-file-btn"
          onClick={onOpenFile}
          title="打开新文件"
          aria-label="打开新文件"
          className="gbtn"
        >
          {ICON.open}
        </button>

        <button
          type="button"
          data-testid="copy-body-image-btn"
          onClick={onCopyBodyAsImage}
          title="复制正文为图片"
          aria-label="复制正文为图片"
          className="gbtn"
        >
          {ICON.copyBody}
        </button>

        <button
          type="button"
          data-testid="save-btn"
          disabled={!canSave}
          onClick={onSave}
          title={fsaAvailable ? `保存为 ${sourceKind === 'mdpkg' ? '.mdpkg' : '.md'}` : '下载文档'}
          aria-label={fsaAvailable ? '保存文档' : '下载文档'}
          className={saveIsPrimary ? 'gbtn accent disabled:cursor-not-allowed disabled:opacity-50' : 'gbtn disabled:cursor-not-allowed disabled:opacity-50'}
        >
          {ICON.save}
          <span data-testid="save-btn-label">{saveLabel}</span>
        </button>

      <div className="relative" ref={exportMenuRef}>
        <button
          type="button"
          data-testid="export-btn"
          disabled={!canSave}
          onClick={() => setExportOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={exportOpen}
          title="导出交付物"
          aria-label="导出交付物"
          className="gbtn disabled:cursor-not-allowed disabled:opacity-30"
        >
          {ICON.export}
        </button>
        {exportOpen && (
          <div
            role="menu"
            data-testid="export-menu"
            className="absolute right-0 z-20 mt-1 w-32 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--glass-strong)] shadow-[var(--shadow)] backdrop-blur"
          >
            {EXPORT_ITEMS.map(({ format, label }) => (
              <button
                key={format}
                type="button"
                role="menuitem"
                data-testid={`export-${format}`}
                onClick={() => {
                  setExportOpen(false)
                  onExport(format)
                }}
                className="block w-full px-3 py-1.5 text-left text-xs text-[var(--fg)] transition-colors hover:bg-[var(--surface-2)]"
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative" ref={shareMenuRef}>
        <button
          type="button"
          data-testid="share-menu-btn"
          onClick={() => setShareOpen((o) => !o)}
          title="分享"
          aria-label="分享"
          aria-haspopup="menu"
          aria-expanded={shareOpen}
          className="gbtn"
        >
          {ICON.share}
        </button>
        {shareOpen && (
          <div
            role="menu"
            data-testid="share-menu"
            className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--glass-strong)] shadow-[var(--shadow)] backdrop-blur"
          >
            <button
              type="button"
              role="menuitem"
              data-testid="share-invite-link"
              onClick={() => {
                setShareOpen(false)
                onCopyInviteLink?.()
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[var(--fg)] transition-colors hover:bg-[var(--surface-2)]"
            >
              <span className="gbtn accent" style={{ height: 24, minWidth: 24, padding: 0 }}>
                {ICON.invite}
              </span>
              复制邀请链接
            </button>
            <button
              type="button"
              role="menuitem"
              data-testid="share-invite-card"
              onClick={() => {
                setShareOpen(false)
                onGenerateInviteCard?.()
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[var(--fg)] transition-colors hover:bg-[var(--surface-2)]"
            >
              <span className="gbtn accent" style={{ height: 24, minWidth: 24, padding: 0 }}>
                {ICON.card}
              </span>
              邀请卡
            </button>
          </div>
        )}
      </div>

      {themeBtn}

      {error && (
        <p
          role="status"
          aria-live="polite"
          data-testid="export-error"
          className="text-xs text-[var(--danger)]"
        >
          {error}
        </p>
      )}
      </div>
    </>
  )
}
