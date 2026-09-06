// 顶栏 v2（任务 2.1）—— ghost 图标动作区 + 三模式切换图标 + 单一主按钮。
// 右起读：主题◐（最右）→ 分享 → 导出▾ → 保存（主按钮）→ 复制正文为图片（最左）
// + 三模式 ghost 图标（铅笔/代码/眼睛）在左侧独立区域。
// 动作区 ghost 风格：透明底弱描边，默认低不透明度、hover 提亮（不抢眼）。
// 保存主按钮为例外——保持主色高对比（primary button）。
// 禁用组按动作分：无文档时保存/导出/复制正文 disabled；分享/主题为过渡期 disabled（待接线）。
// 任务 2.7：移动端 <768px → 动作区折叠入 more-btn 溢出菜单（排序同桌面右起），主题保留顶栏最右。
import { useCallback, useEffect, useState } from 'react';

export type ExportFormat = 'md' | 'mdpkg' | 'html' | 'png';
export type EditorMode = 'edit' | 'source' | 'preview';

export interface ToolbarProps {
  /** 保存按钮可用性（空态禁用）。 */
  canSave: boolean;
  /** 当前文档来源（决定保存目标提示）。 */
  sourceKind: 'md' | 'mdpkg';
  /** 导出失败的内联错误文案（role=status 展示；null = 无错误）。 */
  error?: string | null;
  /** 点击保存（内容驱动：有图 → .mdpkg，无图 → .md，打开 .mdpkg → 重打包）。 */
  onSave: () => void;
  /** 点击导出下拉项（显式格式：.md / .mdpkg / HTML / PNG 长图）。 */
  onExport: (format: ExportFormat) => void;
  /** 点击「复制正文为图片」（文档正文 PNG → 剪贴板）。 */
  onCopyImage?: () => void;
  /** 当前编辑模式（编辑/源码/预览）。 */
  currentMode?: EditorMode;
  /** 切换编辑模式（派发 setMode 到 App 状态）。 */
  onModeChange?: (mode: EditorMode) => void;
}

const EXPORT_ITEMS: { format: ExportFormat; label: string }[] = [
  { format: 'md', label: '.md' },
  { format: 'mdpkg', label: '.mdpkg' },
  { format: 'html', label: 'HTML' },
  { format: 'png', label: 'PNG 长图' },
];

/** 窄屏检测（<768px）。 */
function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(max-width: 767px)').matches;
  });
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setNarrow(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return narrow;
}

export function Toolbar({
  canSave,
  sourceKind,
  error,
  onSave,
  onExport,
  onCopyImage,
  currentMode = 'edit',
  onModeChange,
}: ToolbarProps): JSX.Element {
  const [exportOpen, setExportOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const isNarrow = useIsNarrow();

  const closeMore = useCallback(() => setMoreOpen(false), []);

  const modeIcons = (
    <div className="flex items-center gap-1">
      <button
        type="button"
        data-testid="mode-edit-btn"
        aria-label="编辑模式"
        aria-pressed={currentMode === 'edit'}
        disabled={!canSave}
        onClick={() => onModeChange?.('edit')}
        title="编辑模式"
        className={`rounded p-1.5 text-sm transition-colors ${
          currentMode === 'edit'
            ? 'bg-[#30363d] text-slate-100'
            : 'text-slate-400 opacity-60 hover:text-slate-200 hover:opacity-100'
        } disabled:cursor-not-allowed disabled:opacity-30`}
      >
        ✏️
      </button>
      <button
        type="button"
        data-testid="mode-source-btn"
        aria-label="源码模式"
        aria-pressed={currentMode === 'source'}
        disabled={!canSave}
        onClick={() => onModeChange?.('source')}
        title="源码模式"
        className={`rounded p-1.5 text-sm transition-colors ${
          currentMode === 'source'
            ? 'bg-[#30363d] text-slate-100'
            : 'text-slate-400 opacity-60 hover:text-slate-200 hover:opacity-100'
        } disabled:cursor-not-allowed disabled:opacity-30`}
      >
        &lt;/&gt;
      </button>
      <button
        type="button"
        data-testid="mode-preview-btn"
        aria-label="预览模式"
        aria-pressed={currentMode === 'preview'}
        disabled={!canSave}
        onClick={() => onModeChange?.('preview')}
        title="预览模式"
        className={`rounded p-1.5 text-sm transition-colors ${
          currentMode === 'preview'
            ? 'bg-[#30363d] text-slate-100'
            : 'text-slate-400 opacity-60 hover:text-slate-200 hover:opacity-100'
        } disabled:cursor-not-allowed disabled:opacity-30`}
      >
        👁️
      </button>
    </div>
  );

  const themeBtn = (
    <button
      type="button"
      data-testid="theme-btn"
      disabled
      title="主题切换（开发中）"
      aria-label="主题切换"
      className="rounded p-1.5 text-sm text-slate-400 opacity-60 transition-colors hover:text-slate-200 hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30"
    >
      ◐
    </button>
  );

  // 移动端：模式图标 + more-btn + 主题
  if (isNarrow) {
    return (
      <div className="flex items-center gap-2">
        {modeIcons}

        <div className="relative">
          <button
            type="button"
            data-testid="more-menu-btn"
            onClick={() => setMoreOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            title="更多操作"
            aria-label="更多操作"
            className="rounded p-1.5 text-sm text-slate-400 opacity-60 transition-colors hover:text-slate-200 hover:opacity-100"
          >
            ⋯
          </button>
          {moreOpen && (
            <div
              role="menu"
              data-testid="more-menu"
              className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-lg border border-[#30363d] bg-[#161b22] shadow-lg"
            >
              <button
                type="button"
                role="menuitem"
                data-testid="more-share"
                disabled
                onClick={closeMore}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-400 transition-colors hover:bg-[#21262d] hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                🔗 分享
              </button>
              <button
                type="button"
                role="menuitem"
                data-testid="more-save"
                disabled={!canSave}
                onClick={() => {
                  closeMore();
                  onSave();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-200 transition-colors hover:bg-[#21262d] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                💾 保存
              </button>
              <div className="border-t border-[#30363d]" />
              <div className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-[#8b949e]">
                导出
              </div>
              {EXPORT_ITEMS.map(({ format, label }) => (
                <button
                  key={format}
                  type="button"
                  role="menuitem"
                  data-testid={`more-export-${format}`}
                  disabled={!canSave}
                  onClick={() => {
                    closeMore();
                    onExport(format);
                  }}
                  className="block w-full px-3 py-1.5 text-left text-xs text-slate-200 transition-colors hover:bg-[#21262d] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {label}
                </button>
              ))}
              <div className="border-t border-[#30363d]" />
              <button
                type="button"
                role="menuitem"
                data-testid="more-copy-image"
                disabled={!canSave || !onCopyImage}
                onClick={() => {
                  closeMore();
                  onCopyImage?.();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-200 transition-colors hover:bg-[#21262d] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                📋 复制正文为图片
              </button>
            </div>
          )}
        </div>

        {themeBtn}

        {error && (
          <p role="status" aria-live="polite" data-testid="export-error" className="text-xs text-red-400">
            {error}
          </p>
        )}
      </div>
    );
  }

  // 桌面：模式图标 + 复制正文 + 保存 + 导出▾ + 分享 + 主题
  return (
    <div className="flex items-center gap-2">
      {modeIcons}

      {onCopyImage && (
        <button
          type="button"
          data-testid="doc-image-btn"
          disabled={!canSave}
          onClick={onCopyImage}
          title="复制正文为图片"
          aria-label="复制正文为图片"
          className="rounded p-1.5 text-sm text-slate-400 opacity-60 transition-colors hover:text-slate-200 hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30"
        >
          📋
        </button>
      )}

      <button
        type="button"
        data-testid="save-btn"
        disabled={!canSave}
        onClick={onSave}
        title={sourceKind === 'mdpkg' ? '重新打包为 .mdpkg' : '保存文档'}
        className="rounded-lg bg-[#165DFF] px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-[#3c7dff] disabled:cursor-not-allowed disabled:opacity-50"
      >
        保存
      </button>

      <div className="relative">
        <button
          type="button"
          data-testid="export-btn"
          disabled={!canSave}
          onClick={() => setExportOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={exportOpen}
          title="导出"
          aria-label="导出"
          className="rounded p-1.5 text-sm text-slate-400 opacity-60 transition-colors hover:text-slate-200 hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30"
        >
          📥
        </button>
        {exportOpen && (
          <div
            role="menu"
            data-testid="export-menu"
            className="absolute right-0 z-20 mt-1 w-32 overflow-hidden rounded-lg border border-[#30363d] bg-[#161b22] shadow-lg"
          >
            {EXPORT_ITEMS.map(({ format, label }) => (
              <button
                key={format}
                type="button"
                role="menuitem"
                data-testid={`export-${format}`}
                onClick={() => {
                  setExportOpen(false);
                  onExport(format);
                }}
                className="block w-full px-3 py-1.5 text-left text-xs text-slate-200 transition-colors hover:bg-[#21262d] hover:text-white"
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        data-testid="share-menu-btn"
        disabled
        title="分享（开发中）"
        aria-label="分享"
        className="rounded p-1.5 text-sm text-slate-400 opacity-60 transition-colors hover:text-slate-200 hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30"
      >
        🔗
      </button>

      {themeBtn}

      {error && (
        <p role="status" aria-live="polite" data-testid="export-error" className="text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
