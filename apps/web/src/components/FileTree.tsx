// 文件树 UI（任务 22 + 23，Wave 5）—— 左栏文件页签填充。
// 渲染授权文件夹（递归目录句柄读取，只列 .md/.mdpkg/文件夹；懒展开；
// refresh 按钮手动重扫；v2 不做自动变更监听）。
// 点击 .md/.mdpkg = 新页签打开并持有 file handle（供保存回写）。
// 当前文档对应树节点高亮；无授权空态 + 「授权文件夹」CTA。
// 任务 23：文件树操作（新建 / 重命名 / 删除确认 / 拖拽复制）。
//
// 契约：永不 throw（IO 边界契约）；所有 FSA 操作经 lib/fsa.ts。
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  isFsaAvailable,
  grantWorkspaceFolder,
  loadWorkspaceHandle,
  persistWorkspaceHandle,
  requestReGrant,
} from '../lib/fsa'

// ── 全局类型补齐 ──────────────────────────────────────────────
// lib.dom 缺少 FileSystemDirectoryHandle 的 async iterable 接口（values()）。
declare global {
  interface FileSystemDirectoryHandle {
    values(): AsyncIterableIterator<FileSystemHandle>
    getDirectoryHandle(
      name: string,
      options?: { create?: boolean },
    ): Promise<FileSystemDirectoryHandle>
    getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>
    removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>
  }
  interface FileSystemFileHandle {
    createWritable(): Promise<FileSystemWritableFileStream>
    getFile(): Promise<File>
  }
}

// ── 类型 ──────────────────────────────────────────────────────

/** 树节点类型。 */
type TreeNode =
  | {
      kind: 'folder'
      name: string
      handle: FileSystemDirectoryHandle
      children: TreeNode[]
      loaded: boolean
    }
  | { kind: 'file'; name: string; handle: FileSystemFileHandle }

/** 文件树组件 props。 */
export interface FileTreeProps {
  /** 打开文件回调（文件句柄 → 调用方负责读内容 + 新增 tab + 持有 handle）。 */
  onOpenFile: (file: File, handle: FileSystemFileHandle) => void
  /** 当前活动页签文件名（高亮匹配节点）。 */
  activeTabName: string | null
}

/** 操作结果。 */
type OpResult = { ok: true } | { ok: false; error: string }

// ── 工具函数 ──────────────────────────────────────────────────

/** 文件名是否为目标类型（.md / .mdpkg）。 */
function isTargetFile(name: string): boolean {
  const lower = name.toLowerCase()
  return lower.endsWith('.md') || lower.endsWith('.mdpkg')
}

/** 排序比较器：文件夹优先，然后按名字母序。 */
function nodeCompare(a: TreeNode, b: TreeNode): number {
  if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1
  return a.name.localeCompare(b.name)
}

// ── 递归读取 ──────────────────────────────────────────────────

/**
 * 递归读取目录句柄，构建树节点。
 * 只包含 .md / .mdpkg 文件 + 文件夹（跳过其他文件）。
 * 文件夹的 children 初始为空（懒展开时加载）。
 */
async function readDirHandle(dir: FileSystemDirectoryHandle): Promise<TreeNode[]> {
  const nodes: TreeNode[] = []
  // FileSystemDirectoryHandle 是 async iterable（values()）。
  for await (const entry of dir.values()) {
    if (entry.kind === 'directory') {
      nodes.push({
        kind: 'folder',
        name: entry.name,
        handle: entry as FileSystemDirectoryHandle,
        children: [],
        loaded: false,
      })
    } else if (entry.kind === 'file' && isTargetFile(entry.name)) {
      nodes.push({
        kind: 'file',
        name: entry.name,
        handle: entry as FileSystemFileHandle,
      })
    }
  }
  nodes.sort(nodeCompare)
  return nodes
}

// ── 工具：节点图标 ────────────────────────────────────────────

/** 根据节点类型返回图标字符。 */
function getNodeIcon(isFolder: boolean, isExpanded: boolean, fileName: string): string {
  if (isFolder) return isExpanded ? '\u25BE' : '\u25B8'
  return fileName.toLowerCase().endsWith('.mdpkg') ? '\uD83D\uDCE6' : '\uD83D\uDCC4'
}

// ── 工具：查找节点及其父句柄 ──────────────────────────────────

/**
 * 在树中按路径查找节点及其父目录句柄。
 * 路径格式："folder/subfolder/name" 或 "name"（根级）。
 */
function findNodeWithParent(
  nodes: TreeNode[],
  targetName: string,
  parentHandle: FileSystemDirectoryHandle,
): { node: TreeNode; parent: FileSystemDirectoryHandle } | undefined {
  for (const n of nodes) {
    if (n.name === targetName) {
      return { node: n, parent: parentHandle }
    }
    if (n.kind === 'folder' && n.loaded) {
      const found = findNodeWithParent(n.children, targetName, n.handle)
      if (found) return found
    }
  }
  return undefined
}

// ── 删除确认弹窗 ──────────────────────────────────────────────

function DeleteConfirmDialog({
  fileName,
  onConfirm,
  onCancel,
}: {
  fileName: string
  onConfirm: () => void
  onCancel: () => void
}): JSX.Element {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-label="删除确认"
      data-testid="delete-confirm-dialog"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        ref={dialogRef}
        className="w-80 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl"
      >
        <h3 className="text-sm font-medium text-[var(--fg)]">确认删除</h3>
        <p className="mt-3 text-sm text-[var(--muted)]">
          确定要删除 <span className="font-medium text-[var(--fg)]">{fileName}</span> 吗？
        </p>
        <p className="mt-2 rounded bg-amber-500/10 px-2 py-1.5 text-sm text-amber-400">
          此操作不可撤销，文件将直接删除，不进回收站
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            data-testid="delete-confirm-cancel"
            className="rounded px-3 py-1.5 text-sm text-[var(--muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--fg)]"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            data-testid="delete-confirm-ok"
            className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            删除
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 重命名输入弹窗 ────────────────────────────────────────────

function RenameDialog({
  currentName,
  onConfirm,
  onCancel,
}: {
  currentName: string
  onConfirm: (newName: string) => void
  onCancel: () => void
}): JSX.Element {
  const [name, setName] = useState(currentName)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter' && name.trim() && name !== currentName) {
        onConfirm(name.trim())
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [currentName, name, onCancel, onConfirm])

  const isValid = name.trim().length > 0 && name !== currentName

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-label="重命名"
      data-testid="rename-dialog"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="w-80 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl">
        <h3 className="text-sm font-medium text-[var(--fg)]">重命名</h3>
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          data-testid="rename-input"
          className="mt-3 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm text-[var(--fg)] outline-none focus:border-[var(--accent)]"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            data-testid="rename-cancel"
            className="rounded px-3 py-1.5 text-sm text-[var(--muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--fg)]"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => {
              if (isValid) onConfirm(name.trim())
            }}
            disabled={!isValid}
            data-testid="rename-ok"
            className="rounded bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-fill-hover)] disabled:opacity-50"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 新建文件/文件夹弹窗 ──────────────────────────────────────

function NewItemDialog({
  mode,
  onConfirm,
  onCancel,
}: {
  mode: 'file' | 'folder'
  onConfirm: (name: string) => void
  onCancel: () => void
}): JSX.Element {
  const [name, setName] = useState(mode === 'file' ? 'untitled.md' : '新建文件夹')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter' && name.trim()) {
        onConfirm(name.trim())
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [mode, name, onCancel, onConfirm])

  const isValid = name.trim().length > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'file' ? '新建文件' : '新建文件夹'}
      data-testid="new-item-dialog"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="w-80 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl">
        <h3 className="text-sm font-medium text-[var(--fg)]">
          {mode === 'file' ? '新建文件' : '新建文件夹'}
        </h3>
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          data-testid="new-item-input"
          className="mt-3 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm text-[var(--fg)] outline-none focus:border-[var(--accent)]"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            data-testid="new-item-cancel"
            className="rounded px-3 py-1.5 text-sm text-[var(--muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--fg)]"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => {
              if (isValid) onConfirm(name.trim())
            }}
            disabled={!isValid}
            data-testid="new-item-ok"
            className="rounded bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-fill-hover)] disabled:opacity-50"
          >
            创建
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 单节点组件 ────────────────────────────────────────────────

function TreeItem({
  node,
  depth,
  activeTabName,
  expandedFolders,
  onToggleFolder,
  onOpenFile,
  onRename,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  node: TreeNode
  depth: number
  activeTabName: string | null
  expandedFolders: Set<string>
  onToggleFolder: (handle: FileSystemDirectoryHandle, path: string) => void
  onOpenFile: (file: File, handle: FileSystemFileHandle) => void
  onRename: (node: TreeNode) => void
  onDelete: (node: TreeNode) => void
  onDragStart: (e: React.DragEvent, node: TreeNode) => void
  onDragOver: (e: React.DragEvent, node: TreeNode) => void
  onDrop: (e: React.DragEvent, node: TreeNode) => void
  onDragEnd: (e: React.DragEvent) => void
}): JSX.Element {
  const isFolder = node.kind === 'folder'
  const isExpanded = expandedFolders.has(node.name)
  const isHighlighted = !isFolder && node.name === activeTabName
  const [hovered, setHovered] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  const handleClick = async () => {
    if (isFolder) {
      onToggleFolder(node.handle, node.name)
    } else {
      const file = await node.handle.getFile()
      onOpenFile(file, node.handle)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    if (isFolder) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      setIsDragOver(true)
      onDragOver(e, node)
    }
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    setIsDragOver(false)
    if (isFolder) {
      e.preventDefault()
      onDrop(e, node)
    }
  }

  return (
    <div>
      <div
        role="treeitem"
        aria-expanded={isFolder ? isExpanded : undefined}
        aria-selected={isHighlighted}
        tabIndex={0}
        draggable
        onDragStart={(e) => onDragStart(e, node)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onDragEnd={onDragEnd}
        className={`group flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-sm transition-colors ${
          isDragOver
            ? 'bg-[var(--accent)]/20 ring-1 ring-[var(--accent)]'
            : isHighlighted
              ? 'bg-[var(--accent)]/20 text-[var(--accent-bright)]'
              : 'text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--fg)]'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            void handleClick()
          }
        }}
        data-testid={isFolder ? `tree-folder-${node.name}` : `tree-file-${node.name}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <span className="w-4 shrink-0 text-center" aria-hidden>
          {getNodeIcon(isFolder, isExpanded, node.name)}
        </span>
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
        {/* 操作按钮（hover 显示） */}
        {hovered && (
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onRename(node)
              }}
              className="rounded p-0.5 text-[var(--muted)] hover:bg-[var(--border)] hover:text-[var(--fg)]"
              title="重命名"
              data-testid={`tree-rename-${node.name}`}
              aria-label={`重命名 ${node.name}`}
            >
              ✎
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(node)
              }}
              className="rounded p-0.5 text-[var(--muted)] hover:bg-[var(--border)] hover:text-red-400"
              title="删除"
              data-testid={`tree-delete-${node.name}`}
              aria-label={`删除 ${node.name}`}
            >
              ✕
            </button>
          </div>
        )}
      </div>
      {isFolder && isExpanded && (
        <div role="group">
          {node.children.length === 0 ? (
            <div
              className="py-1 text-sm text-[#484f58]"
              style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
            >
              空文件夹
            </div>
          ) : (
            node.children.map((child) => (
              <TreeItem
                key={`${node.name}/${child.name}`}
                node={child}
                depth={depth + 1}
                activeTabName={activeTabName}
                expandedFolders={expandedFolders}
                onToggleFolder={onToggleFolder}
                onOpenFile={onOpenFile}
                onRename={onRename}
                onDelete={onDelete}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDrop={onDrop}
                onDragEnd={onDragEnd}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── 主组件 ────────────────────────────────────────────────────

export function FileTree({ onOpenFile, activeTabName }: FileTreeProps): JSX.Element {
  const [rootHandle, setRootHandle] = useState<FileSystemDirectoryHandle | null>(null)
  const [tree, setTree] = useState<TreeNode[]>([])
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fsaReady = isFsaAvailable()

  // 任务 23：操作弹窗状态
  const [deleteTarget, setDeleteTarget] = useState<TreeNode | null>(null)
  const [renameTarget, setRenameTarget] = useState<TreeNode | null>(null)
  const [newItemMode, setNewItemMode] = useState<'file' | 'folder' | null>(null)

  // ── 加载已持久化的工作区句柄 ──
  useEffect(() => {
    if (!fsaReady) return
    void (async () => {
      const result = await loadWorkspaceHandle()
      if (result.ok) {
        setRootHandle(result.handle)
        await loadTree(result.handle)
      }
      // empty → 首次访问，不报错
      // error → 显示降级提示
      else if ('error' in result && result.error === 'load-failed') {
        setError('无法读取已保存的工作区，请重新授权。')
      }
    })()
  }, [fsaReady])

  // ── 加载树 ──
  const loadTree = async (handle: FileSystemDirectoryHandle) => {
    setLoading(true)
    setError(null)
    try {
      const nodes = await readDirHandle(handle)
      setTree(nodes)
    } catch {
      setError('读取文件夹失败，可能权限已失效。')
    } finally {
      setLoading(false)
    }
  }

  // ── 授权文件夹 ──
  const handleGrant = async () => {
    setError(null)
    const result = await grantWorkspaceFolder()
    if (result.ok) {
      setRootHandle(result.handle)
      // 持久化句柄（重入免二次授权）
      await persistWorkspaceHandle(result.handle)
      await loadTree(result.handle)
    } else if (result.error === 'cancelled') {
      // 用户取消 → 静默
    } else if (result.error === 'permission-denied') {
      setError('权限被拒绝，请允许访问文件夹。')
    } else if (result.error === 'unavailable') {
      setError('当前浏览器不支持文件夹访问。')
    }
  }

  // ── 刷新 ──
  const handleRefresh = useCallback(async () => {
    if (!rootHandle) return
    // 续权后重扫
    const reGrant = await requestReGrant(rootHandle)
    if (!reGrant.ok) {
      setError('权限已失效，请重新授权。')
      return
    }
    await loadTree(rootHandle)
  }, [rootHandle])

  // ── 文件夹懒展开 ──
  const handleToggleFolder = useCallback(
    async (handle: FileSystemDirectoryHandle, path: string) => {
      setExpandedFolders((prev) => {
        const next = new Set(prev)
        if (next.has(path)) {
          next.delete(path)
        } else {
          next.add(path)
        }
        return next
      })

      // 如果首次展开，加载子节点
      const loadChildren = async () => {
        const findNode = (nodes: TreeNode[]): TreeNode | undefined => {
          for (const n of nodes) {
            if (n.kind === 'folder' && n.name === path) return n
            if (n.kind === 'folder' && n.loaded) {
              const found = findNode(n.children)
              if (found) return found
            }
          }
          return undefined
        }
        const target = findNode(tree)
        if (!target || target.kind !== 'folder' || target.loaded) return

        try {
          const children = await readDirHandle(handle)
          target.children = children
          target.loaded = true
          setTree((prev) => [...prev])
        } catch {
          // 展开失败 → 静默
        }
      }
      await loadChildren()
    },
    [tree],
  )

  // ── 任务 23：新建文件/文件夹 ──
  const handleNewItem = useCallback(
    async (name: string): Promise<OpResult> => {
      if (!rootHandle) return { ok: false, error: '未授权工作区' }
      try {
        if (newItemMode === 'folder') {
          await rootHandle.getDirectoryHandle(name, { create: true })
        } else {
          const fileHandle = await rootHandle.getFileHandle(name, { create: true })
          const writable = await fileHandle.createWritable()
          await writable.write('')
          await writable.close()
        }
        await loadTree(rootHandle)
        return { ok: true }
      } catch (e) {
        const msg = e instanceof Error ? e.message : '创建失败'
        return { ok: false, error: msg }
      }
    },
    [rootHandle, newItemMode],
  )

  // ── 任务 23：重命名（copy + delete 模式） ──
  const handleRename = useCallback(
    async (newName: string): Promise<OpResult> => {
      if (!rootHandle || !renameTarget) return { ok: false, error: '无效操作' }
      try {
        const target = renameTarget
        const lookup = findNodeWithParent(tree, target.name, rootHandle)
        if (!lookup) return { ok: false, error: '未找到目标' }

        if (target.kind === 'file') {
          // 复制内容到新文件
          const oldFile = await target.handle.getFile()
          const newHandle = await lookup.parent.getFileHandle(newName, { create: true })
          const writable = await newHandle.createWritable()
          await writable.write(await oldFile.arrayBuffer())
          await writable.close()
          // 删除旧文件
          await lookup.parent.removeEntry(target.name)
        } else {
          // 文件夹：递归复制
          const newDirHandle = await lookup.parent.getDirectoryHandle(newName, { create: true })
          await copyDirContents(target.handle, newDirHandle)
          // 删除旧文件夹（recursive）
          await lookup.parent.removeEntry(target.name, { recursive: true })
        }
        await loadTree(rootHandle)
        return { ok: true }
      } catch (e) {
        const msg = e instanceof Error ? e.message : '重命名失败'
        return { ok: false, error: msg }
      }
    },
    [rootHandle, renameTarget, tree],
  )

  // ── 任务 23：删除 ──
  const handleDelete = useCallback(async (): Promise<OpResult> => {
    if (!rootHandle || !deleteTarget) return { ok: false, error: '无效操作' }
    try {
      const target = deleteTarget
      const lookup = findNodeWithParent(tree, target.name, rootHandle)
      if (!lookup) return { ok: false, error: '未找到目标' }

      if (target.kind === 'folder') {
        await lookup.parent.removeEntry(target.name, { recursive: true })
      } else {
        await lookup.parent.removeEntry(target.name)
      }
      await loadTree(rootHandle)
      return { ok: true }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '删除失败'
      return { ok: false, error: msg }
    }
  }, [rootHandle, deleteTarget, tree])

  // ── 任务 23：拖拽复制 ──
  const handleDragStart = useCallback((e: React.DragEvent, node: TreeNode) => {
    e.dataTransfer.setData('text/plain', node.name)
    e.dataTransfer.effectAllowed = 'copy'
  }, [])

  const handleDragOver = useCallback((_e: React.DragEvent, _node: TreeNode) => {
    // 视觉反馈由 TreeItem 内部处理
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent, targetNode: TreeNode) => {
      if (!rootHandle) return
      if (targetNode.kind !== 'folder') return

      const sourceName = e.dataTransfer.getData('text/plain')
      if (!sourceName || sourceName === targetNode.name) return

      try {
        // 查找源节点
        const sourceLookup = findNodeWithParent(tree, sourceName, rootHandle)
        if (!sourceLookup) {
          setError('未找到源文件')
          return
        }

        if (sourceLookup.node.kind === 'file') {
          // 复制文件到目标文件夹
          const file = await sourceLookup.node.handle.getFile()
          const newHandle = await targetNode.handle.getFileHandle(sourceName, { create: true })
          const writable = await newHandle.createWritable()
          await writable.write(await file.arrayBuffer())
          await writable.close()
        } else {
          // 复制文件夹到目标
          const newDirHandle = await targetNode.handle.getDirectoryHandle(sourceName, {
            create: true,
          })
          await copyDirContents(sourceLookup.node.handle, newDirHandle)
        }
        await loadTree(rootHandle)
      } catch (err) {
        const msg = err instanceof Error ? err.message : '复制失败'
        setError(msg)
      }
    },
    [rootHandle, tree],
  )

  const handleDragEnd = useCallback((_e: React.DragEvent) => {
    // 清理拖拽状态
  }, [])

  // ── 空态：无 FSA 或未授权 ──
  if (!fsaReady) {
    return (
      <div
        className="flex flex-col items-center justify-center py-8 text-center"
        data-testid="filetree-unavailable"
      >
<p className="text-sm leading-relaxed text-[var(--muted)]">当前浏览器不支持文件夹访问</p>
<p className="mt-1 text-sm text-[#484f58]">请使用 Chromium 内核浏览器</p>
      </div>
    )
  }

  if (!rootHandle) {
    return (
      <div
        className="flex flex-col items-center justify-center py-8 text-center"
        data-testid="filetree-empty"
      >
<p className="text-sm leading-relaxed text-[var(--muted)]">授权文件夹后可浏览文件</p>
<p className="mt-1 text-sm text-[#484f58]">支持桌面/文档等位置，可随时撤销</p>
        <button
          type="button"
          onClick={() => void handleGrant()}
          data-testid="filetree-grant-btn"
          className="mt-3 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-fill-hover)]"
        >
          授权文件夹
        </button>
      </div>
    )
  }

  // ── 树渲染 ──
  return (
    <div className="flex flex-col" data-testid="filetree">
      {/* 工具栏：新建 + 刷新 */}
      <div className="mb-2 flex items-center gap-1">
        <span className="truncate text-sm font-medium text-[var(--fg)]">{rootHandle.name}</span>
        <button
          type="button"
          onClick={() => setNewItemMode('file')}
          disabled={loading}
          data-testid="tree-new-file-btn"
          className="ml-auto rounded p-1 text-[var(--muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--fg)] disabled:opacity-50"
          title="新建文件"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
            <path d="M12 18v-6" />
            <path d="M9 15h6" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => setNewItemMode('folder')}
          disabled={loading}
          data-testid="tree-new-folder-btn"
          className="rounded p-1 text-[var(--muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--fg)] disabled:opacity-50"
          title="新建文件夹"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <path d="M12 11v6" />
            <path d="M9 14h6" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={loading}
          data-testid="filetree-refresh-btn"
          className="rounded p-1 text-[var(--muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--fg)] disabled:opacity-50"
          title="刷新"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <path d="M21 3v6h-6" />
          </svg>
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div
          className="mb-2 rounded bg-red-500/10 px-2 py-1 text-sm text-red-400"
          role="alert"
          data-testid="filetree-error"
        >
          {error}
        </div>
      )}

      {/* 加载中 */}
      {loading ? (
        <div className="py-4 text-center text-sm text-[#484f58]" data-testid="filetree-loading">
          加载中…
        </div>
      ) : tree.length === 0 ? (
        <div className="py-4 text-center text-sm text-[#484f58]">文件夹为空</div>
      ) : (
        <div role="tree" aria-label="文件树" className="overflow-auto">
          {tree.map((node) => (
            <TreeItem
              key={node.name}
              node={node}
              depth={0}
              activeTabName={activeTabName}
              expandedFolders={expandedFolders}
              onToggleFolder={(handle, path) => void handleToggleFolder(handle, path)}
              onOpenFile={onOpenFile}
              onRename={(n) => setRenameTarget(n)}
              onDelete={(n) => setDeleteTarget(n)}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
            />
          ))}
        </div>
      )}

      {/* 任务 23：操作弹窗 */}
      {deleteTarget && (
        <DeleteConfirmDialog
          fileName={deleteTarget.name}
          onConfirm={() => {
            void (async () => {
              const result = await handleDelete()
              if (!result.ok) setError(result.error)
              setDeleteTarget(null)
            })()
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {renameTarget && (
        <RenameDialog
          currentName={renameTarget.name}
          onConfirm={(newName) => {
            void (async () => {
              const result = await handleRename(newName)
              if (!result.ok) setError(result.error)
              setRenameTarget(null)
            })()
          }}
          onCancel={() => setRenameTarget(null)}
        />
      )}

      {newItemMode && (
        <NewItemDialog
          mode={newItemMode}
          onConfirm={(name) => {
            void (async () => {
              const result = await handleNewItem(name)
              if (!result.ok) setError(result.error)
              setNewItemMode(null)
            })()
          }}
          onCancel={() => setNewItemMode(null)}
        />
      )}
    </div>
  )
}

// ── 任务 23：递归复制文件夹内容 ──────────────────────────────

/**
 * 递归复制源目录内容到目标目录。
 * 用于重命名文件夹和拖拽复制文件夹。
 */
async function copyDirContents(
  source: FileSystemDirectoryHandle,
  target: FileSystemDirectoryHandle,
): Promise<void> {
  for await (const entry of source.values()) {
    if (entry.kind === 'file') {
      const file = await (entry as FileSystemFileHandle).getFile()
      const newHandle = await target.getFileHandle(entry.name, { create: true })
      const writable = await newHandle.createWritable()
      await writable.write(await file.arrayBuffer())
      await writable.close()
    } else if (entry.kind === 'directory') {
      const newDir = await target.getDirectoryHandle(entry.name, { create: true })
      await copyDirContents(entry as FileSystemDirectoryHandle, newDir)
    }
  }
}
