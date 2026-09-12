// lib/openFile 单元测试。
// 运行于 node 环境（读 fixture 用 fs；File/Blob 为 Node 22 全局）。
// vendored bundle 顶层引用 document —— 与 mdpkg.test.ts 一样，先注入最小 stub 再动态 import。
// @vitest-environment node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

installDocumentStub();

const { detectFileType, hasZipMagic, openFile } = await import('../src/lib/openFile');

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const fixture = (name: string): Uint8Array => new Uint8Array(readFileSync(join(FIXTURES, name)));

function fileOf(name: string, bytes: Uint8Array | string, type = ''): File {
  return new File([bytes], name, { type });
}

describe('detectFileType（扩展名检测）', () => {
  it('.md → md，大小写不敏感', () => {
    expect(detectFileType(fileOf('a.md', ''))).toBe('md');
    expect(detectFileType(fileOf('NOTES.MD', ''))).toBe('md');
  });

  it('.mdpkg → mdpkg', () => {
    expect(detectFileType(fileOf('pkg.mdpkg', ''))).toBe('mdpkg');
  });

  it('无扩展 / 其它扩展 → null', () => {
    expect(detectFileType(fileOf('README', ''))).toBeNull();
    expect(detectFileType(fileOf('a.txt', ''))).toBeNull();
    expect(detectFileType(fileOf('a.mdpkg.bak', ''))).toBeNull();
  });
});

describe('hasZipMagic（PK 魔数嗅探）', () => {
  it('PK\\x03\\x04 前缀 → true', () => {
    expect(hasZipMagic(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]))).toBe(true);
  });

  it('文本 / 过短 → false', () => {
    expect(hasZipMagic(new TextEncoder().encode('# hello'))).toBe(false);
    expect(hasZipMagic(new Uint8Array([0x50, 0x4b, 0x03]))).toBe(false);
    expect(hasZipMagic(new Uint8Array([]))).toBe(false);
  });
});

describe('openFile（打开分发，确定性结果，绝不抛出）', () => {
  it('.md → 文本内容', async () => {
    const o = await openFile(fileOf('a.md', '# Hi\n\nbody', 'text/markdown'));
    expect(o.kind).toBe('md');
    if (o.kind !== 'md') return;
    expect(o.name).toBe('a.md');
    expect(o.content).toContain('# Hi');
  });

  it('valid.mdpkg → mdpkg 结果，html 非空且含内联图片', async () => {
    const o = await openFile(fileOf('x.mdpkg', fixture('valid.mdpkg')));
    expect(o.kind).toBe('mdpkg');
    if (o.kind !== 'mdpkg') return;
    expect('files' in o.result).toBe(true);
    if (!('files' in o.result)) return;
    expect(o.result.html).not.toBeNull();
    expect((o.result.html!.match(/data:image\/png;base64,/g) ?? []).length).toBe(2);
  });

  it('截断的 .mdpkg（corrupted.zip）→ 上游 throw，包装层捕获返回 { error }，不抛出', async () => {
    // 上游 v0.3.0.0 对损坏 ZIP 数据改为 throw，包装层捕获后返回 { error }。
    const o = await openFile(fileOf('broken.mdpkg', fixture('corrupted.zip')));
    expect(o.kind).toBe('mdpkg');
    if (o.kind !== 'mdpkg') return;
    expect('files' in o.result).toBe(false);
    if ('files' in o.result) return;
    expect(o.result.error).toBeTruthy();
  });

  it('非 ZIP 但扩展名为 .mdpkg → 确定性 { error }（包装层翻译），不抛出', async () => {
    const o = await openFile(fileOf('fake.mdpkg', fixture('not-mdpkg.bin')));
    expect(o.kind).toBe('mdpkg');
    if (o.kind !== 'mdpkg') return;
    expect('files' in o.result).toBe(false);
    if ('files' in o.result) return;
    expect(o.result.error).toContain('不是有效的 .mdpkg 文件');
  });

  it('魔数兜底：内容为 ZIP 但扩展名不是 .mdpkg → 仍按 mdpkg 打开', async () => {
    const o = await openFile(fileOf('renamed.bin', fixture('valid.mdpkg')));
    expect(o.kind).toBe('mdpkg');
    if (o.kind !== 'mdpkg') return;
    expect('files' in o.result).toBe(true);
    if (!('files' in o.result)) return;
    expect(o.result.html).not.toBeNull();
  });

  it('不支持的类型（.txt）→ 错误结果，不抛出', async () => {
    const o = await openFile(fileOf('notes.txt', 'plain text'));
    expect(o.kind).toBe('error');
    if (o.kind !== 'error') return;
    expect(o.message).toContain('不支持的文件类型');
  });
});

/** 最小 document stub：满足 bundle 顶层 decodeNamedCharacterReference 的 createElement 调用 */
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
