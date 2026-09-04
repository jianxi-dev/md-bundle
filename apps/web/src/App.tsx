// MD-Bundle 应用外壳（任务 2.2：文件打开；任务 2.4：接线 ValidationPanel）。
// 状态机：empty → md（源码+预览分栏）| mdpkg（校验面板 + sandbox iframe 完整预览）| error（告警+重新选择）。
import { useEffect, useState } from 'react';
import { MarkdownEditor, MarkdownPreview } from '@md-bundle/editor';
import { FileOpen } from './components/FileOpen';
import { ValidationPanel } from './components/ValidationPanel';
import { useDocument } from './lib/useDocument';

export default function App() {
  const { state, open, clear } = useDocument();
  const [docValue, setDocValue] = useState('');

  // 新文档打开时把内容灌进受控的源码 value（编辑时实时同步到预览）。
  useEffect(() => {
    if (state.status === 'md') setDocValue(state.content);
  }, [state]);

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
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="h-[65vh] overflow-hidden rounded-xl border border-[#30363d]">
                <div className="mdb-split-editor h-full">
                  <MarkdownEditor value={docValue} onChange={setDocValue} theme="dark" />
                </div>
              </div>
              <div className="h-[65vh] overflow-auto rounded-xl border border-[#30363d] bg-[#0d1117]">
                <MarkdownPreview markdown={docValue} theme="dark" />
              </div>
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
