// 分享卡「复制为图片」按钮（任务 6.2）—— 6.4 将把它接进 Toolbar。
// 行为：点击 → shareCardAsImage（卡片 SVG → PNG → 剪贴板）；复制失败 → 下载兜底
// （downloadBlob('share-card.png')）。无文档数据（canShare false）或 disabled prop → 禁用。
// 可选 preview：渲染卡片 HTML 的实时预览（600×300 定尺寸，容器内缩放展示）。
import { useState } from 'react';
import {
  buildShareCardHtml,
  canShare,
  shareCardAsImage,
  type ShareCardStats,
} from '../lib/shareCard';
import { downloadBlob } from '../lib/download';
import type { ThemeName } from '@md-bundle/editor';

export interface ShareCardProps {
  title: string;
  markdown: string;
  stats: ShareCardStats;
  /** 当前主题（默认 'dark'）。 */
  theme?: ThemeName;
  /** 外部禁用（6.4：无文档时置 true）。内部还会按 canShare 自判。 */
  disabled?: boolean;
  /** 是否渲染卡片 HTML 预览（默认 false —— 6.4 可选开启）。 */
  showPreview?: boolean;
  /** 复制成功回调（6.4：徽标 toast 上下文）。 */
  onCopied?: () => void;
  /** 兜底下载回调（6.4：可选提示）。 */
  onDownloaded?: () => void;
}

export function ShareCard({
  title,
  markdown,
  stats,
  theme = 'dark',
  disabled = false,
  showPreview = false,
  onCopied,
  onDownloaded,
}: ShareCardProps): JSX.Element {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const shareable = canShare({ title, stats });
  const cardHtml = showPreview ? buildShareCardHtml({ title, markdown, stats, theme }) : '';

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const { copied, blob } = await shareCardAsImage({ title, markdown, stats, theme });
      if (copied) {
        setStatus('已复制到剪贴板');
        onCopied?.();
      } else {
        downloadBlob(blob, 'share-card.png');
        setStatus('已下载 share-card.png');
        onDownloaded?.();
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : '分享卡生成失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="share-card">
      <div className="flex items-center gap-3">
        <button
          type="button"
          data-testid="share-card-btn"
          onClick={handleClick}
          disabled={disabled || !shareable || busy}
          className="rounded-lg border border-[#30363d] bg-[#21262d] px-3 py-1.5 text-sm text-slate-200 transition-colors hover:border-[#165DFF] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? '生成中…' : '复制为图片'}
        </button>
        {status && (
          <span data-testid="share-card-status" className="text-xs text-[#8b949e]">
            {status}
          </span>
        )}
      </div>
      {showPreview && (
        <div
          data-testid="share-card-preview"
          className="pointer-events-none mt-2 h-[150px] w-[300px] overflow-hidden rounded-lg border border-[#30363d]"
        >
          <div
            style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: 600 }}
            dangerouslySetInnerHTML={{ __html: cardHtml }}
          />
        </div>
      )}
    </div>
  );
}