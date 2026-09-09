// 资源页签面板 —— 左栏「资源」页签视图，供 2.4 LeftRail 承载。
// 从 AssetList 迁移：保留 data-testid="asset-list" 兼容既有 spec，
// 新增孤儿（orphan）黄色标记 + 孤儿数统计。每次渲染根据 documentText 实时计算孤儿。
import { useMemo, useRef } from 'react'
import { computeOrphans, type Asset } from '../lib/assets'

export interface AssetPanelProps {
  assets: Asset[]
  documentText: string
  onDelete: (name: string) => void
  onReplace: (name: string, file: File) => void
}

export function AssetPanel({
  assets,
  documentText,
  onDelete,
  onReplace,
}: AssetPanelProps): JSX.Element {
  const orphans = useMemo(() => computeOrphans(assets, documentText), [assets, documentText])
  const orphanCount = orphans.size

  return (
    <aside
      className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/60 p-3"
      data-testid="asset-list"
      aria-label="资源清单"
    >
      <h2 className="mb-2 text-sm font-medium text-slate-200">
        资源清单 ({assets.length})
        {orphanCount > 0 && (
          <span className="ml-2 text-xs text-amber-400" data-testid="orphan-count">
            {orphanCount} 个未引用
          </span>
        )}
      </h2>
      {assets.length === 0 ? (
        <p className="text-xs leading-relaxed text-[var(--muted)]">
          粘贴 / 拖入图片后自动加入
        </p>
      ) : (
        <ul className="space-y-2">
          {assets.map((a) => (
            <AssetRow
              key={a.name}
              asset={a}
              isOrphan={orphans.has(a.name)}
              onDelete={onDelete}
              onReplace={onReplace}
            />
          ))}
        </ul>
      )}
    </aside>
  )
}

function AssetRow({
  asset,
  isOrphan,
  onDelete,
  onReplace,
}: {
  asset: Asset
  isOrphan: boolean
  onDelete: (name: string) => void
  onReplace: (name: string, file: File) => void
}): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  const kb = (asset.size / 1024).toFixed(1)

  return (
    <li
      className={`flex items-center gap-2 rounded-lg p-2 ${
        isOrphan ? 'bg-amber-500/10 ring-1 ring-amber-500/30' : 'bg-[var(--bg)]/60'
      }`}
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
        <p className="text-[10px] text-[var(--muted)]">
          {kb} KB
          {isOrphan && (
            <span className="ml-1 text-amber-400" data-testid={`orphan-badge-${asset.name}`}>
              · 未引用
            </span>
          )}
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        data-testid={`replace-input-${asset.name}`}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onReplace(asset.name, f)
          e.target.value = ''
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        data-testid={`replace-btn-${asset.name}`}
        className="rounded border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--muted)] transition-colors hover:border-[var(--muted)] hover:text-[var(--fg)]"
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
  )
}
