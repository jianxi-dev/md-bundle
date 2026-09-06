// extractHeadings 纯函数单测 —— code-fence aware 解析验证。
import { describe, expect, it } from 'vitest';
import { extractHeadings } from '../src/lib/outline';

describe('extractHeadings', () => {
  it('基础 ATX 标题提取', () => {
    const md = '# 一级\n\n## 二级\n\n### 三级\n';
    const h = extractHeadings(md);
    expect(h).toEqual([
      { level: 1, text: '一级', line: 0 },
      { level: 2, text: '二级', line: 2 },
      { level: 3, text: '三级', line: 4 },
    ]);
  });

  it('跳过代码围栏内的 # 行', () => {
    const md = [
      '# 真标题',
      '',
      '```',
      '# 假标题',
      '## 也是假的',
      '```',
      '',
      '## 真二级',
    ].join('\n');
    const h = extractHeadings(md);
    expect(h).toEqual([
      { level: 1, text: '真标题', line: 0 },
      { level: 2, text: '真二级', line: 7 },
    ]);
  });

  it('多个代码围栏不影响后续解析', () => {
    const md = [
      '# 第一',
      '```js',
      '# fence1',
      '```',
      '## 第二',
      '```',
      '# fence2',
      '```',
      '### 第三',
    ].join('\n');
    const h = extractHeadings(md);
    expect(h).toEqual([
      { level: 1, text: '第一', line: 0 },
      { level: 2, text: '第二', line: 4 },
      { level: 3, text: '第三', line: 8 },
    ]);
  });

  it('无标题返回空数组', () => {
    expect(extractHeadings('普通文本\n无标题\n')).toEqual([]);
  });

  it('行首无空格的 # 不算标题', () => {
    const md = 'not # heading\n';
    expect(extractHeadings(md)).toEqual([]);
  });

  it('标题尾部多余 # 被清理', () => {
    const md = '# 标题 ##\n';
    const h = extractHeadings(md);
    expect(h).toEqual([{ level: 1, text: '标题', line: 0 }]);
  });

  it('6 级标题全部识别', () => {
    const md = '# a\n## b\n### c\n#### d\n##### e\n###### f\n';
    const h = extractHeadings(md);
    expect(h.map((x) => x.level)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
