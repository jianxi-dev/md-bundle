/**
 * Structure linter tests — verifies all 8 diagnostic rules.
 *
 * Each rule is tested with a minimal markdown document that triggers it,
 * plus a negative case that should NOT trigger the rule.
 */
import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { lintStructure, type Diagnostic } from '../src/structure-linter';

function makeState(doc: string): EditorState {
  return EditorState.create({ doc, extensions: [markdown()] });
}

function findRule(result: ReturnType<typeof lintStructure>, rule: string): Diagnostic[] {
  return result.diagnostics.filter((d) => d.rule === rule);
}

describe('rule: missing-evidence (论点无证据)', () => {
  it('flags paragraph with conclusion words but no following evidence', () => {
    const state = makeState('第一段内容。\n\n因此这是结论。');
    const result = lintStructure(state);
    const findings = findRule(result, 'missing-evidence');
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('warning');
    expect(findings[0].message).toContain('结论性段落缺少支撑证据');
  });

  it('does not flag when evidence follows within 2 blocks', () => {
    const state = makeState('因此这是结论。\n\n- 支撑证据1\n- 支撑证据2');
    const result = lintStructure(state);
    const findings = findRule(result, 'missing-evidence');
    expect(findings).toHaveLength(0);
  });

  it('does not flag paragraph without conclusion words', () => {
    const state = makeState('这是一段普通文字。');
    const result = lintStructure(state);
    const findings = findRule(result, 'missing-evidence');
    expect(findings).toHaveLength(0);
  });
});

describe('rule: section-no-conclusion (章节无结论)', () => {
  it('flags H2 section with > 3 paragraphs but no conclusion', () => {
    const state = makeState(
      '## 章节标题\n\n第一段。\n\n第二段。\n\n第三段。\n\n第四段。',
    );
    const result = lintStructure(state);
    const findings = findRule(result, 'section-no-conclusion');
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('info');
    expect(findings[0].message).toContain('4 段');
  });

  it('does not flag section with conclusion paragraph', () => {
    const state = makeState(
      '## 章节标题\n\n第一段。\n\n第二段。\n\n第三段。\n\n第四段。\n\n因此总结。',
    );
    const result = lintStructure(state);
    const findings = findRule(result, 'section-no-conclusion');
    expect(findings).toHaveLength(0);
  });

  it('does not flag short section (≤ 3 paragraphs)', () => {
    const state = makeState('## 章节标题\n\n第一段。\n\n第二段。\n\n第三段。');
    const result = lintStructure(state);
    const findings = findRule(result, 'section-no-conclusion');
    expect(findings).toHaveLength(0);
  });
});

describe('rule: duplicate-argument (重复论点)', () => {
  it('flags sections with similar title keywords', () => {
    // Titles with high character overlap.
    const state = makeState('## 性能优化方案\n\n内容。\n\n## 性能优化方法\n\n内容。');
    const result = lintStructure(state);
    const findings = findRule(result, 'duplicate-argument');
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].severity).toBe('warning');
  });

  it('does not flag sections with distinct titles', () => {
    const state = makeState('## 背景介绍\n\n内容。\n\n## 技术方案\n\n内容。');
    const result = lintStructure(state);
    const findings = findRule(result, 'duplicate-argument');
    expect(findings).toHaveLength(0);
  });
});

describe('rule: heading-skip (标题层级跳跃)', () => {
  it('flags H1 → H3 jump', () => {
    const state = makeState('# 一级标题\n\n### 三级标题');
    const result = lintStructure(state);
    const findings = findRule(result, 'heading-skip');
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('error');
    expect(findings[0].message).toContain('H1 → H3');
  });

  it('does not flag H1 → H2 progression', () => {
    const state = makeState('# 一级标题\n\n## 二级标题');
    const result = lintStructure(state);
    const findings = findRule(result, 'heading-skip');
    expect(findings).toHaveLength(0);
  });

  it('flags H2 → H4 jump', () => {
    const state = makeState('## 二级标题\n\n#### 四级标题');
    const result = lintStructure(state);
    const findings = findRule(result, 'heading-skip');
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain('H2 → H4');
  });
});

describe('rule: long-paragraph (超长段落)', () => {
  it('flags paragraph exceeding 300 characters', () => {
    const longText = '这是一段很长的文字。'.repeat(31); // 372 chars > 300
    const state = makeState(longText);
    const result = lintStructure(state);
    const findings = findRule(result, 'long-paragraph');
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('info');
    expect(findings[0].message).toContain('过长');
  });

  it('does not flag short paragraph', () => {
    const state = makeState('短段落。');
    const result = lintStructure(state);
    const findings = findRule(result, 'long-paragraph');
    expect(findings).toHaveLength(0);
  });
});

describe('rule: list-imbalance (列表项长度失衡)', () => {
  it('flags list where longest > 5x shortest', () => {
    const state = makeState('- 短\n- 这是一个很长的列表项内容，用来测试列表项长度失衡的规则触发条件，需要超过最短项五倍长度');
    const result = lintStructure(state);
    const findings = findRule(result, 'list-imbalance');
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('info');
    expect(findings[0].message).toContain('失衡');
  });

  it('does not flag balanced list', () => {
    const state = makeState('- 第一项内容\n- 第二项内容\n- 第三项内容');
    const result = lintStructure(state);
    const findings = findRule(result, 'list-imbalance');
    expect(findings).toHaveLength(0);
  });
});

describe('rule: empty-heading (空标题)', () => {
  it('flags consecutive headings', () => {
    const state = makeState('## 标题一\n## 标题二');
    const result = lintStructure(state);
    const findings = findRule(result, 'empty-heading');
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('warning');
    expect(findings[0].message).toContain('空标题');
  });

  it('does not flag headings with content between them', () => {
    const state = makeState('## 标题一\n\n内容段落。\n\n## 标题二');
    const result = lintStructure(state);
    const findings = findRule(result, 'empty-heading');
    expect(findings).toHaveLength(0);
  });
});

describe('rule: orphaned-image (孤立的图片)', () => {
  it('flags standalone image with no nearby text', () => {
    const state = makeState('![alt](image.png)');
    const result = lintStructure(state);
    const findings = findRule(result, 'orphaned-image');
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('info');
    expect(findings[0].message).toContain('孤立');
  });

  it('does not flag image with nearby paragraph text', () => {
    // Image is a top-level block; nearby paragraph provides context.
    const state = makeState('![alt](image.png)\n\n这是图片的说明文字。');
    const result = lintStructure(state);
    const findings = findRule(result, 'orphaned-image');
    expect(findings).toHaveLength(0);
  });

  it('does not flag image preceded by text paragraph', () => {
    const state = makeState('这是图片的说明文字。\n\n![alt](image.png)');
    const result = lintStructure(state);
    const findings = findRule(result, 'orphaned-image');
    expect(findings).toHaveLength(0);
  });
});

describe('lintStructure integration', () => {
  it('returns empty diagnostics for empty document', () => {
    const state = makeState('');
    const result = lintStructure(state);
    expect(result.diagnostics).toEqual([]);
  });

  it('returns diagnostics sorted by position', () => {
    const longText = '这是一段很长的文字。'.repeat(25);
    const state = makeState(`# 标题\n\n${longText}\n\n## 标题\n\n### 子标题`);
    const result = lintStructure(state);
    for (let i = 1; i < result.diagnostics.length; i++) {
      expect(result.diagnostics[i].from).toBeGreaterThanOrEqual(
        result.diagnostics[i - 1].from,
      );
    }
  });

  it('handles complex document with multiple issues', () => {
    const longText = '这是一段很长的文字。'.repeat(31); // 372 chars > 300
    const state = makeState(
      `# 一级标题\n\n## 二级标题\n\n${longText}\n\n因此这是结论。\n\n### 三级标题`,
    );
    const result = lintStructure(state);
    // H1→H2 is fine, H2→H3 is fine (no skip).
    // long-paragraph fires for the long text, missing-evidence fires for conclusion without evidence.
    const rules = result.diagnostics.map((d) => d.rule);
    expect(rules).toContain('long-paragraph');
    expect(rules).toContain('missing-evidence');
  });
});
