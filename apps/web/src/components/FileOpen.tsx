// 文件打开入口 —— 点击选择 + 拖拽放入，二合一 dropzone。
// 只负责「把文件交出去」（onOpenFile），类型检测 / 错误态收敛由 lib/openFile + useDocument 负责。
// 非文件拖放（文件夹、无文件）在此忽略并给出瞬时提示；真实错误走 App 的错误告警态。
import { useRef, useState } from 'react';

export interface FileOpenProps {
  /** 打开一个文件（异步结果由 useDocument 接管）。 */
  onOpenFile: (file: File) => void;
  /** 紧凑模式（文档已打开时收起成一行）。 */
  compact?: boolean;
}

const ACCEPT = '.md,.mdpkg';

export function FileOpen({ onOpenFile, compact = false }: FileOpenProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const dragDepth = useRef(0);

  const openPicker = () => {
    inputRef.current?.click();
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    try {
      onOpenFile(file);
    } catch {
      // 已由 lib/openFile 兜底；此处防御 onChange 冒出的意外异常（仍不白屏）。
      setHint('无法读取该文件，请重试。');
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragActive(false);

    const items = e.dataTransfer.items;
    if (items && items.length > 0 && Array.from(items).some((i) => i.kind === 'directory')) {
      setHint('不支持文件夹，请放入 .md 或 .mdpkg 文件。');
      return;
    }
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) {
      setHint('未检测到文件，请重试。');
      return;
    }
    setHint(null);
    handleFiles(files);
  };

  return (
    <div
      className="w-full"
      onDragOver={(e) => {
        e.preventDefault();
        dragDepth.current++;
        setDragActive(true);
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        dragDepth.current++;
        setDragActive(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        dragDepth.current--;
        if (dragDepth.current <= 0) {
          dragDepth.current = 0;
          setDragActive(false);
        }
      }}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        data-testid="file-input"
        onChange={(e) => {
          handleFiles(e.target.files);
          // 允许再次选择同一文件（重置 input value）
          e.target.value = '';
        }}
      />
      <button
        type="button"
        role="button"
        onClick={openPicker}
        className={`group w-full rounded-xl border-2 border-dashed text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#165DFF] ${
          dragActive
            ? 'border-[#165DFF] bg-[#165DFF]/10'
            : 'border-[#30363d] bg-[#161b22] hover:border-[#8b949e]'
        } ${compact ? 'px-4 py-2' : 'px-6 py-10'}`}
        data-testid="dropzone"
      >
        <div className={`flex items-center ${compact ? 'gap-3' : 'flex-col gap-3 text-center'}`}>
          <span className="text-2xl" aria-hidden>
            ⬇
          </span>
          <span className={compact ? 'text-sm text-slate-300' : ''}>
            <span className="font-medium text-slate-100">
              {compact ? '打开新文件' : '选择或拖入文件'}
            </span>
            <span className="text-slate-400">（.md / .mdpkg）</span>
          </span>
          {!compact && (
            <span className="text-sm text-slate-500">支持 Markdown 源码编辑与 .mdpkg 完整预览</span>
          )}
        </div>
      </button>
      {hint && (
        <p role="status" aria-live="polite" className="mt-2 text-sm text-amber-400">
          {hint}
        </p>
      )}
    </div>
  );
}
