// MD-Bundle 应用外壳（任务 4.1：多页签文档模型）。
// 状态机：tabs state（tabs[] + activeId）→ empty | md | mdpkg。
// 打开文件 = 新增页签（永不静默替换）；关闭唯一页签 → 回 empty。
// 图片导入/保存/导出作用于 activeTab；各 tab 内容独立。
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  MarkdownEditor,
  slashKeymap,
  editorDecorations,
  type MarkdownEditorHandle,
} from '@md-bundle/editor'
import { PreviewView } from './components/PreviewView'
import { FileOpen } from './components/FileOpen'
import { Landing } from './components/Landing'
import { LeftRail } from './components/LeftRail'
import { OutlineMenu } from './components/OutlineMenu'
import { Toolbar, type ExportFormat, type EditorMode } from './components/Toolbar'
import { TabStrip } from './components/TabStrip'
import { BadgeToast } from './components/BadgeToast'
import { ValidationPanel } from './components/ValidationPanel'
import { useBadges, wireBadgeEvents } from './lib/useBadges'
import { openFile } from './lib/openFile'
import { readEntrySource } from './lib/mdpkg'
import { saveDocument, type SaveResult } from './lib/save'
import { exportMdpkg, ENTRY_FILENAME } from './lib/exportMdpkg'
import { WARNING_EXPORT_MD } from './lib/export'
import { exportDocx } from './lib/exportDocx'
import { toZip, toMarkdown } from '../vendor/mdpkg-web.js'
import { buildHtmlDocument } from './lib/exportHtml'
import { exportPngFromMarkdown } from './lib/exportPng'
import { downloadBlob, downloadText } from './lib/download'
import { shareCardSvg, cardToPngBlob, copyToClipboard } from './lib/shareCard'
import {
  loadThemePreference,
  saveThemePreference,
  applyThemeToDocument,
  resolveEffectiveTheme,
  watchSystemTheme,
  type ThemePreference,
} from './lib/themePreference'
import { createInviteLink } from './lib/shareLink'
import { exitFullscreenOnEscape, didJustExitFullscreen } from './lib/fullscreen'
import { pickTemplate } from './lib/inviteShareCards'
import { bytesToDataUrl, dataUrlToBytes } from './lib/dataUrl'
import {
  MAX_ASSET_BYTES,
  addAssets,
  findReference,
  removeAsset,
  replaceAsset,
  resolveAssetDataUrl,
  stripReferences,
  wireReferences,
  computeOrphans,
  type Asset,
} from './lib/assets'
import { filesToAssets, imagesFromClipboard, imagesFromDataTransfer } from './lib/importImages'
import {
  extractDocFromDirectory,
  extractDocFromZip,
  getDirectoryHandle,
} from './lib/dropFiles'
import { isFsaAvailable } from './lib/fsa'
import {
  createTabsState,
  addTab,
  removeTab,
  updateTab,
  setActiveTab,
  getActiveTab,
  type TabsState,
} from './lib/tabs'
import { saveSession, restoreSession, createRecentEntry, MAX_RECENT_DOCS } from './lib/sessionStore'
import type { RecentDocItem } from './components/Landing'

/** 包内图片条目路径（资产名 = 完整路径，inlineImages 按名精确查找）。 */
const IMAGE_PATH_RE = /\.(png|jpe?g|gif|webp)$/i
const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
}

/** 从 .mdpkg 解包结果构建资产清单：图片条目 → Asset（name = 路径，dataUrl 由原始字节生成）。 */
function assetsFromPackageFiles(files: Map<string, Uint8Array>): Asset[] {
  const assets: Asset[] = []
  for (const [path, bytes] of files) {
    if (!IMAGE_PATH_RE.test(path)) continue
    const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase()
    assets.push({
      name: path,
      size: bytes.length,
      dataUrl: bytesToDataUrl(bytes, MIME[ext] ?? 'image/png'),
    })
  }
  return assets
}

/** 文件名去扩展名（hello.md → hello；无扩展名原样返回）。 */
function baseName(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(0, dot) : name
}

/** 生成未命名文档名：优先「未命名.md」，冲突则「未命名 2.md」「未命名 3.md」…。 */
function nextUntitledName(existing: string[]): string {
  const used = new Set(existing)
  if (!used.has('未命名.md')) return '未命名.md'
  let i = 2
  while (used.has(`未命名 ${i}.md`)) i++
  return `未命名 ${i}.md`
}

// 斜杠命令扩展：模块级单例（编辑器只在挂载时读取 extensions —— 稳定引用避免任何重挂载顾虑）。
const SLASH_EXT = [slashKeymap()]

/** 窄屏检测 hook（<768px）：matchMedia 监听，响应式断点切换。 */
function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(max-width: 767px)').matches
  })
  useEffect(() => {
    if (!window.matchMedia) return
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = (e: MediaQueryListEvent) => setNarrow(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return narrow
}

// ── 左栏展开状态（受控，开关按钮在顶栏最左）──
const RAIL_STORAGE_KEY = 'md-bundle.left-rail'
function readRailOpen(): boolean {
  try {
    return localStorage.getItem(RAIL_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}
function writeRailOpen(v: boolean): void {
  try {
    localStorage.setItem(RAIL_STORAGE_KEY, String(v))
  } catch {
    // localStorage 不可用时静默忽略
  }
}

export default function App() {
  // ── 多页签状态（任务 4.1）──
  const [tabsState, setTabsState] = useState<TabsState>(createTabsState)
  const activeTab = getActiveTab(tabsState)

  const [mode, setMode] = useState<EditorMode>('edit')
  const [themePref, setThemePref] = useState<ThemePreference>(() => loadThemePreference())
  const isNarrow = useIsNarrow()
  const [importHint, setImportHint] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [docxWarning, setDocxWarning] = useState<string | null>(null)
  const [inviteCardStatus, setInviteCardStatus] = useState<string | null>(null)
  const assetsRef = useRef<Asset[]>([])
  const editorViewRef = useRef<MarkdownEditorHandle['view'] | null>(null)
  const [editorViewState, setEditorViewState] = useState<MarkdownEditorHandle['view'] | null>(null)
  const exportErrorTimer = useRef<number | null>(null)
  const docxWarningTimer = useRef<number | null>(null)
  const inviteCardTimer = useRef<number | null>(null)
  const workspaceRef = useRef<HTMLElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  const [railOpen, setRailOpen] = useState(readRailOpen)
  const toggleRail = () => {
    const next = !railOpen
    setRailOpen(next)
    writeRailOpen(next)
  }
  const hasOrphans = useMemo(
    () => (activeTab ? computeOrphans(activeTab.assets, activeTab.source).size > 0 : false),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeTab?.assets, activeTab?.source],
  )

  const resolveImageRef = useRef<((path: string) => string | null) | null>(null)
  const onImageReplaceRef = useRef<((path: string) => void) | null>(null)
  const onImageDeleteRef = useRef<((path: string) => void) | null>(null)
  const onImageLocateRef = useRef<((path: string) => void) | null>(null)

  // 徽章接线（6.4）
  const { badgeStore, toast, dismiss, showToastFor } = useBadges()
  const wire = useMemo(
    () =>
      wireBadgeEvents(badgeStore, {
        onSaveSuccess: (r) => showToastFor(r),
        onPngExportSuccess: (r) => showToastFor(r),
        onExportSuccess: (r) => showToastFor(r),
        onFileOpen: (r) => showToastFor(r),
      }),
    [badgeStore, showToastFor],
  )

  // 主题：初始化应用到 DOM + 监听系统主题变化
  useEffect(() => {
    applyThemeToDocument(resolveEffectiveTheme(themePref))
  }, [themePref])

  useEffect(() => {
    return watchSystemTheme(() => {
      if (themePref === 'system') {
        applyThemeToDocument(resolveEffectiveTheme('system'))
      }
    })
  }, [themePref])

  // 任务 13：ESC 退出全屏
  useEffect(() => {
    const handler = (e: KeyboardEvent) => exitFullscreenOnEscape(e)
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const handleThemeClick = () => {
    const next: ThemePreference =
      themePref === 'system' ? 'dark' : themePref === 'dark' ? 'light' : 'system'
    setThemePref(next)
    saveThemePreference(next)
    applyThemeToDocument(resolveEffectiveTheme(next))
  }

  const handleCopyInviteLink = async () => {
    const { url } = createInviteLink()
    try {
      await navigator.clipboard.writeText(url)
      showInviteCardStatus('邀请链接已复制')
    } catch {
      showInviteCardStatus('复制失败：剪贴板不可用')
    }
  }

  const showInviteCardStatus = (text: string) => {
    setInviteCardStatus(text)
    if (inviteCardTimer.current !== null) {
      window.clearTimeout(inviteCardTimer.current)
    }
    inviteCardTimer.current = window.setTimeout(() => setInviteCardStatus(null), 3500)
  }

  const handleGenerateInviteCard = async () => {
    try {
      const { nickname } = createInviteLink()
      const template = pickTemplate({ nickname, theme: resolveEffectiveTheme(themePref) })
      const svg = shareCardSvg(template.html, { width: template.width, height: template.height })
      const blob = await cardToPngBlob(svg, { background: '#08090b' })
      const copied = await copyToClipboard(blob)
      if (copied) {
        showInviteCardStatus('邀请卡已复制到剪贴板')
      } else {
        downloadBlob(blob, `invite-${template.type}.png`)
        showInviteCardStatus('邀请卡已下载')
      }
    } catch (e) {
      // 生成失败 → 可见错误提示（Bug 12：不再静默）
      showInviteCardStatus(e instanceof Error ? e.message : '邀请卡生成失败')
    }
  }

  // 装饰扩展——ref-stable callbacks
  const DECORATIONS_EXT = useMemo(
    () =>
      editorDecorations({
        resolveImage: (path: string) => resolveImageRef.current?.(path) ?? null,
        onImageReplace: (path: string) => onImageReplaceRef.current?.(path),
        onImageDelete: (path: string) => onImageDeleteRef.current?.(path),
        onImageLocate: (path: string) => onImageLocateRef.current?.(path),
      }),
    [],
  )

  // ── activeTab 变化时同步 assetsRef + mode ──
  useEffect(() => {
    if (activeTab) {
      assetsRef.current = activeTab.assets
      setMode(activeTab.mode)
      setImportHint(null)
      // 窄屏打开文档默认 preview 模式
      if (isNarrow) {
        setMode('preview')
        setTabsState((s) => {
          const tab = getActiveTab(s)
          if (tab) return updateTab(s, tab.id, { mode: 'preview' })
          return s
        })
      }
    }
  }, [activeTab?.id, isNarrow]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 预览模式 ESC 退出（非全屏 preview → edit；刚退出全屏时跳过）──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // exitFullscreenOnEscape（先注册）已同步设置标志 → 跳过模式切换
      if (didJustExitFullscreen()) return
      if (document.querySelector('[data-testid="outline-menu"]')) return
      setMode((m) => (m === 'preview' ? 'edit' : m))
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // ── 编辑器 onChange → 更新 activeTab.source ──
  const handleEditorChange = (value: string) => {
    if (!activeTab) return
    setTabsState((s) => updateTab(s, activeTab.id, { source: value, dirty: true }))
  }

  // ── 文件打开：解析 → 新增 tab ──
  // 使用 functional updater 避免快速拖入多个文件时的 stale closure 竞态
  const openFileObject = async (file: File, diskHandle?: FileSystemFileHandle) => {
    const outcome = await openFile(file)
    switch (outcome.kind) {
      case 'md': {
        setTabsState((prev) => {
          const r = addTab(prev, {
            kind: 'md',
            name: outcome.name,
            source: outcome.content,
            diskHandle,
          })
          return updateTab(r.state, r.tabId, { mode: 'preview' })
        })
        break
      }
      case 'mdpkg': {
        const pkg = outcome.result
        if ('files' in pkg && pkg.html !== null) {
          const packageAssets = assetsFromPackageFiles(pkg.files)
          setTabsState((prev) => {
            const r = addTab(prev, {
              kind: 'mdpkg',
              name: outcome.name,
              source: readEntrySource(pkg.files, pkg.manifest?.entrypoint),
              assets: packageAssets,
              mdpkgFiles: pkg.files,
              manifest: pkg.manifest,
              validation: pkg.validation,
              diskHandle,
            })
            return updateTab(r.state, r.tabId, { mode: 'preview' })
          })
        } else {
          const err = 'files' in pkg ? (pkg.error ?? '未知渲染错误') : pkg.error
          setTabsState((prev) => {
            const r = addTab(prev, {
              kind: 'md',
              name: '错误',
              source: `错误：${err}`,
              diskHandle,
            })
            return r.state
          })
        }
        break
      }
      case 'error': {
        setTabsState((prev) => {
          const r = addTab(prev, {
            kind: 'md',
            name: '错误',
            source: `错误：${outcome.message}`,
            diskHandle,
          })
          return r.state
        })
        break
      }
    }

    // 打开文档默认预览态（README v1：新页签进入 preview）；窄屏由 activeTab effect 同样保持 preview。

    // 平滑滚动到工作区
    const el = workspaceRef.current
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY
      window.scrollTo({ top, behavior: 'smooth' })
    }
  }

  // 打开成功 → file-opened 徽章事件
  useEffect(() => {
    if (activeTab) {
      wire.onFileOpened()
    }
  }, [activeTab?.id, wire]) // eslint-disable-line react-hooks/exhaustive-deps

  const onEditorMount = (handle: MarkdownEditorHandle) => {
    editorViewRef.current = handle.view
    setEditorViewState(handle.view)
  }

  // ── 图片导入 ──
  const insertImages = async (files: File[], at?: number) => {
    if (files.length === 0 || !activeTab) return
    const { assets: converted, skipped } = await filesToAssets(files)
    const view = editorViewRef.current
    const currentDoc = view ? view.state.doc.toString() : activeTab.source
    const { assets: next, additions, skipped: skippedDup } = addAssets(assetsRef.current, converted)
    assetsRef.current = next
    setTabsState((s) => updateTab(s, activeTab.id, { assets: next }))

    const wiredSet = new Set(wireReferences(currentDoc, additions).wired)
    const toInsert = additions.filter((n) => !wiredSet.has(n))
    if (toInsert.length > 0) {
      const insertText =
        toInsert.map((n) => findReference(currentDoc, n) ?? `![${n}](${n})`).join('\n') + '\n'
      if (view) {
        // 默认插入到光标处；拖放时提供 at（编辑器内 drop 位置），插到落点。
        const head = at ?? view.state.selection.main.head
        view.dispatch({
          changes: { from: head, insert: insertText },
          selection: { anchor: head + insertText.length },
        })
        // 同步 source 到 tab
        setTabsState((s) => updateTab(s, activeTab.id, { source: view.state.doc.toString() }))
      } else {
        setTabsState((s) => updateTab(s, activeTab.id, { source: currentDoc + insertText }))
      }
    }

    const allSkipped = [...skipped, ...skippedDup]
    if (allSkipped.length > 0) {
      setImportHint(`已跳过超大图片（>15MB）：${allSkipped.join('、')}`)
    }
  }

  // 拖放文档分流（Bug 2/3/4）：.md/.mdpkg 直接打开；.zip 解压找文档；文件夹遍历找文档。
  // 返回 true 表示已处理（打开文档或给出提示）；false 表示无文档可处理。
  const openDroppedDocs = async (dt: DataTransfer | null): Promise<boolean> => {
    if (!dt) return false
    const docFiles: File[] = []
    const dirItems: DataTransferItem[] = []
    if (dt.items.length > 0) {
      for (let i = 0; i < dt.items.length; i++) {
        const item = dt.items[i]
        if (item.kind !== 'file') continue
        // Bug 4 修复：item.kind 对文件夹也返回 "file"，需用 getDirectoryHandle 检测
        const dirHandle = await getDirectoryHandle(item)
        if (dirHandle) {
          dirItems.push(item)
          continue
        }
        const f = item.getAsFile()
        if (!f) continue
        if (f.type.startsWith('image/')) continue
        docFiles.push(f)
      }
    } else {
      for (const f of Array.from(dt.files)) {
        if (f.type.startsWith('image/')) continue
        docFiles.push(f)
      }
    }
    for (const f of docFiles) {
      const lower = f.name.toLowerCase()
      if (lower.endsWith('.md') || lower.endsWith('.mdpkg')) {
        void openFileObject(f)
        return true
      }
      if (lower.endsWith('.zip')) {
        const result = await extractDocFromZip(f)
        if (result.ok) {
          void openFileObject(result.file)
        } else {
          setImportHint(result.message)
        }
        return true
      }
    }
    if (dirItems.length > 0) {
      const handle = await getDirectoryHandle(dirItems[0])
      if (!handle) {
        setImportHint('无法读取文件夹（当前浏览器不支持文件夹拖入）')
        return true
      }
      const result = await extractDocFromDirectory(handle)
      if (result.ok) {
        void openFileObject(result.file)
      } else {
        setImportHint(result.message)
      }
      return true
    }
    return false
  }

  // 粘贴：只拦截图片
  const onPaste = async (e: React.ClipboardEvent) => {
    const files = await imagesFromClipboard(e.clipboardData?.items)
    if (files.length === 0) return
    e.preventDefault()
    void insertImages(files)
  }

  // 拖拽：图片 → 导入；.md/.mdpkg → 打开
  const onDrop = (e: React.DragEvent) => {
    // Bug 3 修复：React 合成 onDrop 会 stopPropagation，document 级 onDocDrop 不再触发，
    // 这里必须自行处理 drop；整窗拖放无遮罩，无需复位蒙层状态。
    e.preventDefault()
    e.stopPropagation()
    void (async () => {
      const dt = e.dataTransfer ?? (e.nativeEvent as DragEvent).dataTransfer
      const imageFiles = await imagesFromDataTransfer(dt)
      if (imageFiles.length > 0) {
        // 编辑器可见时按落点插入；预览/源码仍插到光标处。
        const view = editorViewRef.current
        const dropAt =
          mode !== 'preview' && view
            ? (view.posAtCoords({ x: e.clientX, y: e.clientY }) ?? undefined)
            : undefined
        void insertImages(imageFiles, dropAt)
        return
      }
      const rawFiles = dt?.files
      if (!rawFiles) return
      const handled = await openDroppedDocs(dt)
      if (handled) return
      for (const f of Array.from(rawFiles)) {
        const lower = f.name.toLowerCase()
        if (lower.endsWith('.md') || lower.endsWith('.mdpkg')) {
          void openFileObject(f)
          return
        }
      }
    })()
  }

  const handleDelete = (name: string) => {
    if (!activeTab) return
    assetsRef.current = removeAsset(assetsRef.current, name)
    setTabsState((s) => updateTab(s, activeTab.id, { assets: assetsRef.current }))
    const view = editorViewRef.current
    if (view) {
      const current = view.state.doc.toString()
      const next = stripReferences(current, name)
      if (next !== current) {
        view.dispatch({ changes: { from: 0, to: current.length, insert: next } })
        setTabsState((s) => updateTab(s, activeTab.id, { source: view.state.doc.toString() }))
      }
    }
  }

  const handleReplace = async (name: string, file: File) => {
    if (!activeTab) return
    if (file.size > MAX_ASSET_BYTES) {
      setImportHint(`替换失败：${file.name} 超过 15MB 上限`)
      return
    }
    const next = await replaceAsset(assetsRef.current, name, file)
    assetsRef.current = next
    setTabsState((s) => updateTab(s, activeTab.id, { assets: next }))
    // 行内图片装饰只在 doc/selection 变化时重建——替换资产后文档没变，
    // 需要一次 selection dispatch 触发重建，编辑器内的图才会立即换成新字节。
    // （selection 交易不触发 docChanged → 不会误报 onChange。）
    const view = editorViewRef.current
    if (view) {
      const { anchor, head } = view.state.selection.main
      view.dispatch({ selection: { anchor, head } })
    }
  }

  const handleImageLocate = (name: string) => {
    // 1. 展开左栏（桌面侧栏 / 移动端抽屉，二者只渲染其一）
    const rail = document.querySelector('[data-testid="left-rail"]')
    const drawer = document.querySelector('[data-testid="mobile-rail-drawer"]')
    if (!rail && !drawer) {
      const toggle = document.querySelector<HTMLElement>('[data-testid="left-rail-toggle"]')
      if (toggle) toggle.click()
      else document.querySelector<HTMLElement>('[data-testid="mobile-rail-toggle"]')?.click()
    }
    // 2. 切到「资源」页签（LeftRail 页签是内部 state，点按钮切换）
    document.querySelector<HTMLElement>('[data-testid="left-rail-tab-assets"]')?.click()
    // 3. 展开与切页签都是异步 setState——轮询等对应 asset 行挂载后滚动 + 高亮
    const safeName = name.replace(/"/g, '\\"')
    const rowSel = `[data-testid="asset-${safeName}"]`
    let tries = 0
    const scrollToRow = (): void => {
      const row = document.querySelector<HTMLElement>(rowSel)
      if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' })
        const prevOutline = row.style.outline
        row.style.outline = '2px solid var(--mdb-primary-fg)'
        window.setTimeout(() => {
          row.style.outline = prevOutline
        }, 2000)
        return
      }
      if (++tries < 40) window.setTimeout(scrollToRow, 50)
    }
    window.setTimeout(scrollToRow, 30)
  }

  // 装饰图片解析：与 inlineImages 同口径（剥离 ./、精确匹配 + basename 回退），
  // 保证编辑器 widget 与预览/导出对同一引用得到一致结果。
  const resolveImage = (path: string): string | null =>
    resolveAssetDataUrl(assetsRef.current, path)

  resolveImageRef.current = resolveImage
  onImageReplaceRef.current = (name: string) => {
    // 图片悬浮工具栏「替换」：弹文件选择器，选中后走与资源面板一致的 handleReplace。
    // 用独立的隐藏 input（不依赖资源面板是否挂载——侧栏收起时面板不在 DOM）。
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.style.display = 'none'
    input.addEventListener('change', () => {
      const f = input.files?.[0]
      if (f) void handleReplace(name, f)
      input.remove()
    })
    // 用户取消选择时浏览器会派发 cancel 事件
    input.addEventListener('cancel', () => input.remove())
    document.body.appendChild(input)
    input.click()
  }
  onImageDeleteRef.current = handleDelete
  onImageLocateRef.current = handleImageLocate

  const showExportError = (message: string) => {
    setExportError(message)
    if (exportErrorTimer.current !== null) window.clearTimeout(exportErrorTimer.current)
    exportErrorTimer.current = window.setTimeout(() => setExportError(null), 4000)
  }

  // ── 派生值（从 activeTab 取）──
  const isEmpty = !activeTab
  const sourceKind = activeTab?.kind === 'mdpkg' ? 'mdpkg' : 'md'
  const docBase = activeTab ? baseName(activeTab.name) : 'document'
  const docTitle = activeTab?.name ?? 'MD-Bundle 文档'
  const prevManifest = activeTab?.kind === 'mdpkg' ? (activeTab.manifest ?? undefined) : undefined
  const extraFiles =
    activeTab?.kind === 'mdpkg' && activeTab.mdpkgFiles
      ? new Map(
          [...activeTab.mdpkgFiles].filter(
            ([name]) =>
              name !== 'manifest.json' &&
              name !== (activeTab.manifest?.entrypoint ?? 'document.md') &&
              !IMAGE_PATH_RE.test(name),
          ),
        )
      : undefined

  // ── 整窗拖放直达 ──
  useEffect(() => {
    const onDocDrop = (e: DragEvent) => {
      e.preventDefault()
      const dt = e.dataTransfer
      if (!dt) return

      const imageFiles: File[] = []
      for (let i = 0; i < dt.items.length; i++) {
        const item = dt.items[i]
        if (item.kind === 'directory') continue
        if (item.kind !== 'file') continue
        const f = item.getAsFile()
        if (!f) continue
        if (f.type.startsWith('image/')) {
          imageFiles.push(f)
        }
      }

      if (imageFiles.length > 0) {
        if (!activeTab) {
          setImportHint('请先打开文档再拖入图片')
          return
        }
        void insertImages(imageFiles)
        return
      }
      void openDroppedDocs(dt)
    }
    const onDocDragOver = (e: DragEvent) => {
      e.preventDefault()
    }
    document.addEventListener('drop', onDocDrop)
    document.addEventListener('dragover', onDocDragOver)
    return () => {
      document.removeEventListener('drop', onDocDrop)
      document.removeEventListener('dragover', onDocDragOver)
    }
  }, [activeTab?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 保存/导出（作用于 activeTab）──
  const handleSave = async (): Promise<boolean> => {
    if (!activeTab) return false
    const result: SaveResult = await saveDocument({
      markdown: activeTab.source,
      assets: assetsRef.current,
      sourceKind,
      filename: docBase,
      prevManifest,
      extraFiles,
      diskHandle: activeTab.diskHandle,
    })
    wire.onSaveResult(result.ok ? result.kind : null)
    if (result.ok) {
      // 并行任务可能为 SaveResult 成功分支扩增 diskHandle（另存为后持句柄）；
      // 此处从容读取并写入 activeTab，类型尚未扩增时也能编译。
      const savedHandle = (result as unknown as { diskHandle?: FileSystemFileHandle }).diskHandle
      setTabsState((s) =>
        updateTab(s, activeTab.id, {
          dirty: false,
          ...(savedHandle ? { diskHandle: savedHandle } : {}),
        }),
      )
    }
    return result.ok
  }

  const handleExport = async (format: ExportFormat): Promise<boolean> => {
    if (!activeTab) return false
    try {
      switch (format) {
        case 'md': {
          if (assetsRef.current.length > 0) {
            if (!window.confirm(WARNING_EXPORT_MD)) return false
          }
          const files = new Map<string, Uint8Array>()
          files.set(ENTRY_FILENAME, new TextEncoder().encode(activeTab.source))
          for (const asset of assetsRef.current) {
            files.set(asset.name, dataUrlToBytes(asset.dataUrl))
          }
          if (extraFiles) {
            for (const [name, bytes] of extraFiles) {
              files.set(name, bytes)
            }
          }
          const result = toMarkdown(files, { include: true })
          downloadText(result, `${docBase}.md`)
          wire.onExportResult(format, true)
          return true
        }
        case 'mdpkg':
          downloadBlob(
            new Blob(
              [
                new Uint8Array(
                  exportMdpkg({
                    markdown: activeTab.source,
                    assets: assetsRef.current,
                    prevManifest,
                    extraFiles,
                  }),
                ),
              ],
              { type: 'application/octet-stream' },
            ),
            `${docBase}.mdpkg`,
          )
          wire.onExportResult(format, true)
          return true
        case 'html':
          downloadText(
            await buildHtmlDocument({
              markdown: activeTab.source,
              assets: assetsRef.current,
              title: docTitle,
              theme: resolveEffectiveTheme(themePref),
            }),
            `${docBase}.html`,
          )
          wire.onExportResult(format, true)
          return true
        case 'png': {
          const blob = await exportPngFromMarkdown({
            markdown: activeTab.source,
            assets: assetsRef.current,
            theme: resolveEffectiveTheme(themePref),
          })
          downloadBlob(blob, `${docBase}.png`)
          wire.onExportResult(format, true)
          return true
        }
        case 'docx': {
          const warnings: string[] = []
          const result = await exportDocx({
            markdown: activeTab.source,
            title: docTitle,
            assets: assetsRef.current,
            filename: `${docBase}.docx`,
            onWarning: (m) => warnings.push(m),
          })
          if (!result.ok) {
            showExportError(result.error)
            return false
          }
          if (warnings.length > 0) {
            setDocxWarning(`导出完成，部分内容已降级：${warnings[0]}`)
            if (docxWarningTimer.current !== null) {
              window.clearTimeout(docxWarningTimer.current)
            }
            docxWarningTimer.current = window.setTimeout(() => setDocxWarning(null), 4000)
          }
          wire.onExportResult(format, true)
          return true
        }
        case 'zip': {
          const zipFiles = new Map<string, Uint8Array>()
          zipFiles.set(ENTRY_FILENAME, new TextEncoder().encode(activeTab.source))
          for (const asset of assetsRef.current) {
            zipFiles.set(asset.name, dataUrlToBytes(asset.dataUrl))
          }
          if (extraFiles) {
            for (const [name, bytes] of extraFiles) {
              zipFiles.set(name, bytes)
            }
          }
          const zipResult = toZip(zipFiles, {})
          downloadBlob(
            new Blob([new Uint8Array(zipResult)], { type: 'application/zip' }),
            `${docBase}.zip`,
          )
          wire.onExportResult(format, true)
          return true
        }
      }
    } catch (e) {
      showExportError(e instanceof Error ? e.message : String(e))
      return false
    }
  }

  const canSave = !!activeTab

  // ── 复制正文为图片：导出 PNG → 尝试复制；失败兜底下载（README v1 归位顶栏）──
  const handleCopyBodyAsImage = async () => {
    if (!activeTab) return
    try {
      const blob = await exportPngFromMarkdown({
        markdown: activeTab.source,
        assets: activeTab.assets,
        theme: resolveEffectiveTheme(themePref),
      })
      const copied = await copyToClipboard(blob)
      if (copied) {
        showInviteCardStatus('正文已复制为图片')
      } else {
        downloadBlob(blob, `${docBase}.png`)
        showInviteCardStatus('正文图片已下载')
      }
    } catch (e) {
      showInviteCardStatus(e instanceof Error ? e.message : '正文复制为图片失败')
    }
  }

  const openFeaturedExample = (example: {
    id: string
    content: string
    format: 'md' | 'mdpkg'
  }) => {
    if (example.format === 'md') {
      // 示例 = 新页签（决策 #27），默认预览态
      const r = addTab(tabsState, { kind: 'md', name: `${example.id}.md`, source: example.content })
      setTabsState(updateTab(r.state, r.tabId, { mode: 'preview' }))
    }
  }

  // ── 页签操作 ──
  const handleTabSelect = (tabId: string) => {
    setTabsState((s) => setActiveTab(s, tabId))
  }

  // 新建空白文档页签（页签条 + 按钮）。初始即未保存 → dirty=true。
  const handleNewDocument = () => {
    const name = nextUntitledName(tabsState.tabs.map((t) => t.name))
    setTabsState((s) => {
      const r = addTab(s, { kind: 'md', name, source: '' })
      return updateTab(r.state, r.tabId, { dirty: true })
    })
  }

  const handleTabClose = (tabId: string) => {
    const tab = tabsState.tabs.find((t) => t.id === tabId)
    if (tab) {
      const entry = createRecentEntry(tab)
      const rest = recentDocsRef.current.filter((d) => d.name !== tab.name)
      recentDocsRef.current = [entry, ...rest].slice(0, MAX_RECENT_DOCS)
    }
    setTabsState((s) => removeTab(s, tabId))
  }

  // ── 最近文档（Wave 4：完整 tab-close → createRecentEntry → saveSession 流程）──
  const recentDocsRef = useRef<RecentDocItem[]>([])

  const openRecentDoc = (doc: RecentDocItem) => {
    if (!doc || typeof doc.name !== 'string' || !doc.source) return
    const kind = doc.kind === 'mdpkg' ? 'mdpkg' : 'md'
    const added = addTab(tabsState, { kind, name: doc.name, source: doc.source })
    // 最近文档打开默认进入 preview（README v1）；scrollPos 仍按会话恢复
    let state = updateTab(added.state, added.tabId, { mode: 'preview', scrollPos: doc.scrollPos })
    if (doc.diskHandle) {
      state = updateTab(state, added.tabId, { diskHandle: doc.diskHandle })
    }
    setTabsState(state)
  }

  // ── 会话恢复（Wave 4：刷新后全量恢复 tabs + 最近文档）──
  const restoredRef = useRef(false)
  useEffect(() => {
    let cancelled = false
    void restoreSession().then((result) => {
      if (cancelled) return
      if (result.ok) {
        // 用户已打开新页签时不覆盖（恢复窗口内的竞态保护）
        setTabsState((s) => (s.tabs.length === 0 ? result.snapshot.tabs : s))
        recentDocsRef.current = result.snapshot.recentDocs
      }
      restoredRef.current = true
    })
    return () => {
      cancelled = true
    }
  }, [])

  // ── 会话自动保存（Wave 4：tabsState 变化防抖 1s 写入 IndexedDB）──
  useEffect(() => {
    if (!restoredRef.current) return
    const timer = window.setTimeout(() => {
      void saveSession(tabsState, recentDocsRef.current).then((r) => {
        // 并行任务可能扩增 SaveResult；这里只取 error 分支的提示文案，guard optional。
        if (!r.ok) {
          const msg = (r as unknown as { error?: string }).error
          if (msg) setImportHint(msg)
        }
      })
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [tabsState])

  return (
    <div
      className={`flex flex-col bg-[var(--bg)] text-[var(--fg)] ${
        isEmpty ? 'min-h-screen' : 'h-screen'
      }`}
    >
      {/* 页签条（任务 4.1）：有页签时显示 */}
      {!isEmpty && (
        <TabStrip
          tabs={tabsState.tabs}
          activeId={tabsState.activeId}
          onSelect={handleTabSelect}
          onClose={handleTabClose}
          onAddTab={handleNewDocument}
        />
      )}

      {/* 顶栏 v2：有文档时显示，empty 态隐藏。侧栏开关在最左，三模式居中，动作靠右。 */}
      {!isEmpty && (
        <header className="relative z-30 border-b border-[var(--border)] bg-[var(--surface)]/60 backdrop-blur">
          <div className="relative mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-6">
            <div className="flex items-center gap-1">
              {!isNarrow && (
                <button
                  type="button"
                  data-testid="left-rail-toggle"
                  onClick={toggleRail}
                  aria-label={railOpen ? '收起左栏' : '展开左栏'}
                  title={railOpen ? '收起左栏' : '展开左栏'}
                  className="gbtn relative opacity-60 hover:opacity-100"
                >
                  <svg viewBox="0 0 24 24">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M9 3v18" />
                    <path d={railOpen ? 'm16 15-3-3 3-3' : 'm14 9 3 3-3 3'} />
                  </svg>
                  {!railOpen && hasOrphans && (
                    <span
                      data-testid="left-rail-badge"
                      className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--warn)]"
                    />
                  )}
                </button>
              )}
              <h1 className="text-xl font-bold tracking-tight text-[var(--fg)]">MD-Bundle</h1>
            </div>
            <Toolbar
              canSave={canSave}
              sourceKind={sourceKind}
              error={exportError}
              onSave={() => void handleSave()}
              onExport={(f) => void handleExport(f)}
              onOpenFile={() => document.querySelector<HTMLInputElement>('[data-testid="file-input"]')?.click()}
              currentMode={mode}
              onModeChange={setMode}
              onThemeClick={handleThemeClick}
              themeProp={themePref}
              onCopyInviteLink={() => void handleCopyInviteLink()}
              onGenerateInviteCard={() => void handleGenerateInviteCard()}
              onCopyBodyAsImage={() => void handleCopyBodyAsImage()}
              fsaAvailable={isFsaAvailable()}
            />
          </div>
        </header>
      )}

      {/* empty 态：Landing 全页 */}
      {isEmpty && (
        <Landing
          onOpenExample={openFeaturedExample}
          recentDocs={recentDocsRef.current}
          onOpenRecentDoc={openRecentDoc}
        />
      )}

      {/* 隐藏的 FileOpen：Landing CTA / 顶栏「打开新文件」通过 querySelector 触发 */}
      <div className="hidden">
        <FileOpen onOpenFile={(f) => void openFileObject(f)} compact={false} />
      </div>

      {/* 工作区：填满屏幕剩余高度，内容列 1000px 居中 */}
      {!isEmpty && activeTab && (
        <main className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col px-6 py-6">
          <section id="workspace" ref={workspaceRef} className="flex min-h-0 flex-1 flex-col scroll-mt-6">
            {importHint && (
              <p
                data-testid="import-hint"
                role="status"
                aria-live="polite"
                className="mb-2 text-xs text-[var(--warn)]"
              >
                {importHint}
              </p>
            )}

            {docxWarning && (
              <p
                data-testid="docx-warning"
                role="status"
                aria-live="polite"
                className="mb-2 text-xs text-[var(--warn)]"
              >
                {docxWarning}
              </p>
            )}

            {/* 工作区：三模式 + 左栏 + 大纲 */}
            <div className="flex min-h-0 flex-1 gap-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              <LeftRail
                assets={activeTab.assets}
                documentText={activeTab.source}
                onDelete={handleDelete}
                onReplace={handleReplace}
                onOpenFile={(file, handle) => void openFileObject(file, handle)}
                activeTabName={activeTab.name}
                recentDocs={recentDocsRef.current}
                onOpenRecentDoc={openRecentDoc}
                open={railOpen}
                onToggle={toggleRail}
              />

              <div
                data-testid="workspace-modes"
                className="relative min-h-0 min-w-0 flex-1 overflow-hidden"
                onPaste={onPaste}
                onDrop={onDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                <OutlineMenu
                  key={activeTab.id}
                  mode={mode}
                  documentText={activeTab.source}
                  editorView={editorViewState}
                  previewRef={previewRef}
                />

                <div
                  data-testid="mode-pane-editor"
                  style={{ display: mode === 'edit' || mode === 'source' ? 'block' : 'none' }}
                  className="pane-inner h-full"
                >
                  <div className="mdb-split-editor h-full">
                    <MarkdownEditor
                      value={activeTab.source}
                      onChange={handleEditorChange}
                      theme={resolveEffectiveTheme(themePref)}
                      extensions={SLASH_EXT}
                      decorations={DECORATIONS_EXT}
                      decorationsEnabled={mode === 'edit'}
                      onMount={onEditorMount}
                    />
                  </div>
                </div>
                <div
                  ref={previewRef}
                  data-testid="mode-pane-preview"
                  style={{ display: mode === 'preview' ? 'block' : 'none' }}
                  className="pane-inner h-full overflow-auto bg-[var(--bg)]"
                >
                  <PreviewView
                    markdown={activeTab.source}
                    theme={resolveEffectiveTheme(themePref)}
                    assets={activeTab.assets}
                  />
                </div>
              </div>
            </div>

            {activeTab.kind === 'mdpkg' && (
              <ValidationPanel validation={activeTab.validation ?? null} name={activeTab.name} />
            )}

            {activeTab.source.startsWith('错误：') && (
              <div
                role="alert"
                className="rounded-xl border border-[var(--danger)]/40 bg-[var(--danger)]/10 p-5"
              >
                <p className="font-medium text-[var(--danger)]">打开失败</p>
                <p className="mt-1 text-sm leading-relaxed text-[var(--fg-2)]">
                  {activeTab.source.replace('错误：', '')}
                </p>
                <button
                  type="button"
                  onClick={() => setTabsState((s) => removeTab(s, activeTab.id))}
                  className="mt-4 rounded-lg bg-[var(--accent-fill)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-fill-hover)]"
                >
                  重新选择
                </button>
              </div>
            )}
          </section>
        </main>
      )}

      {importHint && isEmpty && (
        <p
          data-testid="import-hint"
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-[var(--surface)] px-4 py-2 text-sm text-[var(--warn)] shadow-lg"
        >
          {importHint}
        </p>
      )}

      {inviteCardStatus && (
        <p
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-[var(--surface)] px-4 py-2 text-sm text-[var(--fg)] shadow-lg"
        >
          {inviteCardStatus}
        </p>
      )}

      {toast && <BadgeToast text={toast.text} rarity={toast.rarity} onDismiss={dismiss} />}
    </div>
  )
}
