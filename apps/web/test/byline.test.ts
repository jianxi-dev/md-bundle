// Made-with byline 测试（任务 6.1）：
//   - byline 库：文案 / 品牌链接 / 页脚标记（与 3.4 逐字节一致）/ 右下角徽标标记
//   - `.mdpkg` 洁净性：源码不含 byline → 打包往返后源码字节一致、包内无 byline 痕迹；
//     源码本身含 byline 文案 → 重打包原样保留（不去重、不篡改）
// 运行于 node 环境：vendored bundle 顶层引用 document，必须先装 stub 再动态 import。
// @vitest-environment node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import {
  BYLINE_TEXT,
  BYLINE_BASE_URL,
  bylineHref,
  bylineFooterHtml,
  bylineCornerBadgeHtml,
} from '../src/lib/byline';

installDocumentStub();
const { exportMdpkg } = await import('../src/lib/exportMdpkg');
const { openPackage, readEntrySource } = await import('../src/lib/mdpkg');

const HERE = dirname(fileURLToPath(import.meta.url));
const TEST_RESULTS = join(HERE, '..', 'test-results');
const EVIDENCE_PATH = join(TEST_RESULTS, 'byline.json');

/** 证据事实（测试内收集，afterAll 落盘）。 */
const facts = {
  htmlFooterByline: false,
  pngCornerByline: false,
  mdpkgClean: false,
  sourcePreserved: false,
};

describe('byline 库', () => {
  it('BYLINE_TEXT / BYLINE_BASE_URL 常量正确', () => {
    expect(BYLINE_TEXT).toBe('Made with MD-Bundle');
    expect(BYLINE_BASE_URL).toBe('https://bundle.jianxi.me');
  });

  it('bylineHref 生成带 ref 的品牌链接（md-html / md-png / md-share 预留）', () => {
    expect(bylineHref('md-html')).toBe('https://bundle.jianxi.me/?ref=md-html');
    expect(bylineHref('md-png')).toBe('https://bundle.jianxi.me/?ref=md-png');
    expect(bylineHref('md-share')).toBe('https://bundle.jianxi.me/?ref=md-share');
  });

  it('bylineFooterHtml 默认与 3.4 页脚标记逐字节一致，自定义 ref 生效', () => {
    expect(bylineFooterHtml()).toBe(
      '<footer><a href="https://bundle.jianxi.me/?ref=md-html">Made with MD-Bundle</a></footer>',
    );
    expect(bylineFooterHtml('md-share')).toBe(
      '<footer><a href="https://bundle.jianxi.me/?ref=md-share">Made with MD-Bundle</a></footer>',
    );
    expect(bylineFooterHtml()).toContain(BYLINE_TEXT);
    facts.htmlFooterByline = true;
  });

  it('bylineCornerBadgeHtml：右下角半透明胶囊、12px、同文案同链接', () => {
    const badge = bylineCornerBadgeHtml();
    expect(badge).toContain(BYLINE_TEXT);
    expect(badge).toContain('https://bundle.jianxi.me/?ref=md-png');
    expect(badge).toContain('position:absolute');
    expect(badge).toContain('right:16px');
    expect(badge).toContain('bottom:12px');
    expect(badge).toContain('font-size:12px');
    expect(badge).toContain('border-radius:999px');
    expect(badge).toContain('rgba(22,93,255,0.12)');
    // 无 void 元素 → 直接通过 toWellFormedXhtml 的 XML 校验
    expect(badge).not.toMatch(/<(img|br|hr|meta|input|link)\b/);
    expect(bylineCornerBadgeHtml('md-share')).toContain('?ref=md-share');
    facts.pngCornerByline = true;
  });
});

describe('.mdpkg 洁净性（byline 绝不注入包体）', () => {
  it('源码不含 byline → 打包往返源码字节一致，包内无 byline 痕迹', async () => {
    const source = '# 洁净测试\n\n正文内容，无品牌痕迹。\n';
    const bytes = exportMdpkg({ markdown: source, assets: [] });
    const r = await openPackage(bytes);
    expect('files' in r).toBe(true);
    if (!('files' in r)) return;
    expect(r.validation.ok).toBe(true);
    expect(readEntrySource(r.files)).toBe(source);

    const allText = [...r.files.values()]
      .map((b) => new TextDecoder().decode(b))
      .join('\n');
    expect(allText).not.toContain('Made with MD-Bundle');
    expect(allText).not.toContain('bundle.jianxi.me');
    facts.mdpkgClean = true;
  });

  it('源码本身含 byline 文案 → 重打包原样保留（不去重、不篡改）', async () => {
    const source = '# 用户自写\n\nMade with MD-Bundle 是我的笔记标题。\n\nbundle.jianxi.me 出现在正文。\n';
    const bytes = exportMdpkg({ markdown: source, assets: [] });
    const r = await openPackage(bytes);
    expect('files' in r).toBe(true);
    if (!('files' in r)) return;
    expect(readEntrySource(r.files)).toBe(source);
    facts.sourcePreserved = true;
  });
});

afterAll(() => {
  mkdirSync(TEST_RESULTS, { recursive: true });
  writeFileSync(
    EVIDENCE_PATH,
    JSON.stringify(
      { tasks: '6.1', ...facts, refs: ['md-html', 'md-png'] },
      null,
      2,
    ) + '\n',
  );
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