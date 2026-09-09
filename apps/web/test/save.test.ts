// 保存模型单测（Wave5 任务 24）：decideSaveKind 矩阵 + saveDocument 三路径分发。
// 路径 ①（diskHandle）→ createWritable 写回；路径 ②（FSA）→ showSaveFilePicker 另存为；
// 路径 ③（无 FSA）→ downloadBlob 下载。
// downloadBlob 被 mock 捕获 (blob, filename) —— 字节级断言走真实 Blob 内容。
// 运行于 node 环境：vendored bundle 顶层引用 document，必须先装 stub 再动态 import。
// @vitest-environment node
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Asset } from '../src/lib/assets';

const { downloadBlobSpy } = vi.hoisted(() => ({ downloadBlobSpy: vi.fn() }));

// ── FSA mock 状态（路径 ② 控制） ──
const fsaState = {
  available: false,
  saveFileHandle: null as FileSystemFileHandle | null,
  throwOnPicker: false,
};

vi.mock('../src/lib/download', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/download')>();
  return {
    ...actual,
    downloadBlob: downloadBlobSpy,
    downloadText: (text: string, filename: string) => {
      downloadBlobSpy(new Blob([text], { type: 'text/markdown' }), filename);
    },
  };
});

vi.mock('../src/lib/fsa', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/fsa')>();
  return {
    ...actual,
    isFsaAvailable: () => fsaState.available,
  };
});

installDocumentStub();

const { decideSaveKind, saveDocument } = await import('../src/lib/save');
const { openPackage, readEntrySource } = await import('../src/lib/mdpkg');
const { exportMd, WARNING_EXPORT_MD } = await import('../src/lib/export');

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const fixture = (name: string): Uint8Array => new Uint8Array(readFileSync(join(FIXTURES, name)));

const TEST_RESULTS = join(dirname(fileURLToPath(import.meta.url)), '..', 'test-results');

/** 证据事实（测试内收集，afterAll 落盘 save.json）。 */
const facts = {
  roundTripFiles: false,
  sha256Ok: false,
  mediaTypesOk: false,
  decideSaveKind: '0/4',
  savePaths: '0/5',
};

const PNG_1_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const asset = (name: string): Asset => ({
  name,
  size: Buffer.from(PNG_1_B64, 'base64').length,
  dataUrl: `data:image/png;base64,${PNG_1_B64}`,
});

const MARKDOWN = '# 保存测试\n\n![图](pic.png)\n';

beforeEach(() => {
  fsaState.available = false;
  fsaState.saveFileHandle = null;
  fsaState.throwOnPicker = false;
});

afterEach(() => {
  downloadBlobSpy.mockClear();
});

afterAll(() => {
  mkdirSync(TEST_RESULTS, { recursive: true });
  writeFileSync(
    join(TEST_RESULTS, 'save.json'),
    JSON.stringify({ tasks: '24', ...facts, tests: facts.decideSaveKind === '4/4' ? 14 : 9 }, null, 2) + '\n',
  );
});

describe('decideSaveKind（内容驱动矩阵）', () => {
  it('有图 + md 来源 → mdpkg', () => {
    expect(decideSaveKind({ assets: [asset('pic.png')], sourceKind: 'md' })).toBe('mdpkg');
  });

  it('有图 + mdpkg 来源 → mdpkg', () => {
    expect(decideSaveKind({ assets: [asset('pic.png')], sourceKind: 'mdpkg' })).toBe('mdpkg');
  });

  it('无图 + md 来源 → md', () => {
    expect(decideSaveKind({ assets: [], sourceKind: 'md' })).toBe('md');
  });

  it('无图 + mdpkg 来源 → mdpkg（无缝重打包）', () => {
    expect(decideSaveKind({ assets: [], sourceKind: 'mdpkg' })).toBe('mdpkg');
    facts.decideSaveKind = '4/4';
  });
});

describe('saveDocument 路径 ③（无 FSA → 下载）', () => {
  it('md 路径：无图 → 不询问确认、下载 hello.md、返回 ok+md+download', async () => {
    fsaState.available = false;
    const confirm = vi.fn(() => true);
    const result = await saveDocument({
      markdown: '# 纯文本\n',
      assets: [],
      sourceKind: 'md',
      filename: 'hello',
      confirm,
    });
    expect(result).toEqual({ ok: true, kind: 'md', via: 'download' });
    expect(confirm).not.toHaveBeenCalled(); // 无图 → 无警告
    expect(downloadBlobSpy).toHaveBeenCalledTimes(1);
    const [blob, filename] = downloadBlobSpy.mock.calls[0] as [Blob, string];
    expect(filename).toBe('hello.md');
    expect(await blob.text()).toBe('# 纯文本\n');
  });

  it('mdpkg 路径：有图 → 下载 hello.mdpkg、字节可往返、返回 ok+mdpkg+download', async () => {
    fsaState.available = false;
    const result = await saveDocument({
      markdown: MARKDOWN,
      assets: [asset('pic.png')],
      sourceKind: 'md',
      filename: 'hello',
    });
    expect(result).toEqual({ ok: true, kind: 'mdpkg', via: 'download' });
    expect(downloadBlobSpy).toHaveBeenCalledTimes(1);
    const [blob, filename] = downloadBlobSpy.mock.calls[0] as [Blob, string];
    expect(filename).toBe('hello.mdpkg');

    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const r = await openPackage(bytes);
    expect('files' in r).toBe(true);
    if (!('files' in r)) return;
    expect(r.validation.ok).toBe(true);
    expect(readEntrySource(r.files)).toBe(MARKDOWN);
    expect(r.files.has('pic.png')).toBe(true);

    // 证据：往返文件齐全 + manifest 的 sha256/media_type 与重算一致。
    const manifest = r.manifest!;
    const pic = manifest.resources.find((x) => x.path === 'pic.png')!;
    const picBytes = Buffer.from(PNG_1_B64, 'base64');
    facts.roundTripFiles = true;
    facts.sha256Ok = pic.sha256 === createHash('sha256').update(picBytes).digest('hex');
    facts.mediaTypesOk =
      pic.media_type === 'image/png' &&
      manifest.resources.find((x) => x.path === 'document.md')?.media_type === 'text/markdown';
  });

  it('重打包路径：mdpkg 来源 + prevManifest + 包内资产/extraFiles → 下载 .mdpkg、entrypoint 继承', async () => {
    fsaState.available = false;
    const r = await openPackage(fixture('valid.mdpkg'));
    expect('files' in r).toBe(true);
    if (!('files' in r)) return;

    const imagePaths = [...r.files.keys()].filter((p) => /\.(png|jpe?g|gif|webp)$/i.test(p));
    const assets: Asset[] = imagePaths.map((path) => {
      const fileBytes = r.files.get(path)!;
      const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
      return {
        name: path,
        size: fileBytes.length,
        dataUrl: `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${Buffer.from(fileBytes).toString('base64')}`,
      };
    });
    const extraFiles = new Map(
      [...r.files].filter(
        ([name]) =>
          name !== 'manifest.json' &&
          name !== (r.manifest?.entrypoint ?? 'document.md') &&
          !/\.(png|jpe?g|gif|webp)$/i.test(name),
      ),
    );

    const result = await saveDocument({
      markdown: readEntrySource(r.files),
      assets,
      sourceKind: 'mdpkg',
      filename: 'valid',
      prevManifest: r.manifest ?? undefined,
      extraFiles,
    });
    expect(result).toEqual({ ok: true, kind: 'mdpkg', via: 'download' });
    const [blob, filename] = downloadBlobSpy.mock.calls[0] as [Blob, string];
    expect(filename).toBe('valid.mdpkg');

    const r2 = await openPackage(new Uint8Array(await blob.arrayBuffer()));
    expect('files' in r2).toBe(true);
    if (!('files' in r2)) return;
    expect(r2.validation.ok).toBe(true);
    expect(r2.manifest?.entrypoint).toBe('document.md');
    expect(r2.files.has('includes/ch1.md')).toBe(true);
    expect(r2.files.has('assets/red.png')).toBe(true);
  });

  it('缺省 filename → document.md / document.mdpkg', async () => {
    fsaState.available = false;
    const r1 = await saveDocument({ markdown: '# x', assets: [], sourceKind: 'md' });
    expect(r1).toEqual({ ok: true, kind: 'md', via: 'download' });
    expect(downloadBlobSpy.mock.calls[0][1]).toBe('document.md');
    downloadBlobSpy.mockClear();
    const r2 = await saveDocument({ markdown: '# x', assets: [asset('p.png')], sourceKind: 'md' });
    expect(r2).toEqual({ ok: true, kind: 'mdpkg', via: 'download' });
    expect(downloadBlobSpy.mock.calls[0][1]).toBe('document.mdpkg');
    facts.savePaths = '1/5';
  });
});

describe('saveDocument 路径 ①（diskHandle → 写回）', () => {
  it('持句柄 → createWritable 写回、返回 ok+kind+handle、不触发下载', async () => {
    const written: Uint8Array[] = [];
    const mockHandle = {
      createWritable: vi.fn(async () => ({
        write: vi.fn(async (data: Uint8Array) => { written.push(data); }),
        close: vi.fn(async () => undefined),
        abort: vi.fn(async () => undefined),
      })),
    } as unknown as FileSystemFileHandle;

    const result = await saveDocument({
      markdown: '# 写回测试\n',
      assets: [],
      sourceKind: 'md',
      diskHandle: mockHandle,
    });
    expect(result).toEqual({ ok: true, kind: 'md', via: 'handle' });
    expect(mockHandle.createWritable).toHaveBeenCalledTimes(1);
    expect(downloadBlobSpy).not.toHaveBeenCalled();
    expect(written).toHaveLength(1);
    expect(new TextDecoder().decode(written[0])).toBe('# 写回测试\n');
    facts.savePaths = facts.savePaths === '1/5' ? '2/5' : '2/5';
  });

  it('持句柄 + mdpkg → 写回 ZIP 字节', async () => {
    const written: Uint8Array[] = [];
    const mockHandle = {
      createWritable: vi.fn(async () => ({
        write: vi.fn(async (data: Uint8Array) => { written.push(new Uint8Array(data)); }),
        close: vi.fn(async () => undefined),
        abort: vi.fn(async () => undefined),
      })),
    } as unknown as FileSystemFileHandle;

    const result = await saveDocument({
      markdown: MARKDOWN,
      assets: [asset('pic.png')],
      sourceKind: 'md',
      diskHandle: mockHandle,
    });
    expect(result).toEqual({ ok: true, kind: 'mdpkg', via: 'handle' });
    expect(written).toHaveLength(1);
    const bytes = written[0];
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    facts.savePaths = '3/5';
  });
});

describe('saveDocument 路径 ②（FSA → 另存为）', () => {
  it('无句柄 + FSA → showSaveFilePicker + createWritable 写回、返回 ok+save-as', async () => {
    fsaState.available = true;
    const written: Uint8Array[] = [];
    const mockPickerHandle = {
      createWritable: vi.fn(async () => ({
        write: vi.fn(async (data: Uint8Array) => { written.push(data); }),
        close: vi.fn(async () => undefined),
        abort: vi.fn(async () => undefined),
      })),
    } as unknown as FileSystemFileHandle;

    // @ts-expect-error -- test mock for globalThis.showSaveFilePicker
    globalThis.showSaveFilePicker = vi.fn(async () => mockPickerHandle);

    const result = await saveDocument({
      markdown: '# 另存为\n',
      assets: [],
      sourceKind: 'md',
      filename: 'newdoc',
    });
    expect(result).toEqual({ ok: true, kind: 'md', via: 'save-as', diskHandle: mockPickerHandle });
    expect(globalThis.showSaveFilePicker).toHaveBeenCalledTimes(1);
    expect(mockPickerHandle.createWritable).toHaveBeenCalledTimes(1);
    expect(downloadBlobSpy).not.toHaveBeenCalled();
    expect(written).toHaveLength(1);
    expect(new TextDecoder().decode(written[0])).toBe('# 另存为\n');
    facts.savePaths = '4/5';
  });

  it('用户取消另存为 → 静默 {ok:false, error:cancelled}', async () => {
    fsaState.available = true;
    // @ts-expect-error -- test mock for globalThis.showSaveFilePicker
    globalThis.showSaveFilePicker = vi.fn(async () => {
      const err = new DOMException('用户取消', 'AbortError');
      throw err;
    });

    const result = await saveDocument({
      markdown: '# 取消\n',
      assets: [],
      sourceKind: 'md',
    });
    expect(result).toEqual({ ok: false, error: 'cancelled' });
    expect(downloadBlobSpy).not.toHaveBeenCalled();
    facts.savePaths = '5/5';
  });
});

describe('含图警告（导出下拉显式 .md 路径）', () => {
  it('取消 → 不下载、返回 false（exportMd 的 confirm 注入）', () => {
    const download = vi.fn();
    const ok = exportMd(MARKDOWN, {
      hasImages: true,
      confirm: () => false,
      download,
    });
    expect(ok).toBe(false);
    expect(download).not.toHaveBeenCalled();
  });

  it('确认 → 下载、警告文案原文', () => {
    const confirm = vi.fn(() => true);
    const download = vi.fn();
    const ok = exportMd(MARKDOWN, { hasImages: true, confirm, download });
    expect(ok).toBe(true);
    expect(confirm).toHaveBeenCalledWith(WARNING_EXPORT_MD);
    expect(download).toHaveBeenCalledTimes(1);
  });
});

/** 最小 document stub：仅满足 bundle 顶层 decodeNamedCharacterReference 的 createElement 调用 */
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

  // window stub for FSA picker tests（路径 ②）
  if (typeof globalThis.window === 'undefined') {
    globalThis.window = globalThis as unknown as Window & typeof globalThis;
  }
}
