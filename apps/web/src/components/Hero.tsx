// 首页 Hero（任务 5.1）：深色 #165DFF 极简风格。
// 纯代码构图 —— logo 为内联 SVG；宣传图为代码生成的 SVG data URI（<img> 加载），
// 加载失败时 onError 隐藏 img 并切换到 CSS 合成 fallback 面板（布局不塌陷）。
import { useState } from 'react';

/** 宣传图：SVG data URI（文档卡片堆叠 + 内嵌图片 + 打包完成徽标）。 */
function buildPromoDataUrl(): string {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 300">',
    // 卡片堆叠（深 → 品牌蓝）
    '<rect x="70" y="40" width="340" height="220" rx="16" fill="#0d2f7a"/>',
    '<rect x="95" y="55" width="340" height="220" rx="16" fill="#1240c4"/>',
    '<rect x="120" y="70" width="340" height="220" rx="16" fill="#165DFF"/>',
    // 标题行 + 正文行
    '<rect x="150" y="105" width="180" height="14" rx="7" fill="#ffffff" opacity="0.95"/>',
    '<rect x="150" y="135" width="280" height="8" rx="4" fill="#ffffff" opacity="0.45"/>',
    '<rect x="150" y="152" width="240" height="8" rx="4" fill="#ffffff" opacity="0.45"/>',
    '<rect x="150" y="169" width="260" height="8" rx="4" fill="#ffffff" opacity="0.45"/>',
    // 内嵌图片块（山 + 太阳）
    '<rect x="150" y="195" width="120" height="70" rx="8" fill="#ffffff" opacity="0.18"/>',
    '<circle cx="185" cy="222" r="8" fill="#ffffff" opacity="0.7"/>',
    '<path d="M150 265 L190 225 L215 250 L235 232 L270 265 Z" fill="#ffffff" opacity="0.7"/>',
    // 打包完成徽标（✓）
    '<circle cx="430" cy="100" r="20" fill="#0d1117"/>',
    '<path d="M422 100 l6 6 l12 -14" stroke="#3fb950" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    '</svg>',
  ].join('');
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const PROMO_DATA_URL = buildPromoDataUrl();

/** CSS 合成 fallback 面板：与 SVG 宣传图同构的卡片堆叠（纯 div + 渐变）。 */
function PromoFallback(): JSX.Element {
  return (
    <div data-testid="promo-fallback" className="relative h-full w-full" aria-hidden="true">
      <div className="absolute left-[15%] top-[13%] h-[73%] w-[71%] rounded-2xl bg-[#0d2f7a]" />
      <div className="absolute left-[20%] top-[18%] h-[73%] w-[71%] rounded-2xl bg-[#1240c4]" />
      <div className="absolute left-[25%] top-[23%] h-[73%] w-[71%] rounded-2xl bg-gradient-to-br from-[#165DFF] to-[#3c7dff] p-6">
        <div className="h-3 w-2/5 rounded-full bg-white/95" />
        <div className="mt-4 h-1.5 w-4/5 rounded-full bg-white/45" />
        <div className="mt-2 h-1.5 w-3/5 rounded-full bg-white/45" />
        <div className="mt-2 h-1.5 w-2/3 rounded-full bg-white/45" />
        <div className="mt-4 flex h-16 w-24 items-center justify-center rounded-lg bg-white/20">
          <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="9" r="2" fill="white" stroke="none" />
            <path d="M3 19 L9 12 L13 16 L17 12 L21 19 Z" />
          </svg>
        </div>
        <div className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#0d1117]">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="#3fb950" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12 l5 5 l9 -10" />
          </svg>
        </div>
      </div>
    </div>
  );
}

export function Hero(): JSX.Element {
  const [promoFailed, setPromoFailed] = useState(false);

  return (
    <section className="border-b border-[#30363d] bg-[#0d1117]">
      <div className="mx-auto max-w-6xl px-6 py-16 text-center sm:py-20">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center">
          <svg
            data-testid="logo"
            width="56"
            height="56"
            viewBox="0 0 56 56"
            role="img"
            aria-label="MD-Bundle 标志"
          >
            <rect x="2" y="2" width="52" height="52" rx="14" fill="#165DFF" />
            <path
              d="M16 40 V16 L28 28 L40 16 V40"
              stroke="#ffffff"
              strokeWidth="5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
          分享 Markdown，不再裂图。
        </h1>
        <p className="mt-4 text-lg text-[#8b949e]">一个文件，带走全部图文。</p>
        <p className="mt-3 text-sm text-[#8b949e]">
          <span>在线打开</span>
          <span className="mx-2 text-[#30363d]" aria-hidden>
            /
          </span>
          <span>编辑</span>
          <span className="mx-2 text-[#30363d]" aria-hidden>
            /
          </span>
          <span>导出 .md 与 .mdpkg</span>
        </p>

        <a
          href="#workspace"
          className="mt-8 inline-block rounded-lg bg-[#165DFF] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[#3c7dff]"
        >
          立即开始
        </a>

        <div data-testid="promo-wrap" className="mx-auto mt-12 h-64 w-full max-w-xl sm:h-72">
          {promoFailed ? (
            <PromoFallback />
          ) : (
            <img
              data-testid="promo"
              src={PROMO_DATA_URL}
              alt="MD-Bundle 图文打包示意：一个文件带走全部图文"
              className="h-full w-full object-contain"
              onError={() => setPromoFailed(true)}
            />
          )}
        </div>
      </div>
    </section>
  );
}