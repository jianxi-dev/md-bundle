
// 左栏（任务 2.4 + 2.7 + Wave 5.2）—— 桌面 260px 可收起侧栏；移动端底部抽屉（鸡蛋形 toggle）。
// 默认收起（toggle 按钮 ghost 风格）；收起/展开状态记忆 localStorage。
// 文件页签承载 FileTree（Wave 5.2）；资源页签承载 AssetPanel。
// 资源有孤儿时 toggle 显示徽标点。
// 任务 2.7：移动端 <768px → 底部抽屉（横向椭圆鸡蛋形 toggle + fixed 抽屉面板）。
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AssetPanel, type AssetPanelProps } from './AssetPanel';
import { FileTree } from './FileTree';
import { computeOrphans } from '../lib/assets';
const STORAGE_KEY = 'md-bundle.left-rail';

export interface LeftRailProps {
  /** 资产清单（传给 AssetPanel）。 */
  assets: AssetPanelProps['assets'];
  /** 文档文本（传给 AssetPanel 计算孤儿）。 */
  documentText: AssetPanelProps['documentText'];
  /** 删除资产回调。 */
  onDelete: AssetPanelProps['onDelete'];
  /** 替换资产回调。 */
  onReplace: AssetPanelProps['onReplace'];
  /** 打开文件回调（FileTree 点击 .md/.mdpkg → 新增 tab + 持有 handle）。 */
  onOpenFile: (file: File, handle: FileSystemFileHandle) => void;
  /** 当前活动页签文件名（FileTree 高亮匹配节点）。 */
  activeTabName: string | null;
}

type RailTab = 'files' | 'assets';

/** 从 localStorage 读取左栏状态（SSR 安全）。 */
function readOpen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** 写入左栏状态到 localStorage。 */
function writeOpen(v: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(v));
  } catch {
    // localStorage 不可用时静默忽略
  }
}

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
}: {
  tab: RailTab;
  setTab: (t: RailTab) => void;
  hasOrphans: boolean;
  assets: AssetPanelProps['assets'];
  documentText: AssetPanelProps['documentText'];
  onDelete: AssetPanelProps['onDelete'];
  onReplace: AssetPanelProps['onReplace'];
  onOpenFile: (file: File, handle: FileSystemFileHandle) => void;
  activeTabName: string | null;
}): JSX.Element {
  return (
    <>
      {/* 页签栏 */}
      <div className="flex border-b border-[#30363d]" role="tablist" aria-label="左栏页签">
        <button
          type="button"
          role="tab"
          data-testid="left-rail-tab-files"
          aria-selected={tab === 'files'}
          onClick={() => setTab('files')}
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
            tab === 'files'
              ? 'border-b-2 border-[#165DFF] text-slate-100'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          文件
        </button>
        <button
          type="button"
          role="tab"
          data-testid="left-rail-tab-assets"
          aria-selected={tab === 'assets'}
          onClick={() => setTab('assets')}
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
            tab === 'assets'
              ? 'border-b-2 border-[#165DFF] text-slate-100'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          资源
          {hasOrphans && tab !== 'assets' && (
            <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-400 align-middle" />
          )}
        </button>
      </div>

      {/* 页签内容 */}
      <div className="flex-1 overflow-auto p-3">
        {tab === 'files' ? (
          <FileTree onOpenFile={onOpenFile} activeTabName={activeTabName} />
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
  );
}

export function LeftRail({
  assets,
  documentText,
  onDelete,
  onReplace,
  onOpenFile,
  activeTabName,
}: LeftRailProps): JSX.Element {
  const [open, setOpen] = useState(readOpen);
  const [tab, setTab] = useState<RailTab>('files');
  const isNarrow = useIsNarrow();

  // 孤儿计算（与 AssetPanel 同一口径）
  const orphans = useMemo(() => computeOrphans(assets, documentText), [assets, documentText]);
  const hasOrphans = orphans.size > 0;

  const toggleOpen = useCallback(() => {
    const next = !open;
    setOpen(next);
    writeOpen(next);
  }, [open]);

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
    />
  );

  // 移动端：鸡蛋形 toggle + 底部抽屉
  if (isNarrow) {
    return (
      <>
        <button
          type="button"
          data-testid="mobile-rail-toggle"
          onClick={toggleOpen}
          aria-label={open ? '关闭文件面板' : '打开文件面板'}
          title={open ? '关闭文件面板' : '打开文件面板'}
          className="fixed bottom-5 left-4 z-40 flex h-8 w-11 items-center justify-center rounded-[40%_60%_60%_40%/60%_40%_60%_40%] border border-[#30363d] bg-[#161b22] text-sm text-slate-400 opacity-80 shadow-lg transition-colors hover:text-slate-200 hover:opacity-100"
        >
          📁
          {!open && hasOrphans && (
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-400" />
          )}
        </button>

        {open && (
          <div
            data-testid="mobile-rail-drawer"
            className="fixed inset-x-0 bottom-0 z-30 flex max-h-[60vh] flex-col rounded-t-2xl border-t border-[#30363d] bg-[#161b22] shadow-2xl"
          >
            <div className="flex justify-center py-2">
              <div className="h-1 w-8 rounded-full bg-[#30363d]" />
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{content}</div>
          </div>
        )}
      </>
    );
  }

  // 桌面：ghost toggle + 260px 侧栏
  return (
    <>
      <button
        type="button"
        data-testid="left-rail-toggle"
        onClick={toggleOpen}
        aria-label={open ? '收起左栏' : '展开左栏'}
        title={open ? '收起左栏' : '展开左栏'}
        className="relative rounded p-1.5 text-sm text-slate-400 opacity-60 transition-colors hover:text-slate-200 hover:opacity-100"
      >
        ☰
        {!open && hasOrphans && (
          <span
            data-testid="left-rail-badge"
            className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-400"
          />
        )}
      </button>

      {open && (
        <aside
          data-testid="left-rail"
          className="flex h-full w-[260px] shrink-0 flex-col overflow-hidden border-r border-[#30363d] bg-[#161b22]/80"
        >
          {content}
        </aside>
      )}
    </>
  );
}
