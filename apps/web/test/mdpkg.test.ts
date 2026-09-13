// mdpkg 集成测试：vendored mdpkg-web.js + src/lib/mdpkg.ts 封装层。
// 运行于 node 环境（无 DOM 需要）；夹具为提交的二进制文件（apps/web/test/fixtures/）。
// 注意：vendored bundle 顶层引用 document（decode-named-character-reference 的 DOM 变体），
// node 下必须先注入最小 stub 再动态 import 封装层（浏览器端由真实 DOM 提供）。
// @vitest-environment node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

installDocumentStub();

const { openPackage, readEntrySource } = await import('../src/lib/mdpkg');

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const fixture = (name: string): Uint8Array => new Uint8Array(readFileSync(join(FIXTURES, name)));

describe('openPackage（vendored mdpkg-web 集成）', () => {
  it('valid.mdpkg → files + html + validation.ok，图片内联为 data URI', async () => {
    const r = await openPackage(fixture('valid.mdpkg'));
    expect('files' in r).toBe(true);
    if (!('files' in r)) return;

    expect(r.files.size).toBeGreaterThanOrEqual(3); // document.md + 2 图片 + manifest.json
    expect(r.files.has('document.md')).toBe(true);
    expect(r.files.has('manifest.json')).toBe(true);
    expect(r.files.has('assets/red.png')).toBe(true);
    expect(r.files.has('assets/blue.png')).toBe(true);

    expect(r.html).not.toBeNull();
    expect(r.validation.ok).toBe(true);
    expect(r.validation.errors).toEqual([]);
    expect(r.manifest?.entrypoint).toBe('document.md');

    const uris = (r.html!.match(/data:image\/png;base64,/g) ?? []).length;
    expect(uris).toBe(2);

    // 符号扩展 + include 展开（与上游 web.test.ts 同断言）
    expect(r.html!).toContain('™');
    expect(r.html!).toContain('©');
    expect(r.html!).toContain('第一章');
    // 源文不被改写（include 指令仍在原文）
    expect(readEntrySource(r.files)).toContain('<<<');
  });

  it('not-mdpkg.bin → 包装层捕获 MdeError，返回确定性 { error }，绝不抛出', async () => {
    const r = await openPackage(fixture('not-mdpkg.bin'));
    expect('files' in r).toBe(false);
    if ('files' in r) return;
    expect(r.error).toContain('不是有效的 .mdpkg 文件');
  });

  it('corrupted.zip → 包装层捕获上游 throw，返回确定性 { error }，不抛出', async () => {
    // 上游 v0.3.0.0（docx wave 2/3）对损坏 ZIP 数据改为 throw MdeError，
    // 包装层 openPackage 捕获后返回 { error }，绝不抛出。
    const r = await openPackage(fixture('corrupted.zip'));
    expect('files' in r).toBe(false);
    if ('files' in r) return;
    expect(r.error).toBeTruthy();
  });

  it('invalid-manifest.mdpkg → manifest 存在 + validation.ok=false + E302 schema 错误（不阻断渲染）', async () => {
    const r = await openPackage(fixture('invalid-manifest.mdpkg'));
    expect('files' in r).toBe(true);
    if (!('files' in r)) return;

    expect(r.manifest).not.toBeNull();
    expect(r.validation.ok).toBe(false);
    // ajv additionalProperties 错误文本不含字段名（实测），断言错误码与文本本身
    expect(r.validation.errors.some((e) => e.includes('MDPKG-E302'))).toBe(true);
    expect(r.validation.errors[0]).toContain('must NOT have additional properties');
    // 校验失败不阻断渲染
    expect(r.html).not.toBeNull();
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