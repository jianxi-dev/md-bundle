// MD-Bundle 应用外壳（任务 4.1：多页签文档模型）。
// 状态机：tabs state（tabs[] + activeId）→ empty | md | mdpkg。
// 打开文件 = 新增页签（永不静默替换）；关闭唯一页签 → 回 empty。
// 图片导入/保存/导出作用于 activeTab；各 tab 内容独立。
import { useEffect, useMemo, useRef, useState } from 'react';
import { MarkdownEditor, slashKeymap, editorDecorations, type MarkdownEditorHandle } from '@md-bundle/editor';
import { PreviewView } from './components/PreviewView';
import { FileOpen } from './components/FileOpen';
import { Landing } from './components/Landing';
import { ValidationPanel } from './components/ValidationPanel';
import { LeftRail } from './components/LeftRail';
import { OutlineMenu } from './components/OutlineMenu';
import { Toolbar, type ExportFormat, type EditorMode } from './components/Toolbar';
import { TabStrip } from './components/TabStrip';
import { ShareCard } from './components/ShareCard';
import { BadgeToast } from './components/BadgeToast';
import { useBadges, wireBadgeEvents } from './lib/useBadges';
import { openFile } from './lib/openFile';
import { readEntrySource } from './lib/mdpkg';
import { saveDocument, type SaveResult } from './lib/save';
import { exportMdpkg } from './lib/exportMdpkg';
import { exportMd } from './lib/export';
import { buildHtmlDocument } from './lib/exportHtml';
import { exportPngFromMarkdown } from './lib/exportPng';
import { downloadBlob, downloadText } from './lib/download';
import { shareCardAsImage } from './lib/shareCard';
import { bytesToDataUrl } from './lib/dataUrl';
import {
  MAX_ASSET_BYTES,
  addAssets,
  findReference,
  removeAsset,
  replaceAsset,
  stripReferences,
  wireReferences,
  type Asset,
} from './lib/assets';
import { filesToAssets, imagesFromClipboard, imagesFromDataTransfer } from './lib/importImages';
import {
  createTabsState,
  addTab,
  removeTab,
  updateTab,
  setActiveTab,
  getActiveTab,
  type TabsState,
} from './lib/tabs';

/** 包内图片条目路径（资产名 = 完整路径，inlineImages 按名精确查找）。 */
const IMAGE_PATH_RE = /\.(png|jpe?g|gif|webp)$/i;
const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

/** 从 .mdpkg 解包结果构建资产清单：图片条目 → Asset（name = 路径，dataUrl 由原始字节生成）。 */
function assetsFromPackageFiles(files: Map<string, Uint8Array>): Asset[] {
  const assets: Asset[] = [];
  for (const [path, bytes] of files) {
    if (!IMAGE_PATH_RE.test(path)) continue;
    const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
    assets.push({ name: path, size: bytes.length, dataUrl: bytesToDataUrl(bytes, MIME[ext] ?? 'image/png') });
  }
  return assets;
}

/** 文件名去扩展名（hello.md → hello；无扩展名原样返回）。 */
function baseName(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

// 斜杠命令扩展：模块级单例（编辑器只在挂载时读取 extensions —— 稳定引用避免任何重挂载顾虑）。
const SLASH_EXT = [slashKeymap()];

/** 窄屏检测 hook（<768px）：matchMedia 监听，响应式断点切换。 */
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

export default function App() {
  // ── 多页签状态（任务 4.1）──
  const [tabsState, setTabsState] = useState<TabsState>(createTabsState);
  const activeTab = getActiveTab(tabsState);

  const [mode, setMode] = useState<EditorMode>('edit');
  const isNarrow = useIsNarrow();
  const [importHint, setImportHint] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const assetsRef = useRef<Asset[]>([]);
  const editorViewRef = useRef<MarkdownEditorHandle['view'] | null>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const exportErrorTimer = useRef<number | null>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const resolveImageRef = useRef<((path: string) => string | null) | null>(null);
  const onImageReplaceRef = useRef<((path: string) => void) | null>(null);
  const onImageDeleteRef = useRef<((path: string) => void) | null>(null);
  const onImageLocateRef = useRef<((path: string) => void) | null>(null);

  // 徽章接线（6.4）
  const { badgeStore, toast, dismiss, showToastFor } = useBadges();
  const wire = useMemo(
    () =>
      wireBadgeEvents(badgeStore, {
        onSaveSuccess: (r) => showToastFor(r),
        onPngExportSuccess: (r) => showToastFor(r),
        onExportSuccess: (r) => showToastFor(r),
        onFileOpen: (r) => showToastFor(r),
      }),
    [badgeStore, showToastFor],
  );

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
  );

  // ── activeTab 变化时同步 assetsRef + mode ──
  useEffect(() => {
    if (activeTab) {
      assetsRef.current = activeTab.assets;
      setMode(activeTab.mode);
      setImportHint(null);
      // 窄屏打开文档默认 preview 模式
      if (isNarrow) {
        setMode('preview');
        setTabsState((s) => {
          const tab = getActiveTab(s);
          if (tab) return updateTab(s, tab.id, { mode: 'preview' });
          return s;
        });
      }
    }
  }, [activeTab?.id, isNarrow]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 编辑器 onChange → 更新 activeTab.source ──
  const handleEditorChange = (value: string) => {
    if (!activeTab) return;
    setTabsState((s) => updateTab(s, activeTab.id, { source: value, dirty: true }));
  };

  // ── 文件打开：解析 → 新增 tab ──
  const openFileObject = async (file: File, diskHandle?: FileSystemFileHandle) => {
    const outcome = await openFile(file);
    switch (outcome.kind) {
      case 'md': {
        const r = addTab(tabsState, { kind: 'md', name: outcome.name, source: outcome.content, diskHandle });
        setTabsState(r.state);
        break;
      }
      case 'mdpkg': {
        const pkg = outcome.result;
        if ('files' in pkg && pkg.html !== null) {
          const packageAssets = assetsFromPackageFiles(pkg.files);
          const r = addTab(tabsState, {
            kind: 'mdpkg',
            name: outcome.name,
            source: readEntrySource(pkg.files, pkg.manifest?.entrypoint),
            assets: packageAssets,
            mdpkgFiles: pkg.files,
            manifest: pkg.manifest,
            validation: pkg.validation,
            diskHandle,
          });
          setTabsState(r.state);
        } else {
          const err = 'files' in pkg ? (pkg.error ?? '未知渲染错误') : pkg.error;
          // 错误态：新增一个 error tab（source 存错误信息）
          const r = addTab(tabsState, { kind: 'md', name: '错误', source: `错误：${err}`, diskHandle });
          setTabsState(r.state);
        }
        break;
      }
      case 'error': {
        const r = addTab(tabsState, { kind: 'md', name: '错误', source: `错误：${outcome.message}`, diskHandle });
        setTabsState(r.state);
        break;
      }
    }

    // 平滑滚动到工作区
    const el = workspaceRef.current;
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  };

  // 打开成功 → file-opened 徽章事件
  useEffect(() => {
    if (activeTab) {
      wire.onFileOpened();
    }
  }, [activeTab?.id, wire]); // eslint-disable-line react-hooks/exhaustive-deps

  const onEditorMount = (handle: MarkdownEditorHandle) => {
    editorViewRef.current = handle.view;
  };

  // ── 图片导入 ──
  const insertImages = async (files: File[]) => {
    if (files.length === 0 || !activeTab) return;
    const { assets: converted, skipped } = await filesToAssets(files);
    const view = editorViewRef.current;
    const currentDoc = view ? view.state.doc.toString() : activeTab.source;
    const { assets: next, additions, skipped: skippedDup } = addAssets(assetsRef.current, converted);
    assetsRef.current = next;
    setTabsState((s) => updateTab(s, activeTab.id, { assets: next }));

    const wiredSet = new Set(wireReferences(currentDoc, additions).wired);
    const toInsert = additions.filter((n) => !wiredSet.has(n));
    if (toInsert.length > 0) {
      const insertText =
        toInsert.map((n) => findReference(currentDoc, n) ?? `![${n}](${n})`).join('\n') + '\n';
      if (view) {
        const head = view.state.selection.main.head;
        view.dispatch({
          changes: { from: head, insert: insertText },
          selection: { anchor: head + insertText.length },
        });
        // 同步 source 到 tab
        setTabsState((s) => updateTab(s, activeTab.id, { source: view.state.doc.toString() }));
      } else {
        setTabsState((s) => updateTab(s, activeTab.id, { source: currentDoc + insertText }));
      }
    }

    const allSkipped = [...skipped, ...skippedDup];
    if (allSkipped.length > 0) {
      setImportHint(`已跳过超大图片（>15MB）：${allSkipped.join('、')}`);
    }
  };

  // 粘贴：只拦截图片
  const onPaste = async (e: React.ClipboardEvent) => {
    const files = await imagesFromClipboard(e.clipboardData?.items);
    if (files.length === 0) return;
    e.preventDefault();
    void insertImages(files);
  };

  // 拖拽：图片 → 导入；.md/.mdpkg → 打开
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    void (async () => {
      const dt = e.dataTransfer ?? (e.nativeEvent as DragEvent).dataTransfer;
      const imageFiles = await imagesFromDataTransfer(dt);
      if (imageFiles.length > 0) {
        void insertImages(imageFiles);
        return;
      }
      const rawFiles = dt?.files;
      if (!rawFiles) return;
      for (const f of Array.from(rawFiles)) {
        const lower = f.name.toLowerCase();
        if (lower.endsWith('.md') || lower.endsWith('.mdpkg')) {
          void openFileObject(f);
          return;
        }
      }
    })();
  };

  const onImportChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) void insertImages(files);
    e.target.value = '';
  };

  const handleDelete = (name: string) => {
    if (!activeTab) return;
    assetsRef.current = removeAsset(assetsRef.current, name);
    setTabsState((s) => updateTab(s, activeTab.id, { assets: assetsRef.current }));
    const view = editorViewRef.current;
    if (view) {
      const current = view.state.doc.toString();
      const next = stripReferences(current, name);
      if (next !== current) {
        view.dispatch({ changes: { from: 0, to: current.length, insert: next } });
        setTabsState((s) => updateTab(s, activeTab.id, { source: view.state.doc.toString() }));
      }
    }
  };

  const handleReplace = async (name: string, file: File) => {
    if (!activeTab) return;
    if (file.size > MAX_ASSET_BYTES) {
      setImportHint(`替换失败：${file.name} 超过 15MB 上限`);
      return;
    }
    const next = await replaceAsset(assetsRef.current, name, file);
    assetsRef.current = next;
    setTabsState((s) => updateTab(s, activeTab.id, { assets: next }));
  };

  const handleImageLocate = (_path: string) => {
    const rail = document.querySelector('[data-testid="left-rail"]');
    if (!rail || rail.classList.contains('hidden')) {
      document.querySelector('[data-testid="left-rail-toggle"]')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      );
    }
    setTimeout(() => {
      document.querySelector('[data-testid="left-rail-tab-assets"]')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      );
    }, 50);
  };

  // 装饰图片解析
  const resolveImage = (path: string): string | null => {
    const asset = assetsRef.current.find((a) => a.name === path);
    return asset?.dataUrl ?? null;
  };

  resolveImageRef.current = resolveImage;
  onImageReplaceRef.current = (_path: string) => { /* 未来扩展 */ };
  onImageDeleteRef.current = handleDelete;
  onImageLocateRef.current = handleImageLocate;

  const showExportError = (message: string) => {
    setExportError(message);
    if (exportErrorTimer.current !== null) window.clearTimeout(exportErrorTimer.current);
    exportErrorTimer.current = window.setTimeout(() => setExportError(null), 4000);
  };

  // ── 派生值（从 activeTab 取）──
  const isEmpty = !activeTab;
  const sourceKind = activeTab?.kind === 'mdpkg' ? 'mdpkg' : 'md';
  const docBase = activeTab ? baseName(activeTab.name) : 'document';
  const docTitle = activeTab?.name ?? 'MD-Bundle 文档';
  const shareTitle = activeTab?.name ?? '';
  const shareStats = { chars: (activeTab?.source ?? '').length, images: (activeTab?.assets ?? []).length };
  const prevManifest = activeTab?.kind === 'mdpkg' ? (activeTab.manifest ?? undefined) : undefined;
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
      : undefined;

  // ── 整窗拖放直达 ──
  useEffect(() => {
    const onDocDrop = (e: DragEvent) => {
      e.preventDefault();
      const dt = e.dataTransfer;
      if (!dt) return;

      const imageFiles: File[] = [];
      const docFiles: File[] = [];
      for (let i = 0; i < dt.items.length; i++) {
        const item = dt.items[i];
        if (item.kind === 'directory') continue;
        if (item.kind !== 'file') continue;
        const f = item.getAsFile();
        if (!f) continue;
        if (f.type.startsWith('image/')) {
          imageFiles.push(f);
        } else {
          docFiles.push(f);
        }
      }

      if (imageFiles.length > 0) {
        if (!activeTab) {
          setImportHint('请先打开文档再拖入图片');
          return;
        }
        void insertImages(imageFiles);
        return;
      }
      for (const f of docFiles) {
        const lower = f.name.toLowerCase();
        if (lower.endsWith('.md') || lower.endsWith('.mdpkg')) {
          void openFileObject(f);
          return;
        }
      }
    };
    const onDocDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    document.addEventListener('drop', onDocDrop);
    document.addEventListener('dragover', onDocDragOver);
    return () => {
      document.removeEventListener('drop', onDocDrop);
      document.removeEventListener('dragover', onDocDragOver);
    };
  }, [activeTab?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 保存/导出（作用于 activeTab）──
  const handleSave = async (): Promise<boolean> => {
    if (!activeTab) return false;
    const result: SaveResult = await saveDocument({
      markdown: activeTab.source,
      assets: assetsRef.current,
      sourceKind,
      filename: docBase,
      prevManifest,
      extraFiles,
      diskHandle: activeTab.diskHandle,
    });
    wire.onSaveResult(result.ok ? result.kind : null);
    if (result.ok) {
      setTabsState((s) => updateTab(s, activeTab.id, { dirty: false }));
    }
    return result.ok;
  };

  const handleExport = async (format: ExportFormat): Promise<boolean> => {
    if (!activeTab) return false;
    try {
      switch (format) {
        case 'md': {
          const ok = exportMd(activeTab.source, {
            hasImages: assetsRef.current.length > 0,
            filename: `${docBase}.md`,
          });
          wire.onExportResult(format, ok);
          return ok;
        }
        case 'mdpkg':
          downloadBlob(
            new Blob(
              [new Uint8Array(exportMdpkg({ markdown: activeTab.source, assets: assetsRef.current, prevManifest, extraFiles }))],
              { type: 'application/octet-stream' },
            ),
            `${docBase}.mdpkg`,
          );
          wire.onExportResult(format, true);
          return true;
        case 'html':
          downloadText(
            await buildHtmlDocument({ markdown: activeTab.source, assets: assetsRef.current, title: docTitle }),
            `${docBase}.html`,
          );
          wire.onExportResult(format, true);
          return true;
        case 'png': {
          const blob = await exportPngFromMarkdown({
            markdown: activeTab.source,
            assets: assetsRef.current,
          });
          downloadBlob(blob, `${docBase}.png`);
          wire.onExportResult(format, true);
          return true;
        }
      }
    } catch (e) {
      showExportError(e instanceof Error ? e.message : String(e));
      return false;
    }
  };

  const handleCopyImage = async (): Promise<boolean> => {
    if (!activeTab) return false;
    try {
      const { copied } = await shareCardAsImage({
        title: docTitle,
        markdown: activeTab.source,
        stats: shareStats,
        theme: 'dark',
      });
      return copied;
    } catch {
      return false;
    }
  };

  const canSave = !!activeTab;

  const openFeaturedExample = (example: { id: string; content: string; format: 'md' | 'mdpkg' }) => {
    if (example.format === 'md') {
      // 示例 = 新页签（决策 #27）
      const r = addTab(tabsState, { kind: 'md', name: `${example.id}.md`, source: example.content });
      setTabsState(r.state);
    }
  };

  // ── 页签操作 ──
  const handleTabSelect = (tabId: string) => {
    setTabsState((s) => setActiveTab(s, tabId));
  };

  const handleTabClose = (tabId: string) => {
    setTabsState((s) => removeTab(s, tabId));
  };

  return (
    <div className="min-h-screen scroll-smooth bg-[#0d1117] text-[#e6edf3]">
      {/* 页签条（任务 4.1）：有页签时显示 */}
      {!isEmpty && (
        <TabStrip
          tabs={tabsState.tabs}
          activeId={tabsState.activeId}
          onSelect={handleTabSelect}
          onClose={handleTabClose}
        />
      )}

      {/* 顶栏 v2：有文档时显示，empty 态隐藏 */}
      {!isEmpty && (
        <header className="border-b border-[#30363d] bg-[#161b22]/60">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-3">
            <h1 className="text-xl font-bold tracking-tight">MD-Bundle</h1>
            <Toolbar
              canSave={canSave}
              sourceKind={sourceKind}
              error={exportError}
              onSave={() => void handleSave()}
              onExport={(f) => void handleExport(f)}
              onCopyImage={() => void handleCopyImage()}
              currentMode={mode}
              onModeChange={setMode}
            />
          </div>
        </header>
      )}

      {/* empty 态：Landing 全页 */}
      {isEmpty && (
        <Landing onOpenExample={openFeaturedExample} />
      )}

      {/* 隐藏的 FileOpen：Landing CTA 通过 querySelector 触发 */}
      {isEmpty && (
        <div className="hidden">
          <FileOpen onOpenFile={(f) => void openFileObject(f)} compact={false} />
        </div>
      )}

      {/* 工作区 */}
      {!isEmpty && activeTab && (
        <main className="mx-auto max-w-6xl space-y-5 px-6 py-6">
          <section id="workspace" ref={workspaceRef} className="scroll-mt-6">
            <FileOpen onOpenFile={(f) => void openFileObject(f)} compact />
            {importHint && (
              <p role="status" aria-live="polite" className="mb-2 text-xs text-amber-400">
                {importHint}
              </p>
            )}

          {activeTab.kind === 'md' && (
            <section aria-label={`编辑 ${activeTab.name}`}>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-sm font-medium text-slate-200">{activeTab.name}</span>
                <span className="rounded bg-[#165DFF]/20 px-1.5 py-0.5 text-xs text-[#58a6ff]">
                  Markdown
                </span>
                <span className="ml-auto flex items-center gap-2">
                  <input
                    ref={imgInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    data-testid="import-images-input"
                    onChange={onImportChange}
                  />
                  <button
                    type="button"
                    onClick={() => imgInputRef.current?.click()}
                    data-testid="import-images-btn"
                    className="rounded-lg bg-[#165DFF] px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-[#3c7dff]"
                  >
                    导入图片
                  </button>
                  <ShareCard title={shareTitle} markdown={activeTab.source} stats={shareStats} />
                </span>
              </div>
            </section>
          )}

          {activeTab.kind === 'mdpkg' && (
            <section aria-label={`编辑 ${activeTab.name}`}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-slate-200">{activeTab.name}</span>
                <span className="rounded bg-[#165DFF]/20 px-1.5 py-0.5 text-xs text-[#58a6ff]">
                  .mdpkg
                </span>
                <span className="text-xs text-[#8b949e]">{(activeTab.mdpkgFiles ?? new Map()).size} 个资源</span>
                <span className="ml-auto flex items-center gap-2">
                  <ShareCard title={shareTitle} markdown={activeTab.source} stats={shareStats} />
                </span>
              </div>
              {activeTab.kind === 'mdpkg' && activeTab.validation && (
                <div className="mb-3">
                   <ValidationPanel
                     validation={activeTab.validation}
                     name={activeTab.name}
                   />
                </div>
              )}
            </section>
          )}

          {/* 工作区：三模式 + 左栏 + 大纲 */}
          <div className="flex h-[65vh] gap-0 overflow-hidden rounded-xl border border-[#30363d]">
             <LeftRail
               assets={activeTab.assets}
               documentText={activeTab.source}
               onDelete={handleDelete}
               onReplace={handleReplace}
               onOpenFile={(file, handle) => void openFileObject(file, handle)}
               activeTabName={activeTab.name}
             />

            <div
              data-testid="workspace-modes"
              className="relative min-w-0 flex-1 overflow-hidden"
              onPaste={onPaste}
              onDrop={onDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <OutlineMenu
                mode={mode}
                documentText={activeTab.source}
                editorView={editorViewRef.current}
                previewRef={previewRef}
              />

              <div
                data-testid="mode-pane-editor"
                style={{ display: mode === 'edit' || mode === 'source' ? 'block' : 'none' }}
                className="mdb-split-editor h-full"
              >
                <MarkdownEditor
                  value={activeTab.source}
                  onChange={handleEditorChange}
                  theme="dark"
                  extensions={SLASH_EXT}
                  decorations={DECORATIONS_EXT}
                  decorationsEnabled={mode === 'edit'}
                  onMount={onEditorMount}
                />
              </div>
              <div
                ref={previewRef}
                data-testid="mode-pane-preview"
                style={{ display: mode === 'preview' ? 'block' : 'none' }}
                className="mx-auto h-full max-w-[800px] overflow-auto bg-[#0d1117]"
              >
                <PreviewView markdown={activeTab.source} theme="dark" />
              </div>
            </div>
          </div>

          {activeTab.source.startsWith('错误：') && (
            <div role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-5">
              <p className="font-medium text-red-400">打开失败</p>
              <p className="mt-1 text-sm leading-relaxed text-red-200/90">
                {activeTab.source.replace('错误：', '')}
              </p>
              <button
                type="button"
                onClick={() => setTabsState((s) => removeTab(s, activeTab.id))}
                className="mt-4 rounded-lg bg-[#165DFF] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#3c7dff]"
              >
                重新选择
              </button>
            </div>
          )}
          </section>
        </main>
      )}

      {importHint && isEmpty && (
        <p role="status" aria-live="polite" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-[#161b22] px-4 py-2 text-sm text-amber-400 shadow-lg">
          {importHint}
        </p>
      )}

      {toast && <BadgeToast text={toast.text} rarity={toast.rarity} onDismiss={dismiss} />}
    </div>
  );
}
