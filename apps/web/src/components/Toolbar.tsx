// 工具栏（任务 4.1）—— 纯视图：保存主按钮（内容驱动）+ 导出下拉（4 格式）。
// 所有动作经 props 上抛，App 负责接线（saveDocument / exportMd / exportMdpkg /
// buildHtmlDocument / exportPngFromMarkdown）。导出错误（如 PNG 空文档）由 App
// 传入 error 文案，此处渲染 role=status 内联提示（自动清除由 App 定时器负责）。
import { useState } from 'react';

export type ExportFormat = 'md' | 'mdpkg' | 'html' | 'png';

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
}

const EXPORT_ITEMS: { format: ExportFormat; label: string }[] = [
  { format: 'md', label: '.md' },
  { format: 'mdpkg', label: '.mdpkg' },
  { format: 'html', label: 'HTML' },
  { format: 'png', label: 'PNG 长图' },
];

export function Toolbar({ canSave, sourceKind, error, onSave, onExport }: ToolbarProps): JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
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
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
          className="rounded-lg border border-[#30363d] bg-[#21262d] px-3 py-1 text-xs font-medium text-slate-200 transition-colors hover:border-[#8b949e]"
        >
          导出 ▾
        </button>
        {open && (
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
                  setOpen(false);
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

      {error && (
        <p role="status" aria-live="polite" data-testid="export-error" className="text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}