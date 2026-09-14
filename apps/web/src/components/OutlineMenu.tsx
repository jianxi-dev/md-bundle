// 大纲浮层（任务 2.4）—— 工作区内容面板右上角 ghost 图标触发。
// hover 弹出毛玻璃浮层、click 钉住、Esc 收起。
// 标题解析 code-fence aware：编辑/源码模式从 markdown 文本解析；预览模式从 DOM h1–h6 解析。
// 点击标题只导航（scrollIntoView）；不做折叠/块拖拽。
// 键盘可达：Tab 进按钮、Enter 钉住、Esc 收起、列表项可 Tab/Enter 导航。
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { extractHeadings, type OutlineHeading } from '../lib/outline'
import type { EditorMode } from './Toolbar'

/**
 * CM6 视图最小接口 —— 避免直接 import @codemirror/view（apps/web 无该依赖）。
 * 只声明本组件使用的属性：doc 字符串 + viewport 范围 + focus + 滚动定位。
 */
interface CM6ViewLike {
  state: {
    doc: {
      toString(): string
      lines: number
      length: number
      line(n: number): { from: number }
    }
  }
  viewport: { from: number; to: number }
  focus(): void
  /** CM6 的滚动容器（EditorView.scrollDOM），设置 scrollTop 即可滚动。 */
  scrollDOM: HTMLElement
  /**
   * 返回指定字符偏移处的行块几何信息（相对于文档顶部）。
   * 用 lineBlockAt 获取精确像素坐标后设置 scrollDOM.scrollTop，
   * 避免 nth-child 索引 ≠ 文档行号的问题（CM6 仅渲染视口附近的行）。
   */
  lineBlockAt(pos: number): { top: number; bottom: number }
}

export interface OutlineMenuProps {
  /** 当前编辑模式。 */
  mode: EditorMode
  /** markdown 文本（编辑/源码模式用于文本解析）。 */
  documentText: string
  /** CM6 EditorView 实例（编辑/源码模式用于 scrollIntoView）。编辑/源码模式必传。 */
  editorView: CM6ViewLike | null
  /** 预览面板 DOM ref（预览模式用于 scrollIntoView）。 */
  previewRef: React.RefObject<HTMLDivElement | null>
}

/**
 * 从预览 DOM 中提取标题（h1–h6）。
 * 返回与 extractHeadings 相同的形状，line 字段为 -1（DOM 模式无行号）。
 */
function extractHeadingsFromDom(container: HTMLElement): OutlineHeading[] {
  const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6')
  const result: OutlineHeading[] = []
  headings.forEach((el) => {
    const level = parseInt(el.tagName[1], 10)
    result.push({
      level,
      text: el.textContent?.trim() ?? '',
      line: -1, // DOM 模式无行号
      // 存储 DOM 元素引用供 scrollIntoView 使用
      _domEl: el,
    } as OutlineHeading & { _domEl: HTMLElement })
  })
  return result
}

/**
 * 是否具备 hover 能力（桌面指针设备）。
 * 触屏设备 `(hover: none)`：tap 会合成 mouseenter/mouseover，若启用 hover 分支会让浮层
 * 卡在 hover 残留态；因此无 hover 设备退化为纯 pinned 交互（点图标弹出、点外部/再点收起）。
 * jsdom 等无 matchMedia 的环境视为具备 hover，保持既有桌面行为。
 */
function detectHoverCapable(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  return !window.matchMedia('(hover: none)').matches
}

/**
 * 计算 CM6 中某行的字符偏移量（用于 scrollIntoView）。
 * 行号从 0 开始。
 */
function offsetAtLine(view: CM6ViewLike, line: number): number {
  const doc = view.state.doc
  if (line >= doc.lines) return doc.length
  return doc.line(line + 1).from
}

/**
 * 滚动 CM6 编辑器到指定行（0-based）。
 * 用 view.lineBlockAt 获取精确像素坐标后设置 scrollDOM.scrollTop，
 * 避免 nth-child 索引 ≠ 文档行号的问题（CM6 仅渲染视口附近的行）。
 */
function scrollToLineInCM6(view: CM6ViewLike, line: number): void {
  const doc = view.state.doc
  if (line >= doc.lines) return
  // 目标行的字符偏移（doc.line 是 1-based）
  const pos = doc.line(line + 1).from

  try {
    const block = view.lineBlockAt(pos)
    view.scrollDOM.scrollTop = block.top
  } catch {
    // jsdom 无布局 → 忽略
  }
}

/**
 * 找到当前视口中最顶部可见的标题索引。
 * 编辑/源码模式：CM6 viewport；预览模式：DOM 可见区域。
 * @param documentText 当前文档文本；用于在共享 CM6 view 场景下检测 doc 是否已同步。
 */
function findCurrentHeadingIndex(
  headings: OutlineHeading[],
  mode: EditorMode,
  editorView: CM6ViewLike | null,
  previewEl: HTMLElement | null,
  documentText: string,
): number {
  if (headings.length === 0) return -1

  if ((mode === 'edit' || mode === 'source') && editorView) {
    // 页签切换后首帧：共享 CM6 view 的 doc 可能仍是旧文档。
    // 用 doc.length 作廉价代理：长度不同 → 文档不同 → viewport 不可信，返回 -1 不高亮。
    // 权衡：极罕见情况下两篇不同文档长度恰好相同会漏检，但此时 viewport 范围
    // 通常仍在合理区间，不会产生可见的错误高亮。
    if (editorView.state.doc.length !== documentText.length) return -1
    // CM6 viewport：找到 viewport 中最顶部的标题
    const vp = editorView.viewport
    for (let i = headings.length - 1; i >= 0; i--) {
      const h = headings[i]
      const pos = offsetAtLine(editorView, h.line)
      if (pos >= vp.from) return i
    }
    return 0
  }

  if (mode === 'preview' && previewEl) {
    // DOM 模式：找到最接近视口顶部的标题
    const containerRect = previewEl.getBoundingClientRect()
    for (let i = 0; i < headings.length; i++) {
      const h = headings[i] as OutlineHeading & { _domEl?: HTMLElement }
      if (h._domEl) {
        const rect = h._domEl.getBoundingClientRect()
        if (rect.top >= containerRect.top - 10) return i
      }
    }
    return headings.length - 1
  }

  return 0
}

export function OutlineMenu({
  mode,
  documentText,
  editorView,
  previewRef,
}: OutlineMenuProps): JSX.Element {
  const [pinned, setPinned] = useState(false)
  const [hovering, setHovering] = useState(false)
  // 无 hover 能力（触屏）时不做 hover 分支检测，避免 tap 合成事件把浮层卡住。
  const [hoverCapable] = useState(detectHoverCapable)
  const [activeIndex, setActiveIndex] = useState(-1)
  const menuRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  const visible = pinned || hovering

  // 预览模式 DOM 标题：在 useLayoutEffect 中读取，避免渲染阶段读到旧页签的 DOM。
  // PreviewView 通过 dangerouslySetInnerHTML 在 commit 阶段更新 DOM；渲染阶段
  // previewRef.current 仍持有上一文档的 HTML，若此时提取会得到串扰的大纲。
  // useLayoutEffect 保证在 React 完成所有 DOM 变更后执行，此时读取的是当前文档的 DOM。
  const [domHeadings, setDomHeadings] = useState<OutlineHeading[]>([])
  useLayoutEffect(() => {
    if (mode === 'preview' && previewRef?.current) {
      setDomHeadings(extractHeadingsFromDom(previewRef.current))
    }
  }, [mode, documentText, previewRef])

  // 根据模式解析标题
  const headings: OutlineHeading[] = useMemo(() => {
    if (mode === 'preview' && previewRef?.current) {
      return domHeadings
    }
    return extractHeadings(documentText)
  }, [mode, documentText, previewRef?.current, domHeadings])

  // 当前高亮标题（仅用于视觉指示，不做精确实时追踪）
  const currentIndex = useMemo(
    () =>
      findCurrentHeadingIndex(
        headings,
        mode,
        editorView,
        previewRef?.current ?? null,
        documentText,
      ),
    [headings, mode, editorView, previewRef?.current, documentText],
  )

  // 点击标题导航
  const scrollToHeading = useCallback(
    (h: OutlineHeading) => {
      if ((mode === 'edit' || mode === 'source') && editorView) {
        scrollToLineInCM6(editorView, h.line)
        editorView.focus()
      } else if (mode === 'preview' && previewRef?.current) {
        const domH = h as OutlineHeading & { _domEl?: HTMLElement }
        if (domH._domEl) {
          domH._domEl.scrollIntoView({ behavior: 'instant', block: 'start' })
        }
      }
    },
    [mode, editorView, previewRef],
  )

  // Esc 收起
  useEffect(() => {
    if (!visible) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPinned(false)
        setHovering(false)
        btnRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [visible])

  // 点击外部收起（hover 与 pinned 通用）：pointerdown 同时覆盖鼠标与触屏。
  // 触发钮自身不在此关闭，交由 onClick 的 toggle 处理，避免 pointerdown 先关、click 再开。
  useEffect(() => {
    if (!hovering && !pinned) return
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (menuRef.current?.contains(target) || btnRef.current?.contains(target)) return
      setHovering(false)
      setPinned(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [hovering, pinned])

  // 切换文档或模式时重置 activeIndex，防止高亮跨页签泄漏（#73）。
  useEffect(() => {
    setActiveIndex(-1)
  }, [documentText, mode])

  // 高亮：点击后锁定 activeIndex，否则跟随滚动位置（currentIndex）。
  const highlightedIndex = activeIndex >= 0 ? activeIndex : currentIndex

  return (
    <div
      data-testid="outline-wrap"
      className="absolute right-2 top-2 z-10 before:absolute before:left-0 before:right-0 before:top-full before:h-2 before:content-['']"
      onMouseEnter={() => {
        if (hoverCapable) setHovering(true)
      }}
      onMouseLeave={() => {
        if (hoverCapable && !pinned) setHovering(false)
      }}
    >
      {/* 触发钮 —— ghost 风格 */}
      <button
        ref={btnRef}
        type="button"
        data-testid="outline-btn"
        aria-label="大纲"
        title="大纲"
        aria-expanded={visible}
        onClick={() => setPinned((p) => !p)}
        className="rounded p-1.5 text-sm text-slate-400 opacity-60 transition-colors hover:text-slate-200 hover:opacity-100"
      >
        ☰
      </button>

      {/* 毛玻璃浮层 */}
      {visible && (
        <div
          ref={menuRef}
          data-testid="outline-menu"
          role="menu"
          aria-label="文档大纲"
          className="absolute right-0 top-full mt-1 max-h-[min(50vh,420px)] w-60 overflow-auto rounded-lg border border-[var(--border)]/60 bg-[var(--surface)]/85 shadow-2xl backdrop-blur-xl"
        >
          <div className="hd flex items-center justify-between px-3 pb-1.5 pt-2.5">
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10.5px',
                color: 'var(--meta)',
                letterSpacing: '0.05em',
              }}
            >
              文档大纲
            </span>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '10px',
                color: 'var(--meta)',
                opacity: 0.8,
              }}
            >
              点击图标钉住
            </span>
          </div>
          {headings.length === 0 ? (
            <p className="px-3 py-2 text-xs text-[var(--muted)]">无标题</p>
          ) : (
            <ul className="py-1" role="list">
              {headings.map((h, i) => (
                <li key={`${h.line}-${h.text}`} data-testid={`outline-item-${i}`}>
                  <button
                    type="button"
                    role="menuitem"
                    {...(i === highlightedIndex ? { 'data-testid': 'outline-current' } : {})}
                    tabIndex={0}
                    onClick={() => {
                      setActiveIndex(i)
                      scrollToHeading(h)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setActiveIndex(i)
                        scrollToHeading(h)
                      }
                    }}
                    className={`flex w-full items-center gap-2 py-1.5 text-left text-xs transition-colors ${
                      i === highlightedIndex
                        ? 'border-l-2 border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--fg)]'
                        : 'border-l-2 border-transparent text-[var(--muted)] hover:bg-[var(--surface-3)] hover:text-[var(--fg)]'
                    }`}
                    style={{ paddingLeft: `${(h.level - 1) * 12 + 8}px` }}
                  >
                    {/* 层级竖线指示 */}
                    <span
                      className="inline-block h-3 w-0.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          i === highlightedIndex
                            ? 'var(--accent)'
                            : `rgba(139,148,158,${0.2 + h.level * 0.1})`,
                      }}
                    />
                    <span className="truncate">{h.text}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
