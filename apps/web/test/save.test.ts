// 保存路由单测（任务 4.1）：decideSaveKind 矩阵 + saveDocument 分发。
// downloadBlob 被 mock 捕获 (blob, filename) —— 字节级断言走真实 Blob 内容：
//   - md 路径：blob 文本与 markdown 一致、文件名 hello.md
//   - mdpkg 路径：blob 字节 → openPackage 往返（校验通过、内容一致）
//   - 重打包路径：sourceKind=mdpkg + prevManifest → entrypoint 继承
// 含图警告的取消/不下载分支由 exportMd 的 confirm 注入直接断言（saveDocument 的
// md 路径因内容驱动路由永远无图，警告只在导出下拉的显式 .md 导出时触发）。
// 运行于 node 环境：vendored bundle 顶层引用 document，必须先装 stub 再动态 import。
// @vitest-environment node
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import type { Asset } from '../src/lib/assets';

const { downloadBlobSpy } = vi.hoisted(() => ({ downloadBlobSpy: vi.fn() }));

vi.mock('../src/lib/download', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/download')>();
  return {
    ...actual,
    downloadBlob: downloadBlobSpy,
    // downloadText 内部绑定的是真实 downloadBlob（node 有 URL.createObjectURL 会真下载）——
    // 一并路由到 spy，避免 document stub 无 click 方法崩溃。
    downloadText: (text: string, filename: string) => {
      downloadBlobSpy(new Blob([text], { type: 'text/markdown' }), filename);
    },
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
};

const PNG_1_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const asset = (name: string): Asset => ({
  name,
  size: Buffer.from(PNG_1_B64, 'base64').length,
  dataUrl: `data:image/png;base64,${PNG_1_B64}`,
});

const MARKDOWN = '# 保存测试\n\n![图](pic.png)\n';

afterEach(() => {
  downloadBlobSpy.mockClear();
});

afterAll(() => {
  mkdirSync(TEST_RESULTS, { recursive: true });
  writeFileSync(
    join(TEST_RESULTS, 'save.json'),
    JSON.stringify({ tasks: '4.1', ...facts, tests: 9 }, null, 2) + '\n',
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

describe('saveDocument', () => {
  it('md 路径：无图 → 不询问确认、下载 hello.md、返回 md', async () => {
    const confirm = vi.fn(() => true);
    const kind = await saveDocument({
      markdown: '# 纯文本\n',
      assets: [],
      sourceKind: 'md',
      filename: 'hello',
      confirm,
    });
    expect(kind).toBe('md');
    expect(confirm).not.toHaveBeenCalled(); // 无图 → 无警告
    expect(downloadBlobSpy).toHaveBeenCalledTimes(1);
    const [blob, filename] = downloadBlobSpy.mock.calls[0] as [Blob, string];
    expect(filename).toBe('hello.md');
    expect(await blob.text()).toBe('# 纯文本\n');
  });

  it('mdpkg 路径：有图 → 下载 hello.mdpkg、字节可往返（校验通过、内容一致）、返回 mdpkg', async () => {
    const kind = await saveDocument({
      markdown: MARKDOWN,
      assets: [asset('pic.png')],
      sourceKind: 'md',
      filename: 'hello',
    });
    expect(kind).toBe('mdpkg');
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

  it('重打包路径：mdpkg 来源 + prevManifest + 包内资产/extraFiles → 下载 .mdpkg、entrypoint 继承、校验通过', async () => {
    const r = await openPackage(fixture('valid.mdpkg'));
    expect('files' in r).toBe(true);
    if (!('files' in r)) return;

    // 与 App 自动导入同构：图片条目 → Asset；非入口、非图片文件 → extraFiles。
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

    const kind = await saveDocument({
      markdown: readEntrySource(r.files),
      assets,
      sourceKind: 'mdpkg',
      filename: 'valid',
      prevManifest: r.manifest ?? undefined,
      extraFiles,
    });
    expect(kind).toBe('mdpkg');
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
    await saveDocument({ markdown: '# x', assets: [], sourceKind: 'md' });
    expect(downloadBlobSpy.mock.calls[0][1]).toBe('document.md');
    downloadBlobSpy.mockClear();
    await saveDocument({ markdown: '# x', assets: [asset('p.png')], sourceKind: 'md' });
    expect(downloadBlobSpy.mock.calls[0][1]).toBe('document.mdpkg');
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
}