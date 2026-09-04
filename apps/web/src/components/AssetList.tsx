// 资源清单侧栏 —— 纯展示 + 行内操作（替换/删除），无弹窗无向导。
// 每行：缩略图 + 文件名 + 大小(KB) + 替换（隐藏 file input 触发）+ 删除。
import { useRef } from 'react';
import type { Asset } from '../lib/assets';

export interface AssetListProps {
  assets: Asset[];
  /** 删除一个资源（App 侧同步清理文档引用）。 */
  onDelete: (name: string) => void;
  /** 同名替换字节（引用保持有效）。 */
  onReplace: (name: string, file: File) => void;
}

export function AssetList({ assets, onDelete, onReplace }: AssetListProps): JSX.Element {
  return (
    <aside
      className="rounded-xl border border-[#30363d] bg-[#161b22]/60 p-3"
      data-testid="asset-list"
      aria-label="资源清单"
    >
      <h2 className="mb-2 text-sm font-medium text-slate-200">资源清单 ({assets.length})</h2>
      {assets.length === 0 ? (
        <p className="text-xs leading-relaxed text-[#8b949e]">
          粘贴 / 拖入 / 选择图片后自动加入
        </p>
      ) : (
        <ul className="space-y-2">
          {assets.map((a) => (
            <AssetRow key={a.name} asset={a} onDelete={onDelete} onReplace={onReplace} />
          ))}
        </ul>
      )}
    </aside>
  );
}

function AssetRow({
  asset,
  onDelete,
  onReplace,
}: {
  asset: Asset;
  onDelete: (name: string) => void;
  onReplace: (name: string, file: File) => void;
}): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const kb = (asset.size / 1024).toFixed(1);

  return (
    <li
      className="flex items-center gap-2 rounded-lg bg-[#0d1117]/60 p-2"
      data-testid={`asset-${asset.name}`}
    >
      <img
        src={asset.dataUrl}
        alt={asset.name}
        className="h-10 w-10 shrink-0 rounded object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-slate-200" title={asset.name}>
          {asset.name}
        </p>
        <p className="text-[10px] text-[#8b949e]">{kb} KB</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        data-testid={`replace-input-${asset.name}`}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onReplace(asset.name, f);
          e.target.value = ''; // 允许重复选择同一文件
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        data-testid={`replace-btn-${asset.name}`}
        className="rounded border border-[#30363d] px-2 py-1 text-[11px] text-slate-300 transition-colors hover:border-[#8b949e] hover:text-slate-100"
      >
        替换
      </button>
      <button
        type="button"
        onClick={() => onDelete(asset.name)}
        data-testid={`delete-btn-${asset.name}`}
        className="rounded border border-red-500/30 px-2 py-1 text-[11px] text-red-400 transition-colors hover:border-red-500/60 hover:text-red-300"
      >
        删除
      </button>
    </li>
  );
}