// TabStrip 组件 —— 最小页签条（任务 4.1）。
// 仅名字+点击切换+关闭钮；4.3 在此基础上做脏点/确认/溢出。
import type { Tab } from '../lib/tabs';

export interface TabStripProps {
  tabs: Tab[];
  activeId: string | null;
  onSelect: (tabId: string) => void;
  onClose: (tabId: string) => void;
}

export function TabStrip({ tabs, activeId, onSelect, onClose }: TabStripProps): JSX.Element | null {
  if (tabs.length === 0) return null;

  return (
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
          <span className="max-w-[120px] truncate">{tab.name}</span>
          <button
            type="button"
            aria-label={`关闭 ${tab.name}`}
            className="ml-1 rounded p-0.5 text-[#8b949e] opacity-0 transition-opacity hover:bg-[#30363d] hover:text-[#e6edf3] group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onClose(tab.id);
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
