// 落地页（任务 2.6）：替代 Hero + Gallery 组合，提供完整的 Landing 全页体验。
// 结构（设计稿 md-bundle-UI-FIRST.html）：细导航（site-nav）→ hero（品牌位 + 双行 slogan
// + 格式标注行 + 双 CTA + 三价值徽标）→ 产品主视觉（app 窗口复刻）→ 三项价值（feature 卡）
// → 引语 → 精选作品（featured 卡）→ 最近文档 → 页脚。
// 邀请变体（任务 26）：?ref=invite&by=<昵称> → InviteView（昵称视觉主角 + CTA 预载演示）。
// 视觉方向：本兜品牌 —— near-black 画布 var(--bg) + 靛青 var(--accent) 单色相。
import { useMemo } from 'react'
import { renderMarkdown } from '@md-bundle/renderer'
import { FEATURED_EXAMPLES } from '../examples'
import { parseInviteParams, INVITE_SITE_URL, INVITE_VALUE_POINTS } from '../lib/shareLink'

export interface RecentDocItem {
  name: string
  kind: 'md' | 'mdpkg'
  source: string
  mode: 'edit' | 'source' | 'preview'
  scrollPos: number
  diskHandle?: FileSystemFileHandle
  closedAt: number
}

export interface LandingProps {
  /** 打开示例（精选卡片点击 → 载入编辑器）。 */
  onOpenExample: (example: { id: string; content: string; format: 'md' | 'mdpkg' }) => void
  /** 最近关闭的文档（可选，空数组或不传 → 隐藏 section）。 */
  recentDocs?: RecentDocItem[]
  /** 恢复最近文档。 */
  onOpenRecentDoc?: (doc: RecentDocItem) => void
}

// ── 品牌 SVG 图标（无 emoji 即图标）────────────────────────────
/** 本兜品牌标记：竹筐 + 提手（与设计稿同源）。 */
function BrandMark({ size = 14 }: { size?: number }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size}>
      <path d="M5 8l1.5 11a2 2 0 0 0 2 1.8h7a2 2 0 0 0 2-1.8L19 8" />
      <path d="M5 8h14" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </svg>
  )
}

/** 对勾（格式标注行 / hint 徽标）。 */
function CheckIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

/** 三项价值图标。 */
const VALUE_ICONS = {
  local: (
    <svg viewBox="0 0 24 24">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  ),
  pack: (
    <svg viewBox="0 0 24 24">
      <path d="M3 7l9-4 9 4v10l-9 4-9-4V7z" />
      <path d="M3 7l9 4 9-4M12 11v10" />
    </svg>
  ),
  share: (
    <svg viewBox="0 0 24 24">
      <path d="M12 16V4m0 0l-4 4m4-4l4 4" />
      <path d="M4 14v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" />
    </svg>
  ),
} as const

/** 价值徽标数据（图标用 SVG，非 emoji）。 */
const VALUE_BADGES = [
  { icon: VALUE_ICONS.local, label: '纯本地零上传', desc: '文件不离开浏览器' },
  { icon: VALUE_ICONS.pack, label: '一键单文件', desc: '.mdpkg 图文打包' },
  { icon: VALUE_ICONS.share, label: '复制即分享', desc: '一个文件带走全部' },
]

/**
 * 卡片缩略渲染：截取内容前 600 字符做 renderMarkdown，max-height + overflow 裁切。
 * 禁注入风险内容——示例是自有源数据，仍走 renderMarkdown 消毒。
 */
function CardThumbnail({ content }: { content: string }): JSX.Element {
  const snippet = useMemo(() => {
    const truncated = content.length > 600 ? content.slice(0, 600) + '\n\n…' : content
    return renderMarkdown(truncated)
  }, [content])

  return (
    <div
      data-testid="card-thumbnail"
      className="pointer-events-none overflow-hidden rounded-t-xl bg-[var(--bg)]"
      style={{ maxHeight: 180 }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: snippet }}
    />
  )
}

/** 邀请视图卖点文案（与 VALUE_BADGES 同源，独立引用供 InviteView 使用）。 */
const INVITE_POINTS: ReadonlyArray<{ icon: string; label: string; desc: string }> =
  INVITE_VALUE_POINTS

/**
 * 邀请视图（任务 26）：落地页邀请变体。
 * 昵称为视觉主角（靛青渐变 blur-in）+ 卖点（pt 卡）+ 产品窗口快照 + CTA + 网址。
 */
function InviteView({
  nickname,
  onOpenDemo,
}: {
  nickname: string
  onOpenDemo: () => void
}): JSX.Element {
  return (
    <>
      {/* ── 邀请 Hero ── */}
      <section className="hero" style={{ padding: '88px 28px 72px' }}>
        <div className="grain"></div>
        <div className="inner">
          {/* 品牌位 */}
          <div className="hero-brand" style={{ marginBottom: 30 }}>
            <span className="hero-mark">
              <BrandMark size={20} />
            </span>
            <span className="hero-name">本兜</span>
          </div>

          {/* 昵称是视觉主角 */}
          <div
            data-testid="invite-badge"
            className="nick-stage"
            style={{ display: 'inline-block' }}
          >
            <span
              className="nick"
              style={{
                display: 'inline-block',
                fontSize: 'clamp(30px, 4.4vw, 40px)',
                fontWeight: 700,
                letterSpacing: '0.01em',
                background: 'var(--grad)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              @{nickname}
            </span>
          </div>

          <p className="invite-tag" style={{ marginTop: 22, fontSize: 17, color: 'var(--muted)' }}>
            邀请你来 <b style={{ color: 'var(--fg-2)', fontWeight: 600 }}>本兜</b> 一起玩
          </p>

          <h1
            data-testid="invite-hero"
            style={{
              fontSize: 'clamp(30px, 4.6vw, 46px)',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              margin: '18px 0 0',
              color: 'var(--fg)',
            }}
          >
            分享 Markdown，
            <br />
            文本与图片，一兜带走。
          </h1>

          <p
            className="sub"
            style={{ color: 'var(--muted)', fontSize: 16, margin: '14px auto 0', maxWidth: '46ch' }}
          >
            一个文件，带走全部图文。浏览器里打开就能用。
          </p>

          {/* 产品窗口快照 */}
          <div
            data-testid="invite-product-visual"
            className="invite-shot"
            style={{
              margin: '34px auto 0',
              maxWidth: 720,
              textAlign: 'left',
              border: '1px solid var(--border)',
              borderRadius: 14,
              overflow: 'hidden',
              background: 'var(--surface)',
              boxShadow: 'var(--shadow)',
            }}
          >
            <div
              className="shot-bar"
              style={{
                height: 46,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '0 12px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span
                className="mark"
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 6,
                  background: 'var(--grad)',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <BrandMark size={12} />
              </span>
              <span style={{ fontSize: 13, color: 'var(--fg-2)', fontWeight: 500 }}>
                图文打包示例.md
              </span>
            </div>
            <div
              className="shot-body"
              style={{
                padding: '18px 20px',
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 16,
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: 16, fontWeight: 650, color: 'var(--fg)' }}>
                  图文打包示例
                </div>
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: '6px 0' }}>
                  一段<strong style={{ color: 'var(--fg-2)' }}>加粗</strong>正文，图已活在编辑器里。
                </p>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontStyle: 'italic',
                    fontSize: 13.5,
                    color: 'var(--fg-2)',
                  }}
                >
                  x = ( −b ± √b²−4ac ) / 2a
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div
            className="invite-cta"
            style={{
              marginTop: 30,
              display: 'flex',
              gap: 12,
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              data-testid="invite-cta"
              onClick={onOpenDemo}
              className="btn primary"
            >
              打开本兜
            </button>
            <button type="button" className="btn ghost">
              看看能做什么
            </button>
          </div>

          <p
            data-testid="invite-site-url"
            className="invite-url"
            style={{
              marginTop: 18,
              fontFamily: 'var(--font-mono)',
              fontSize: 13.5,
              color: 'var(--accent)',
              letterSpacing: '0.02em',
            }}
          >
            {INVITE_SITE_URL}
          </p>

          {/* 卖点行 */}
          <div
            data-testid="invite-points"
            className="invite-points"
            style={{
              display: 'flex',
              gap: 12,
              justifyContent: 'center',
              marginTop: 30,
              flexWrap: 'wrap',
            }}
          >
            {INVITE_POINTS.map((point, i) => (
              <div key={point.label} data-testid={`invite-point-${i}`} className="pt">
                <b>{point.label}</b>
                {point.desc}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 页脚 ── */}
      <footer className="site-foot">
        <div>
          本兜 · 渐晰出品 · MD-Bundle ·{' '}
          <a
            href="https://github.com/jianxi-dev/md-bundle"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent)] hover:underline"
          >
            GitHub
          </a>{' '}
          · MIT License
        </div>
        <div className="mono" style={{ marginTop: 6 }}>
          {INVITE_SITE_URL}
        </div>
      </footer>
    </>
  )
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)} 天前`
  return new Date(ts).toLocaleDateString('zh-CN')
}

function RecentDocsSection({
  docs,
  onOpenDoc,
}: {
  docs: RecentDocItem[]
  onOpenDoc: (doc: RecentDocItem) => void
}): JSX.Element {
  return (
    <section
      data-testid="recent-docs-section"
      className="section"
      style={{ borderTop: '1px solid var(--border-soft)' }}
    >
      <div className="wrap">
        <h2 style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--fg)' }}>
          最近文档
        </h2>
        <p style={{ marginTop: 12, color: 'var(--muted)', fontSize: 15 }}>
          上次关闭的文档，快速恢复。
        </p>

        {docs.length === 0 ? (
          <p style={{ marginTop: 24, textAlign: 'center', color: 'var(--meta)', fontSize: 14 }}>
            暂无最近文档
          </p>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {docs.map((doc, i) => {
              if (!doc || typeof doc.name !== 'string' || !doc.kind || !doc.source) return null
              return (
                <button
                  key={`${doc.closedAt}-${i}`}
                  type="button"
                  data-testid={`recent-doc-item-${i}`}
                  onClick={() => onOpenDoc(doc)}
                  className="group overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] text-left transition-all hover:border-[var(--accent)] hover:shadow-lg hover:shadow-[var(--accent)]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                >
                  <div className="flex items-start justify-between gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-[var(--fg-2)] group-hover:text-[var(--fg)]">
                          {doc.name}
                        </span>
                        <span className="shrink-0 rounded bg-[var(--accent)]/20 px-1.5 py-0.5 text-xs text-[var(--accent-bright)]">
                          .{doc.kind}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[var(--meta)]">
                        {formatRelativeTime(doc.closedAt)}
                      </p>
                    </div>
                    <span className="shrink-0 rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] uppercase text-[var(--muted)]">
                      {doc.mode === 'source' ? '源码' : doc.mode === 'preview' ? '预览' : '编辑'}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

export function Landing({
  onOpenExample,
  recentDocs = [],
  onOpenRecentDoc,
}: LandingProps): JSX.Element {
  /** 触发文件选择器。 */
  const handleOpenClick = () => {
    const input = document.querySelector<HTMLInputElement>('[data-testid="file-input"]')
    input?.click()
  }

  /** 滚动到精选作品区域。 */
  const scrollToExamples = () => {
    document
      .querySelector('[data-testid="featured-section"]')
      ?.scrollIntoView({ behavior: 'smooth' })
  }

  /** 邀请链接：预载第一个演示文档进编辑器。 */
  const handleOpenDemo = () => {
    const demo = FEATURED_EXAMPLES[0]
    onOpenExample(demo)
  }

  // 检测邀请链接（ref=invite + 有效 by 参数）→ 渲染 InviteView
  const invite = parseInviteParams()
  if (invite) {
    return <InviteView nickname={invite.by} onOpenDemo={handleOpenDemo} />
  }

  return (
    <>
      {/* ── 细导航 ── */}
      <nav data-testid="landing-nav" className="site-nav">
        <div className="site-nav-inner">
          <div className="brand">
            <span className="mark">
              <BrandMark />
            </span>
            <span>本兜</span>
            <span className="sub">MD-Bundle</span>
          </div>
          <nav>
            <a href="#format-info">格式说明</a>
            <a href="#about">关于</a>
          </nav>
          <div className="right">
            <a
              href="https://github.com/jianxi-dev/md-bundle"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
            >
              GitHub
            </a>
            <button
              type="button"
              className="btn primary nav-cta"
              onClick={handleOpenClick}
              data-testid="nav-open-btn"
            >
              打开本兜
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero：品牌位 + 双行 slogan + 格式标注行 + 双 CTA + 三价值徽标 ── */}
      <section className="hero" id="hero">
        <div className="grain"></div>
        <div className="inner">
          {/* 品牌位 */}
          <div className="hero-brand">
            <span className="hero-mark">
              <BrandMark size={20} />
            </span>
            <span className="hero-name">本兜</span>
          </div>

          <h1 data-testid="hero-slogan">
            分享 Markdown，
            <br />
            文本与图片，一兜带走。
          </h1>

          <p className="lead">
            一个文件，装走全部图文。<b>本地运行，即开即用</b>，隐私不出设备。
          </p>

          {/* 格式范围标注行 */}
          <div
            id="format-info"
            data-testid="format-line"
            style={{
              marginTop: 26,
              fontFamily: 'var(--font-mono)',
              fontSize: 12.5,
              color: 'var(--meta)',
              display: 'flex',
              gap: 18,
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <span
                style={{
                  width: 14,
                  height: 14,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--success)',
                }}
              >
                <CheckIcon />
              </span>
              <span className="font-mono font-bold">.md</span> 打开编辑
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <span
                style={{
                  width: 14,
                  height: 14,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--success)',
                }}
              >
                <CheckIcon />
              </span>
              <span className="font-mono font-bold">.mdpkg</span> 一键打包
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <span
                style={{
                  width: 14,
                  height: 14,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--success)',
                }}
              >
                <CheckIcon />
              </span>
              导出 <span className="font-mono font-bold">md · Word · HTML · PNG</span> 长图
            </span>
          </div>

          {/* 双 CTA */}
          <div className="hero-cta">
            <button
              type="button"
              data-testid="cta-primary"
              onClick={handleOpenClick}
              className="btn primary"
            >
              立即打开文档
            </button>
            <button
              type="button"
              data-testid="cta-secondary"
              onClick={scrollToExamples}
              className="btn ghost"
            >
              看示例
            </button>
          </div>

          {/* 三价值徽标 */}
          <div className="hint">
            <span>
              <span
                style={{
                  width: 14,
                  height: 14,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--success)',
                }}
              >
                <CheckIcon />
              </span>
              无需安装
            </span>
            <span>
              <span
                style={{
                  width: 14,
                  height: 14,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--success)',
                }}
              >
                <CheckIcon />
              </span>
              零上传
            </span>
            <span>
              <span
                style={{
                  width: 14,
                  height: 14,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--success)',
                }}
              >
                <CheckIcon />
              </span>
              MIT 开源
            </span>
          </div>
        </div>
      </section>

      {/* ── 产品主视觉（app 窗口复刻） ── */}
      <section className="section" style={{ paddingTop: 40 }}>
        <div className="wrap">
          <div data-testid="product-visual" className="app">
            {/* 伪工具栏 */}
            <div className="topbar">
              <div className="left">
                <span className="mark" style={{ width: 22, height: 22 }}>
                  <BrandMark size={14} />
                </span>
                <span style={{ fontSize: 14, fontWeight: 650, color: 'var(--fg)' }}>本兜</span>
              </div>
              <span className="ml-auto" style={{ fontSize: 12.5, color: 'var(--meta)' }}>
                MD-Bundle 编辑器
              </span>
            </div>
            {/* 编辑区模拟 */}
            <div className="flex h-64 sm:h-80">
              <div className="hidden w-10 border-r border-[var(--border)] bg-[var(--surface)] py-4 text-right text-xs leading-6 text-[var(--meta)] sm:block">
                <div>1</div>
                <div>2</div>
                <div>3</div>
                <div>4</div>
                <div>5</div>
                <div>6</div>
                <div>7</div>
                <div>8</div>
                <div>9</div>
                <div>10</div>
                <div>11</div>
                <div>12</div>
                <div>13</div>
              </div>
              <div className="flex-1 overflow-hidden p-4 font-mono text-sm leading-6">
                <div className="text-2xl font-bold text-[var(--fg)]"># MD-Bundle 使用指南</div>
                <div className="mt-3 text-[var(--muted)]">
                  MD-Bundle 是一个 <span className="text-[var(--accent-bright)]">Markdown</span>{' '}
                  自包含工具。
                </div>
                <div className="mt-2 text-[var(--muted)]">
                  支持 <span className="text-[var(--accent)]">图片打包</span>、
                  <span className="text-[var(--accent)]">公式渲染</span>、流程图。
                </div>
                <div className="mt-3 text-[var(--fg-2)]">## 核心功能</div>
                <div className="mt-2 pl-4 text-[var(--muted)]">
                  - 打开 <span className="text-[var(--accent-bright)]">.md</span> 文件编辑
                </div>
                <div className="pl-4 text-[var(--muted)]">
                  - 导入图片 → 保存为 <span className="text-[var(--accent-bright)]">.mdpkg</span>
                </div>
                <div className="pl-4 text-[var(--muted)]">- 导出 HTML / PNG 长图</div>
                <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 text-[var(--warn)]">
                  💡 提示：拖拽图片到编辑器即可快速导入
                </div>
                <div className="mt-3 text-[var(--muted)]">&gt; 引用：一个文件，带走全部图文。</div>
                <div className="mt-2 h-4 w-2 bg-[var(--fg)]/80 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 三项价值 ── */}
      <section className="section features" id="features">
        <div className="wrap">
          <div className="sec-head" style={{ maxWidth: 640, marginBottom: 48 }}>
            <p className="eyebrow">为什么是它</p>
            <h2>三件事，上手十分钟就懂。</h2>
            <p className="desc" style={{ color: 'var(--muted)', fontSize: 15, marginTop: 12 }}>
              不做云同步、不做账号体系，只把「分享 Markdown」这一件事做透。
            </p>
          </div>
          <div data-testid="value-badges" className="grid-3">
            {VALUE_BADGES.map((badge, i) => (
              <div key={badge.label} data-testid={`value-badge-${i}`} className="feature">
                <div className="feature-mark">{badge.icon}</div>
                <h3>{badge.label}</h3>
                <p>{badge.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 精选作品 ── */}
      <section
        data-testid="featured-section"
        className="section"
        id="featured"
        style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 64 }}
      >
        <div className="wrap">
          <div className="sec-head" style={{ maxWidth: 640, marginBottom: 36 }}>
            <p className="eyebrow">精选示例</p>
            <h2>点开看看它能做什么。</h2>
            <p className="desc" style={{ color: 'var(--muted)', fontSize: 15, marginTop: 12 }}>
              点击卡片，一键载入编辑器体验新能力。
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURED_EXAMPLES.map((ex, i) => (
              <button
                key={ex.id}
                type="button"
                data-testid={`featured-card-${i + 1}`}
                onClick={() => onOpenExample(ex)}
                className="group relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] text-left transition-all hover:border-[var(--accent)] hover:shadow-lg hover:shadow-[var(--accent)]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                {/* 真渲染缩略 */}
                <CardThumbnail content={ex.content} />

                <div className="p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--fg-2)] group-hover:text-[var(--fg)]">
                      {ex.title}
                    </span>
                    <span className="rounded bg-[var(--accent)]/20 px-1.5 py-0.5 text-xs text-[var(--accent-bright)]">
                      .{ex.format}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--muted)] line-clamp-2">
                    {ex.summary}
                  </p>
                  <span className="mt-3 inline-block text-xs text-[var(--accent-bright)] opacity-0 transition-opacity group-hover:opacity-100">
                    打开编辑器 →
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── 最近文档 ── */}
      {recentDocs.length > 0 && onOpenRecentDoc && (
        <RecentDocsSection docs={recentDocs} onOpenDoc={onOpenRecentDoc} />
      )}

      {/* ── 页脚 ── */}
      <footer id="about" className="site-foot">
        <div>
          本兜 · 渐晰出品 · MD-Bundle ·{' '}
          <a
            href="https://github.com/jianxi-dev/md-bundle"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent)] hover:underline"
          >
            GitHub
          </a>{' '}
          · MIT License
        </div>
        <div className="mono" style={{ marginTop: 6 }}>
          bundle.jianxi.me
        </div>
        <p style={{ marginTop: 8, fontSize: '12px', color: 'var(--meta)' }}>
          文件不离开浏览器 · 纯本地运行 · 零上传
        </p>
      </footer>
    </>
  )
}
