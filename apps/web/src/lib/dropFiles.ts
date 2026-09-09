// 拖放文档分流（Bug 2/3/4）：.zip 解压找文档 + 文件夹遍历找文档。
// 契约：所有公开函数返回确定性 DropDocResult，绝不抛出。
// 目录遍历限制深度与条目数（防超大目录拖入卡死）。
import { extractZipDoc, parseZipIndex } from './zip';
import { readFileBytes } from './openFile';

// ── 全局类型补齐 ──────────────────────────────────────────────
// lib.dom 的 DataTransferItem 缺少 getAsFileSystemHandle（属 @types/wicg-file-system-access）。
declare global {
  interface DataTransferItem {
    getAsFileSystemHandle?(): Promise<FileSystemHandle | null>;
  }
}

/** 拖放文档处理结果（判别联合，永不 throw）。 */
export type DropDocResult =
  | { ok: true; file: File }
  | { ok: false; message: string };

/** 目录遍历上限：深度 3、条目 200（防超大目录拖入卡死）。 */
const MAX_DEPTH = 3;
const MAX_ENTRIES = 200;

/** 目录来源：现代 FileSystemDirectoryHandle 或旧版 webkit FileSystemDirectoryEntry。 */
export type DirSource = FileSystemDirectoryHandle | FileSystemDirectoryEntry;

/** 现代句柄的 entries() 迭代器（lib.dom 未声明，运行时存在）。 */
type ModernDirHandle = FileSystemDirectoryHandle & {
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
};

/** 目录条目（统一现代/旧版两种迭代接口）。 */
type DirEntry =
  | { kind: 'file'; name: string; getFile(): Promise<File> }
  | { kind: 'directory'; name: string; getDir(): DirSource };

function isModernDir(dir: DirSource): dir is ModernDirHandle {
  return typeof (dir as ModernDirHandle).entries === 'function';
}

/** 现代句柄迭代：entries() 异步迭代器。 */
async function* iterateModernDir(dir: ModernDirHandle): AsyncGenerator<DirEntry> {
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind === 'file') {
      const fh = handle as FileSystemFileHandle;
      yield { kind: 'file', name, getFile: () => fh.getFile() };
    } else {
      const dh = handle as FileSystemDirectoryHandle;
      yield { kind: 'directory', name, getDir: () => dh };
    }
  }
}

/** 旧版 webkit 迭代：createReader().readEntries 分批读取（空批 = 结束）。 */
async function* iterateLegacyDir(dir: FileSystemDirectoryEntry): AsyncGenerator<DirEntry> {
  const reader = dir.createReader();
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });
    if (batch.length === 0) break;
    for (const entry of batch) {
      if (entry.isFile) {
        const fe = entry as FileSystemFileEntry;
        yield {
          kind: 'file',
          name: entry.name,
          getFile: () => new Promise((resolve, reject) => fe.file(resolve, reject)),
        };
      } else if (entry.isDirectory) {
        const de = entry as FileSystemDirectoryEntry;
        yield { kind: 'directory', name: entry.name, getDir: () => de };
      }
    }
  }
}

/**
 * 解压 .zip 找文档：
 * - 根含 manifest.json → 视为 .mdpkg，原样透传（openFile 的 ZIP 魔数兜底按 mdpkg 打开）。
 * - 否则找第一个 .md/.mdpkg 条目 → 解压为同名 File。
 * - 解压失败 / 无文档 → { ok:false, message }。
 */
export async function extractDocFromZip(file: File): Promise<DropDocResult> {
  try {
    const bytes = await readFileBytes(file);
    const index = parseZipIndex(bytes);
    if (!index.ok) return { ok: false, message: `无法解压 ${file.name}：${index.error}` };
    if (index.entries.some((e) => e.name === 'manifest.json')) {
      return { ok: true, file };
    }
    const doc = await extractZipDoc(bytes);
    if (!doc) return { ok: false, message: '压缩包内未找到 .md / .mdpkg 文件' };
    return { ok: true, file: new File([doc.bytes.slice()], doc.name, { type: 'text/markdown' }) };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return { ok: false, message: `无法读取压缩包：${detail}` };
  }
}

/**
 * 从 DataTransferItem 获取目录句柄：
 * 现代 getAsFileSystemHandle → 旧版 webkitGetAsEntry 兜底；非目录 / 不可用 → null。
 */
export async function getDirectoryHandle(item: DataTransferItem): Promise<DirSource | null> {
  if (typeof item.getAsFileSystemHandle === 'function') {
    try {
      const handle = await item.getAsFileSystemHandle();
      if (handle && handle.kind === 'directory') return handle as FileSystemDirectoryHandle;
      return null;
    } catch {
      return null;
    }
  }
  const entry = item.webkitGetAsEntry?.();
  if (entry?.isDirectory) return entry as FileSystemDirectoryEntry;
  return null;
}

/**
 * 遍历目录（深度 ≤3、条目 ≤200，DFS 根优先）找第一个 .md/.mdpkg 文件。
 * 找不到 / 读取失败 → { ok:false, message }。
 */
export async function extractDocFromDirectory(dir: DirSource): Promise<DropDocResult> {
  const docs: File[] = [];
  let scanned = 0;

  const walk = async (d: DirSource, depth: number): Promise<void> => {
    if (docs.length > 0 || depth > MAX_DEPTH || scanned >= MAX_ENTRIES) return;
    const iter = isModernDir(d) ? iterateModernDir(d) : iterateLegacyDir(d as FileSystemDirectoryEntry);
    for await (const entry of iter) {
      if (docs.length > 0) return;
      scanned++;
      if (scanned > MAX_ENTRIES) return;
      if (entry.kind === 'file') {
        const lower = entry.name.toLowerCase();
        if (lower.endsWith('.md') || lower.endsWith('.mdpkg')) {
          try {
            docs.push(await entry.getFile());
          } catch {
            // 单个文件读取失败：跳过继续找下一个
          }
          return;
        }
      } else {
        await walk(entry.getDir(), depth + 1);
      }
    }
  };

  try {
    await walk(dir, 0);
  } catch {
    return { ok: false, message: '读取文件夹失败' };
  }
  if (docs.length === 0) return { ok: false, message: '文件夹内未找到 .md / .mdpkg 文件' };
  return { ok: true, file: docs[0] };
}