// 落地页（任务 2.6）：替代 Hero + Gallery 组合，提供完整的 Landing 全页体验。
// 结构：细导航 → hero 双行 slogan → 格式范围标注行 → 产品主视觉 → 双 CTA → 三价值徽标 → 精选作品 → 页脚。
// 精选作品卡片缩略用 renderMarkdown 首屏渲染片段（真渲染）。
// 视觉方向：深色 #0d1117/#161b22 底 + #165DFF 主色（v1 皮）。
// 邀请变体（任务 26）：?ref=invite&by=<昵称> → InviteView（邀请署名 + CTA 预载演示文档）。
import { useMemo } from 'react';
import { renderMarkdown } from '@md-bundle/renderer';
import { FEATURED_EXAMPLES } from '../examples';
import { parseInviteParams, INVITE_SITE_URL, INVITE_VALUE_POINTS } from '../lib/shareLink';

export interface LandingProps {
  /** 打开示例（精选卡片点击 → 载入编辑器）。 */
  onOpenExample: (example: { id: string; content: string; format: 'md' | 'mdpkg' }) => void;
}

/** 价值徽标数据。 */
const VALUE_BADGES = [
  { icon: '🔒', label: '纯本地零上传', desc: '文件不离开浏览器' },
  { icon: '📦', label: '一键单文件', desc: '.mdpkg 图文打包' },
  { icon: '📋', label: '复制即分享', desc: '一个文件带走全部' },
];

/**
 * 卡片缩略渲染：截取内容前 600 字符做 renderMarkdown，max-height + overflow 裁切。
 * 禁注入风险内容——示例是自有源数据，仍走 renderMarkdown 消毒。
 */
function CardThumbnail({ content }: { content: string }): JSX.Element {
  const snippet = useMemo(() => {
    const truncated = content.length > 600 ? content.slice(0, 600) + '\n\n…' : content;
    return renderMarkdown(truncated);
  }, [content]);

  return (
    <div
      data-testid="card-thumbnail"
      className="pointer-events-none overflow-hidden rounded-t-xl bg-[#0d1117]"
      style={{ maxHeight: 180 }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: snippet }}
    />
  );
}

/** 邀请视图卖点文案（与 VALUE_BADGES 同源，独立引用供 InviteView 使用）。 */
const INVITE_POINTS: ReadonlyArray<{ icon: string; label: string; desc: string }> = INVITE_VALUE_POINTS;

/**
 * 邀请视图（任务 26）：落地页邀请变体。
 * 昵称为视觉主角 + 卖点 + 产品图 + CTA（预载演示文档）+ 显著展示网址。
 */
function InviteView({
  nickname,
  onOpenDemo,
}: {
  nickname: string;
  onOpenDemo: () => void;
}): JSX.Element {
  return (
    <>
      {/* ── 邀请 Hero ── */}
      <section className="border-b border-[#30363d] bg-[#0d1117]">
        <div className="mx-auto max-w-6xl px-6 pt-16 pb-10 text-center sm:pt-20">
          {/* 昵称徽章（视觉主角） */}
          <div data-testid="invite-badge" className="mx-auto mb-6 inline-flex items-center gap-3">
            <span
              className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#165DFF] to-[#7c3aed] text-3xl shadow-lg shadow-[#165DFF]/20"
              aria-hidden="true"
            >
              ✨
            </span>
          </div>

          <p className="text-lg text-[#8b949e]">邀请你来 MD-Bundle</p>

          <h1
            data-testid="invite-hero"
            className="mx-auto mt-2 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl"
          >
            <span className="bg-gradient-to-r from-[#58a6ff] to-[#165DFF] bg-clip-text text-transparent">
              @{nickname}
            </span>
            <br />
            邀你一起
            <br />
            打包分享 Markdown
          </h1>

          <p className="mt-4 text-lg text-[#8b949e]">
            一个文件，带走全部图文 · 不再裂图
          </p>
        </div>
      </section>

      {/* ── 卖点 ── */}
      <section className="border-t border-[#30363d] bg-[#161b22]">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div data-testid="invite-points" className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {INVITE_POINTS.map((point, i) => (
              <div
                key={point.label}
                data-testid={`invite-point-${i}`}
                className="rounded-xl border border-[#30363d] bg-[#0d1117] p-6 text-center transition-colors hover:border-[#165DFF]/50"
              >
                <span className="text-3xl" aria-hidden>{point.icon}</span>
                <h3 className="mt-3 text-base font-semibold text-white">{point.label}</h3>
                <p className="mt-1 text-sm text-[#8b949e]">{point.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 产品主视觉 ── */}
      <section className="bg-[#0d1117]">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <div
            data-testid="invite-product-visual"
            className="overflow-hidden rounded-xl border border-[#30363d] bg-[#161b22]"
          >
            <div className="flex items-center gap-2 border-b border-[#30363d] bg-[#0d1117] px-4 py-2">
              <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
              <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
              <span className="h-3 w-3 rounded-full bg-[#28c840]" />
              <span className="ml-3 text-xs text-[#8b949e]">MD-Bundle 编辑器</span>
            </div>
            <div className="flex h-64 sm:h-80">
              <div className="hidden w-10 border-r border-[#30363d] bg-[#0d1117] py-4 text-right text-xs leading-6 text-[#484f58] sm:block">
                <div>1</div><div>2</div><div>3</div><div>4</div><div>5</div>
                <div>6</div><div>7</div><div>8</div><div>9</div><div>10</div>
                <div>11</div><div>12</div><div>13</div>
              </div>
              <div className="flex-1 overflow-hidden p-4 font-mono text-sm leading-6">
                <div className="text-2xl font-bold text-white"># MD-Bundle 使用指南</div>
                <div className="mt-3 text-[#8b949e]">MD-Bundle 是一个 <span className="text-[#7ee787]">Markdown</span> 自包含工具。</div>
                <div className="mt-2 text-[#8b949e]">支持 <span className="text-[#d2a8ff]">图片打包</span>、<span className="text-[#d2a8ff]">公式渲染</span>、流程图。</div>
                <div className="mt-3 text-[#8b949e]">## 核心功能</div>
                <div className="mt-2 pl-4 text-[#8b949e]">- 打开 <span className="text-[#7ee787]">.md</span> 文件编辑</div>
                <div className="pl-4 text-[#8b949e]">- 导入图片 → 保存为 <span className="text-[#7ee787]">.mdpkg</span></div>
                <div className="pl-4 text-[#8b949e]">- 导出 HTML / PNG 长图</div>
                <div className="mt-3 rounded-lg border border-[#30363d] bg-[#0d1117] p-3 text-[#d29922]">
                  💡 提示：拖拽图片到编辑器即可快速导入
                </div>
                <div className="mt-3 text-[#8b949e]">&gt; 引用：一个文件，带走全部图文。</div>
                <div className="mt-2 h-4 w-2 bg-white/80 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-[#0d1117]">
        <div className="mx-auto max-w-6xl px-6 pb-12 text-center">
          <button
            type="button"
            data-testid="invite-cta"
            onClick={onOpenDemo}
            className="rounded-lg bg-[#165DFF] px-10 py-4 text-lg font-medium text-white transition-colors hover:bg-[#3c7dff]"
          >
            打开 MD-Bundle
          </button>
          {/* 显著展示网址 */}
          <p data-testid="invite-site-url" className="mt-6 font-mono text-sm text-[#58a6ff]">
            {INVITE_SITE_URL}
          </p>
        </div>
      </section>

      {/* ── 页脚 ── */}
      <footer className="border-t border-[#30363d] bg-[#161b22]">
        <div className="mx-auto max-w-6xl px-6 py-8 text-center text-sm text-[#8b949e]">
          <p>
            MD-Bundle（本兜）· 纯前端 Markdown 工具 ·{' '}
            <a
              href="https://github.com/jianxi-dev/md-bundle"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#58a6ff] hover:underline"
            >
              GitHub
            </a>{' '}
            · MIT License
          </p>
          <p className="mt-2 text-xs text-[#484f58]">
            文件不离开浏览器 · 纯本地运行 · 零上传
          </p>
        </div>
      </footer>
    </>
  );
}

export function Landing({ onOpenExample }: LandingProps): JSX.Element {
  /** 触发文件选择器。 */
  const handleOpenClick = () => {
    const input = document.querySelector<HTMLInputElement>('[data-testid="file-input"]');
    input?.click();
  };

  /** 滚动到精选作品区域。 */
  const scrollToExamples = () => {
    document.querySelector('[data-testid="featured-section"]')?.scrollIntoView({ behavior: 'smooth' });
  };

  /** 邀请链接：预载第一个演示文档进编辑器。 */
  const handleOpenDemo = () => {
    const demo = FEATURED_EXAMPLES[0];
    onOpenExample(demo);
  };

  // 检测邀请链接（ref=invite + 有效 by 参数）→ 渲染 InviteView
  const invite = parseInviteParams();
  if (invite) {
    return <InviteView nickname={invite.by} onOpenDemo={handleOpenDemo} />;
  }

  return (
    <>
      {/* ── 细导航 ── */}
      <nav data-testid="landing-nav" className="border-b border-[#30363d] bg-[#161b22]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <span className="text-lg font-bold tracking-tight text-white">
            MD-Bundle（本兜）
          </span>
          <div className="flex items-center gap-6 text-sm text-[#8b949e]">
            <a href="#workspace" className="transition-colors hover:text-white">
              编辑器
            </a>
            <a href="#format-info" className="transition-colors hover:text-white">
              格式说明
            </a>
            <a href="#about" className="transition-colors hover:text-white">
              关于
            </a>
            <a
              href="https://github.com/jianxi-dev/md-bundle"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-white"
            >
              GitHub
            </a>
            <span className="rounded bg-[#30363d] px-2 py-0.5 text-xs text-[#8b949e]">
              MIT
            </span>
          </div>
        </div>
      </nav>

      {/* ── Hero 双行 slogan ── */}
      <section className="border-b border-[#30363d] bg-[#0d1117]">
        <div className="mx-auto max-w-6xl px-6 pt-16 pb-10 text-center sm:pt-20">
          <h1
            data-testid="hero-slogan"
            className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl"
          >
            分享 Markdown
            <br />
            不再裂图
          </h1>

          <p className="mt-4 text-lg text-[#8b949e]">
            一个文件，带走全部图文
          </p>

          {/* ── 格式范围标注行 ── */}
          <div
            id="format-info"
            data-testid="format-line"
            className="mx-auto mt-6 flex flex-wrap items-center justify-center gap-3 text-sm text-[#8b949e]"
          >
            <span className="rounded-full bg-[#165DFF]/15 px-3 py-1 text-[#58a6ff]">
              <span className="font-mono font-bold">.md</span> 打开编辑
            </span>
            <span className="text-[#30363d]" aria-hidden>·</span>
            <span className="rounded-full bg-[#165DFF]/15 px-3 py-1 text-[#58a6ff]">
              <span className="font-mono font-bold">.mdpkg</span> 一键打包
            </span>
            <span className="text-[#30363d]" aria-hidden>·</span>
            <span className="rounded-full bg-[#165DFF]/15 px-3 py-1 text-[#58a6ff]">
              导出 <span className="font-mono font-bold">md · HTML · PNG</span> 长图
            </span>
          </div>
        </div>
      </section>

      {/* ── 产品主视觉（CSS 渲染的编辑工作区静态复刻） ── */}
      <section className="bg-[#0d1117]">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <div
            data-testid="product-visual"
            className="overflow-hidden rounded-xl border border-[#30363d] bg-[#161b22]"
          >
            {/* 伪工具栏 */}
            <div className="flex items-center gap-2 border-b border-[#30363d] bg-[#0d1117] px-4 py-2">
              <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
              <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
              <span className="h-3 w-3 rounded-full bg-[#28c840]" />
              <span className="ml-3 text-xs text-[#8b949e]">MD-Bundle 编辑器</span>
            </div>
            {/* 编辑区模拟 */}
            <div className="flex h-64 sm:h-80">
              {/* 左侧行号 */}
              <div className="hidden w-10 border-r border-[#30363d] bg-[#0d1117] py-4 text-right text-xs leading-6 text-[#484f58] sm:block">
                <div>1</div><div>2</div><div>3</div><div>4</div><div>5</div>
                <div>6</div><div>7</div><div>8</div><div>9</div><div>10</div>
                <div>11</div><div>12</div><div>13</div>
              </div>
              {/* 内容区 */}
              <div className="flex-1 overflow-hidden p-4 font-mono text-sm leading-6">
                <div className="text-2xl font-bold text-white"># MD-Bundle 使用指南</div>
                <div className="mt-3 text-[#8b949e]">MD-Bundle 是一个 <span className="text-[#7ee787]">Markdown</span> 自包含工具。</div>
                <div className="mt-2 text-[#8b949e]">支持 <span className="text-[#d2a8ff]">图片打包</span>、<span className="text-[#d2a8ff]">公式渲染</span>、流程图。</div>
                <div className="mt-3 text-[#8b949e]">## 核心功能</div>
                <div className="mt-2 pl-4 text-[#8b949e]">- 打开 <span className="text-[#7ee787]">.md</span> 文件编辑</div>
                <div className="pl-4 text-[#8b949e]">- 导入图片 → 保存为 <span className="text-[#7ee787]">.mdpkg</span></div>
                <div className="pl-4 text-[#8b949e]">- 导出 HTML / PNG 长图</div>
                <div className="mt-3 rounded-lg border border-[#30363d] bg-[#0d1117] p-3 text-[#d29922]">
                  💡 提示：拖拽图片到编辑器即可快速导入
                </div>
                <div className="mt-3 text-[#8b949e]">&gt; 引用：一个文件，带走全部图文。</div>
                <div className="mt-2 h-4 w-2 bg-white/80 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 双 CTA ── */}
      <section className="bg-[#0d1117]">
        <div className="mx-auto max-w-6xl px-6 pb-12 text-center">
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button
              type="button"
              data-testid="cta-primary"
              onClick={handleOpenClick}
              className="rounded-lg bg-[#165DFF] px-8 py-3 text-base font-medium text-white transition-colors hover:bg-[#3c7dff]"
            >
              立即打开文档
            </button>
            <button
              type="button"
              data-testid="cta-secondary"
              onClick={scrollToExamples}
              className="rounded-lg border border-[#30363d] bg-[#161b22] px-8 py-3 text-base font-medium text-[#8b949e] transition-colors hover:border-[#165DFF] hover:text-white"
            >
              看示例
            </button>
          </div>
        </div>
      </section>

      {/* ── 三价值徽标 ── */}
      <section className="border-t border-[#30363d] bg-[#161b22]">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div data-testid="value-badges" className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {VALUE_BADGES.map((badge, i) => (
              <div
                key={badge.label}
                data-testid={`value-badge-${i}`}
                className="rounded-xl border border-[#30363d] bg-[#0d1117] p-6 text-center transition-colors hover:border-[#165DFF]/50"
              >
                <span className="text-3xl" aria-hidden>{badge.icon}</span>
                <h3 className="mt-3 text-base font-semibold text-white">{badge.label}</h3>
                <p className="mt-1 text-sm text-[#8b949e]">{badge.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 精选作品 ── */}
      <section
        data-testid="featured-section"
        className="border-t border-[#30363d] bg-[#0d1117]"
      >
        <div className="mx-auto max-w-6xl px-6 py-14">
          <h2 className="text-xl font-bold tracking-tight text-white">精选示例</h2>
          <p className="mt-2 text-sm text-[#8b949e]">点击卡片，一键载入编辑器体验新能力。</p>

          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURED_EXAMPLES.map((ex, i) => (
              <button
                key={ex.id}
                type="button"
                data-testid={`featured-card-${i + 1}`}
                onClick={() => onOpenExample(ex)}
                className="group overflow-hidden rounded-xl border border-[#30363d] bg-[#161b22] text-left transition-all hover:border-[#165DFF] hover:shadow-lg hover:shadow-[#165DFF]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#165DFF]"
              >
                {/* 真渲染缩略 */}
                <CardThumbnail content={ex.content} />

                <div className="p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-100 group-hover:text-white">
                      {ex.title}
                    </span>
                    <span className="rounded bg-[#165DFF]/20 px-1.5 py-0.5 text-xs text-[#58a6ff]">
                      .{ex.format}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-[#8b949e] line-clamp-2">
                    {ex.summary}
                  </p>
                  <span className="mt-3 inline-block text-xs text-[#58a6ff] opacity-0 transition-opacity group-hover:opacity-100">
                    打开编辑器 →
                  </span>
                </div>

                {/* 悬浮打开按钮 */}
                <div
                  data-testid="card-open-btn"
                  className="absolute inset-0 flex items-center justify-center bg-[#0d1117]/60 opacity-0 transition-opacity group-hover:opacity-100"
                  aria-hidden="true"
                >
                  <span className="rounded-lg bg-[#165DFF] px-4 py-2 text-sm font-medium text-white">
                    打开
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── 最近文档占位（Wave 4 填充） ── */}
      {/* 4.4 接线时填充此 section，当前隐藏 */}

      {/* ── 页脚 ── */}
      <footer id="about" className="border-t border-[#30363d] bg-[#161b22]">
        <div className="mx-auto max-w-6xl px-6 py-8 text-center text-sm text-[#8b949e]">
          <p>
            MD-Bundle（本兜）· 纯前端 Markdown 工具 ·{' '}
            <a
              href="https://github.com/jianxi-dev/md-bundle"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#58a6ff] hover:underline"
            >
              GitHub
            </a>{' '}
            · MIT License
          </p>
          <p className="mt-2 text-xs text-[#484f58]">
            文件不离开浏览器 · 纯本地运行 · 零上传
          </p>
        </div>
      </footer>
    </>
  );
}
