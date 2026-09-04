// 徽章解锁 toast（任务 6.4）—— 纯视图：固定底部居中胶囊，✨ + 文案，稀有度着色。
// 自动消失由 useBadges 的定时器负责（3.5s）；点击可立即关闭（onDismiss）。
// role=status：屏幕阅读器播报，不打断焦点。
import type { Rarity } from '../lib/badges';

export interface BadgeToastProps {
  text: string;
  rarity: Rarity;
  onDismiss: () => void;
}

/** 稀有度 → 文字颜色（GitHub 暗色语义色）。 */
const RARITY_COLORS: Record<Rarity, string> = {
  common: '#8b949e',
  rare: '#58a6ff',
  epic: '#a371f7',
  legendary: '#d29922',
};

export function BadgeToast({ text, rarity, onDismiss }: BadgeToastProps): JSX.Element {
  return (
    <div
      role="status"
      data-testid="badge-toast"
      onClick={onDismiss}
      className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 cursor-pointer rounded-full border border-[#30363d] bg-[#161b22] px-4 py-2 text-sm shadow-lg"
    >
      <span aria-hidden="true" className="mr-1.5">
        ✨
      </span>
      <span style={{ color: RARITY_COLORS[rarity] }}>{text}</span>
    </div>
  );
}