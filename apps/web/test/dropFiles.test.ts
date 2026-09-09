// dropFiles.ts 单元测试：.zip 解压找文档 + 文件夹遍历找文档（现代/旧版句柄）。
// 运行于 node 环境；dropFiles → openFile → mdpkg → vendored bundle 顶层引用 document，
// 必须先注入最小 stub 再动态 import（与 mdpkg.test.ts 同模式）。
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { makeZip } from './helpers/makeZip';

installDocumentStub();

const { extractDocFromDirectory, extractDocFromZip, getDirectoryHandle } = await import('../src/lib/dropFiles');

// ── mock 目录句柄 ──────────────────────────────────────────────

type MockHandle =
  | { kind: 'directory'; name: string; entries(): AsyncGenerator<[string, MockHandle]> }
  | { kind: 'file'; name: string; getFile(): Promise<File> };

const mockFile = (name: string, content: string): MockHandle => ({
  kind: 'file',
  name,
  getFile: async () => new File([content], name, { type: 'text/markdown' }),
});

const mockDir = (name: string, children: MockHandle[]): MockHandle => ({
  kind: 'directory',
  name,
  async *entries() {
    for (const c of children) yield [c.name, c];
  },
});

const modernDir = (h: MockHandle): FileSystemDirectoryHandle => h as unknown as FileSystemDirectoryHandle;

/** 旧版 webkit 目录条目（createReader 分批返回）。 */
const legacyDir = (children: Array<{ name: string; isFile: boolean; content?: string }>): FileSystemDirectoryEntry =>
  ({
    isDirectory: true,
    isFile: false,
    name: 'root',
    fullPath: '/root',
    filesystem: {} as FileSystem,
    createReader: () => ({
      readEntries: (success: (entries: FileSystemEntry[]) => void) => {
        success(
          children.map((c) =>
            c.isFile
              ? ({
                  isDirectory: false,
                  isFile: true,
                  name: c.name,
                  fullPath: `/root/${c.name}`,
                  filesystem: {} as FileSystem,
                  file: (cb: (f: File) => void) => cb(new File([c.content ?? ''], c.name)),
                } as unknown as FileSystemFileEntry)
              : ({
                  isDirectory: true,
                  isFile: false,
                  name: c.name,
                  fullPath: `/root/${c.name}`,
                  filesystem: {} as FileSystem,
                  createReader: () => ({ readEntries: (s: (e: FileSystemEntry[]) => void) => s([]) }),
                } as unknown as FileSystemDirectoryEntry),
          ),
        );
      },
    }),
  } as unknown as FileSystemDirectoryEntry);

// ── extractDocFromZip ──────────────────────────────────────────

describe('extractDocFromZip', () => {
  it('含 .md 的 zip → ok + 同名 File（type=text/markdown）', async () => {
    const zip = makeZip([{ name: 'notes/guide.md', content: '# 指南' }]);
    const file = new File([zip], 'bundle.zip', { type: 'application/zip' });
    const r = await extractDocFromZip(file);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.file.name).toBe('guide.md');
    expect(r.file.type).toBe('text/markdown');
    expect(await r.file.text()).toBe('# 指南');
  });

  it('根含 manifest.json → 原样透传（视为 .mdpkg）', async () => {
    const zip = makeZip([
      { name: 'manifest.json', content: '{"entrypoint":"document.md"}' },
      { name: 'document.md', content: '# 包' },
    ]);
    const file = new File([zip], 'pkg.zip', { type: 'application/zip' });
    const r = await extractDocFromZip(file);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.file).toBe(file);
  });

  it('无 .md/.mdpkg → { ok:false, message }', async () => {
    const zip = makeZip([{ name: 'a.txt', content: 'x' }]);
    const file = new File([zip], 'b.zip', { type: 'application/zip' });
    const r = await extractDocFromZip(file);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toContain('未找到');
  });

  it('非 ZIP 字节 → { ok:false, message }（不抛出）', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'bad.zip', { type: 'application/zip' });
    const r = await extractDocFromZip(file);
    expect(r.ok).toBe(false);
  });
});

// ── getDirectoryHandle ─────────────────────────────────────────

describe('getDirectoryHandle', () => {
  it('现代 getAsFileSystemHandle 返回目录 → 目录句柄', async () => {
    const item = {
      kind: 'directory',
      getAsFileSystemHandle: async () => modernDir(mockDir('d', [])),
    } as unknown as DataTransferItem;
    const h = await getDirectoryHandle(item);
    expect(h).not.toBeNull();
  });

  it('返回文件句柄 → null', async () => {
    const item = {
      kind: 'file',
      getAsFileSystemHandle: async () => mockFile('a.md', 'x') as unknown as FileSystemHandle,
    } as unknown as DataTransferItem;
    const h = await getDirectoryHandle(item);
    expect(h).toBeNull();
  });

  it('getAsFileSystemHandle 抛错 → null（不抛出）', async () => {
    const item = {
      kind: 'directory',
      getAsFileSystemHandle: async () => {
        throw new Error('denied');
      },
    } as unknown as DataTransferItem;
    const h = await getDirectoryHandle(item);
    expect(h).toBeNull();
  });

  it('无现代 API → webkitGetAsEntry 兜底', async () => {
    const item = {
      kind: 'directory',
      webkitGetAsEntry: () => legacyDir([]),
    } as unknown as DataTransferItem;
    const h = await getDirectoryHandle(item);
    expect(h).not.toBeNull();
  });

  it('webkitGetAsEntry 返回文件 → null', async () => {
    const item = {
      kind: 'file',
      webkitGetAsEntry: () =>
        ({ isDirectory: false, isFile: true, name: 'a.md' }) as unknown as FileSystemEntry,
    } as unknown as DataTransferItem;
    const h = await getDirectoryHandle(item);
    expect(h).toBeNull();
  });
});

// ── extractDocFromDirectory ────────────────────────────────────

describe('extractDocFromDirectory', () => {
  it('现代句柄：根优先找到 .md', async () => {
    const dir = mockDir('root', [
      mockFile('readme.md', '# 根文档'),
      mockDir('sub', [mockFile('deep.md', '# 深层')]),
    ]);
    const r = await extractDocFromDirectory(modernDir(dir));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.file.name).toBe('readme.md');
    expect(await r.file.text()).toBe('# 根文档');
  });

  it('现代句柄：根无 .md → 递归子目录找到', async () => {
    const dir = mockDir('root', [
      mockFile('a.txt', 'x'),
      mockDir('sub', [mockFile('deep.md', '# 深层')]),
    ]);
    const r = await extractDocFromDirectory(modernDir(dir));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.file.name).toBe('deep.md');
  });

  it('深度超过 3 → 找不到（返回错误而非崩溃）', async () => {
    let leaf: MockHandle = mockFile('too-deep.md', '# 太深');
    for (let i = 0; i < 5; i++) leaf = mockDir(`d${i}`, [leaf]);
    const r = await extractDocFromDirectory(modernDir(leaf));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toContain('未找到');
  });

  it('条目超过 200 → 停止遍历（返回错误而非崩溃）', async () => {
    const children: MockHandle[] = [];
    for (let i = 0; i < 250; i++) children.push(mockFile(`f${i}.txt`, 'x'));
    children.push(mockFile('found.md', '# 找到'));
    const r = await extractDocFromDirectory(modernDir(mockDir('root', children)));
    expect(r.ok).toBe(false);
  });

  it('旧版 webkit 句柄：createReader 找到 .md', async () => {
    const dir = legacyDir([
      { name: 'a.txt', isFile: true, content: 'x' },
      { name: 'doc.md', isFile: true, content: '# 旧版' },
    ]);
    const r = await extractDocFromDirectory(dir);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.file.name).toBe('doc.md');
    expect(await r.file.text()).toBe('# 旧版');
  });

  it('目录为空 / 无文档 → { ok:false, message }', async () => {
    const r = await extractDocFromDirectory(modernDir(mockDir('root', [mockFile('a.txt', 'x')])));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toContain('未找到');
  });
});

/** 最小 document stub：仅满足 vendored bundle 顶层 decodeNamedCharacterReference 的 createElement 调用 */
function installDocumentStub(): void {
  if (typeof globalThis.document !== 'undefined') return;
  const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };
  globalThis.document = {
    createElement: () => {
      let html = '';
      return {
        set innerHTML(v: string) {
          html = String(v);
        },
        get innerHTML() {
          return html;
        },
        get textContent() {
          return html.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, name: string) => {
            if (name[0] === '#') {
              const code =
                name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
              return Number.isFinite(code) ? String.fromCodePoint(code) : m;
            }
            return ENT[name] ?? m;
          });
        },
      };
    },
  } as unknown as Document;
}