// 官方示例 Gallery（任务 5.1）：静态示例清单 → 一键载入工作区。
// 点击 = fetch 静态资源 → new File(bytes, name) → onLoadExample(file)，
// 复用 App 的 open(file) 流程（与 FileOpen 同一入口），无需二次确认。
import { useState } from 'react';

export interface GalleryExample {
  id: string;
  name: string;
  desc: string;
  url: string;
  kind: 'md' | 'mdpkg';
}

/** 官方示例清单（public/examples/ 静态资源）。 */
export const GALLERY_EXAMPLES: GalleryExample[] = [
  {
    id: 'hello-md',
    name: 'Hello，Markdown',
    desc: '基础 Markdown：标题、表格、引用、代码块 —— 打开即编辑',
    url: 'examples/hello.md',
    kind: 'md',
  },
  {
    id: 'guide-md',
    name: '使用指南',
    desc: '三步完成一次图文分享：打开 → 导入图片 → 保存为 .mdpkg',
    url: 'examples/guide.md',
    kind: 'md',
  },
  {
    id: 'mdpkg-demo',
    name: '图文打包示例',
    desc: '.mdpkg 自包含包：Markdown + 内嵌图片，一个文件带走全部图文',
    url: 'examples/mdpkg-demo.mdpkg',
    kind: 'mdpkg',
  },
];

const KIND_LABEL: Record<GalleryExample['kind'], string> = {
  md: '.md',
  mdpkg: '.mdpkg',
};

export interface GalleryProps {
  /** 载入示例文件（App 侧：open(file) + 滚动到工作区）。 */
  onLoadExample: (file: File) => void;
}

export function Gallery({ onLoadExample }: GalleryProps): JSX.Element {
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadExample = async (ex: GalleryExample) => {
    setLoadError(null);
    try {
      const res = await fetch(ex.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const bytes = await res.arrayBuffer();
      const name = ex.url.slice(ex.url.lastIndexOf('/') + 1);
      const file = new File([bytes], name, {
        type: ex.kind === 'mdpkg' ? 'application/octet-stream' : 'text/markdown',
      });
      onLoadExample(file);
    } catch {
      setLoadError(`示例「${ex.name}」加载失败，请刷新后重试。`);
    }
  };

  return (
    <section data-testid="gallery" className="border-t border-[#30363d] bg-[#0d1117]">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <h2 className="text-xl font-bold tracking-tight text-white">官方示例</h2>
        <p className="mt-2 text-sm text-[#8b949e]">点击任意示例，一键载入上方工作区。</p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GALLERY_EXAMPLES.map((ex) => (
            <button
              key={ex.id}
              type="button"
              data-testid={`example-${ex.id}`}
              onClick={() => void loadExample(ex)}
              className="group rounded-xl border border-[#30363d] bg-[#161b22] p-5 text-left transition-colors hover:border-[#165DFF] hover:bg-[#165DFF]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#165DFF]"
            >
              <span className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-100 group-hover:text-white">
                  {ex.name}
                </span>
                <span className="rounded bg-[#165DFF]/20 px-1.5 py-0.5 text-xs text-[#58a6ff]">
                  {KIND_LABEL[ex.kind]}
                </span>
              </span>
              <span className="mt-2 block text-sm leading-relaxed text-[#8b949e]">{ex.desc}</span>
              <span className="mt-3 block text-xs text-[#58a6ff] opacity-0 transition-opacity group-hover:opacity-100">
                载入编辑器 →
              </span>
            </button>
          ))}
        </div>

        {loadError && (
          <p role="status" aria-live="polite" className="mt-4 text-sm text-amber-400">
            {loadError}
          </p>
        )}
      </div>
    </section>
  );
}