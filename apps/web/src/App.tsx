// MD-Bundle 应用外壳（任务 2.2：文件打开；任务 2.4：接线 ValidationPanel；任务 3.1：图片导入 + 资源清单）。
// 状态机：empty → md（源码+预览分栏+资源清单）| mdpkg（校验面板 + sandbox iframe 完整预览）| error（告警+重新选择）。
// 图片导入三通道（粘贴/拖拽/批量选择）只在 md 分支生效；.mdpkg 是只读预览，不接线。
import { useEffect, useRef, useState } from 'react';
import {
  MarkdownEditor,
  MarkdownPreview,
  type MarkdownEditorHandle,
} from '@md-bundle/editor';
import { FileOpen } from './components/FileOpen';
import { ValidationPanel } from './components/ValidationPanel';
import { AssetList } from './components/AssetList';
import { useDocument } from './lib/useDocument';
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

export default function App() {
  const { state, open, clear } = useDocument();
  const [docValue, setDocValue] = useState('');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [importHint, setImportHint] = useState<string | null>(null);
  // ref 镜像：事件处理器里读最新清单，避免闭包快照竞态（连续两次导入不互相覆盖）。
  const assetsRef = useRef<Asset[]>([]);
  const editorViewRef = useRef<MarkdownEditorHandle['view'] | null>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  // 新文档打开时把内容灌进受控的源码 value（编辑时实时同步到预览），并清空资源清单。
  useEffect(() => {
    if (state.status === 'md') setDocValue(state.content);
    assetsRef.current = [];
    setAssets([]);
    setImportHint(null);
  }, [state]);

  const onEditorMount = (handle: MarkdownEditorHandle) => {
    editorViewRef.current = handle.view;
  };

  /**
   * 图片入库 + 光标处插引用：
   * - 文档里已有 `![alt](name.png)` / `![alt](./name.png)` 的文件 → 自动接线，不重复插入；
   * - 其余文件 → 在光标处插入 `![name](name.png)`（与既有引用风格一致）。
   */
  const insertImages = async (files: File[]) => {
    if (files.length === 0) return;
    const { assets: converted, skipped } = await filesToAssets(files);
    const view = editorViewRef.current;
    const currentDoc = view ? view.state.doc.toString() : docValue;
    const { assets: next, additions, skipped: skippedDup } = addAssets(
      assetsRef.current,
      converted,
    );
    assetsRef.current = next;
    setAssets(next);

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
      } else {
        setDocValue((v) => v + insertText);
      }
    }

    const allSkipped = [...skipped, ...skippedDup];
    if (allSkipped.length > 0) {
      setImportHint(`已跳过超大图片（>15MB）：${allSkipped.join('、')}`);
    }
  };

  // 粘贴：只拦截图片；文本/其它粘贴原样放行（编辑器内容不受影响）。
  const onPaste = async (e: React.ClipboardEvent) => {
    const files = await imagesFromClipboard(e.clipboardData?.items);
    if (files.length === 0) return;
    e.preventDefault();
    void insertImages(files);
  };

  // 拖拽：图片 → 导入；其它（含 .md 文件）静默忽略。stopPropagation 防止冒泡到 FileOpen dropzone。
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    void (async () => {
      const files = await imagesFromDataTransfer(e.dataTransfer);
      if (files.length > 0) void insertImages(files);
    })();
  };

  const onImportChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) void insertImages(files);
    e.target.value = ''; // 允许重复选择同一文件
  };

  const handleDelete = (name: string) => {
    assetsRef.current = removeAsset(assetsRef.current, name);
    setAssets(assetsRef.current);
    // 同步移除文档里对该资源的引用（`![..](name.png)` / `![..](./name.png)`）。
    const view = editorViewRef.current;
    if (view) {
      const current = view.state.doc.toString();
      const next = stripReferences(current, name);
      if (next !== current) {
        view.dispatch({ changes: { from: 0, to: current.length, insert: next } });
      }
    }
  };

  const handleReplace = async (name: string, file: File) => {
    if (file.size > MAX_ASSET_BYTES) {
      setImportHint(`替换失败：${file.name} 超过 15MB 上限`);
      return;
    }
    const next = await replaceAsset(assetsRef.current, name, file);
    assetsRef.current = next;
    setAssets(next);
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#e6edf3]">
      <header className="border-b border-[#30363d] bg-[#161b22]/60">
        <div className="mx-auto flex max-w-6xl items-baseline gap-3 px-6 py-4">
          <h1 className="text-xl font-bold tracking-tight">MD-Bundle</h1>
          <p className="text-sm text-[#8b949e]">分享 Markdown，不再裂图。</p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-6 py-6">
        <FileOpen onOpenFile={(file) => void open(file)} compact={state.status !== 'empty'} />

        {state.status === 'empty' && (
          <p className="pt-10 text-center text-[#8b949e]">选择或拖入文件后，在此开始编辑 / 预览</p>
        )}

        {state.status === 'md' && (
          <section aria-label={`编辑 ${state.name}`}>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-sm font-medium text-slate-200">{state.name}</span>
              <span className="rounded bg-[#165DFF]/20 px-1.5 py-0.5 text-xs text-[#58a6ff]">
                Markdown
              </span>
              <span className="ml-auto">
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
              </span>
            </div>
            {importHint && (
              <p role="status" aria-live="polite" className="mb-2 text-xs text-amber-400">
                {importHint}
              </p>
            )}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_240px]">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div
                  className="mdb-editor-area h-[65vh] overflow-hidden rounded-xl border border-[#30363d]"
                  onPaste={onPaste}
                  onDrop={onDrop}
                  onDragOver={(e) => e.preventDefault()}
                >
                  <div className="mdb-split-editor h-full">
                    <MarkdownEditor
                      value={docValue}
                      onChange={setDocValue}
                      theme="dark"
                      onMount={onEditorMount}
                    />
                  </div>
                </div>
                <div className="h-[65vh] overflow-auto rounded-xl border border-[#30363d] bg-[#0d1117]">
                  <MarkdownPreview markdown={docValue} theme="dark" />
                </div>
              </div>
              <AssetList assets={assets} onDelete={handleDelete} onReplace={handleReplace} />
            </div>
          </section>
        )}

        {state.status === 'mdpkg' && (
          <section aria-label={`预览 ${state.name}`}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-slate-200">{state.name}</span>
              <span className="rounded bg-[#165DFF]/20 px-1.5 py-0.5 text-xs text-[#58a6ff]">
                .mdpkg
              </span>
              <span className="text-xs text-[#8b949e]">{state.files.size} 个资源</span>
            </div>
            <div className="mb-3">
              <ValidationPanel validation={state.validation} name={state.name} />
            </div>
            <iframe
              data-testid="mdpkg-frame"
              sandbox="allow-same-origin"
              srcDoc={state.html}
              title={state.name}
              className="h-[70vh] w-full rounded-xl border border-[#30363d] bg-white"
            />
          </section>
        )}

        {state.status === 'error' && (
          <div role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-5">
            <p className="font-medium text-red-400">打开失败</p>
            <p className="mt-1 text-sm leading-relaxed text-red-200/90">{state.message}</p>
            <button
              type="button"
              onClick={clear}
              className="mt-4 rounded-lg bg-[#165DFF] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#3c7dff]"
            >
              重新选择
            </button>
          </div>
        )}
      </main>
    </div>
  );
}