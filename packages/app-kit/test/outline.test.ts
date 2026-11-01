// #510：目录大纲迁入 app-kit。纯解析部分在 node 下直接验证新入口。
// 需要 DOM 的浮层组件仍由 apps/web/test/outlineMenu.test.tsx 经旧位置垫片回归。
// @vitest-environment node
import { describe, expect, it } from 'vitest';

const outline = await import('../src/outline/index');

describe('app-kit outline surface', () => {
  it('提取 ATX 标题并给出 0-based 行号', () => {
    const md = '# 一级\n\n正文\n\n## 二级\n';
    expect(outline.extractHeadings(md)).toEqual([
      { level: 1, text: '一级', line: 0 },
      { level: 2, text: '二级', line: 4 },
    ]);
  });

  it('跳过代码围栏内的 # 行', () => {
    const md = '# 外\n\n```\n# 块内\n```\n\n## 尾\n';
    expect(outline.extractHeadings(md).map((h) => h.text)).toEqual(['外', '尾']);
  });

  it('去掉标题尾部多余的 # 与空格', () => {
    expect(outline.extractHeadings('### 标题 ###')[0]).toEqual({
      level: 3,
      text: '标题',
      line: 0,
    });
  });

  it('无空格井号与七级井号都不产生条目', () => {
    expect(outline.extractHeadings('#无空格\n####### 七级\n正文')).toEqual([]);
  });
});
