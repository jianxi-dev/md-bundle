import { describe, expect, it } from 'vitest';
import { defaultCommands } from '../src/slash';
import { TABLE_SIZE_QUERY, filterSlashCommands } from '../src/slash-filter';

/** Row labels for a filtered result, in render order. */
function labels(rows: readonly { label: string }[]): string[] {
  return rows.map((row) => row.label);
}

function row(commandId: string) {
  const found = defaultCommands.find((cmd) => cmd.id === commandId);
  if (!found) throw new Error(`missing registry command: ${commandId}`);
  return found;
}

const calloutChildren = row('callout').children ?? [];

describe('filterSlashCommands', () => {
  it('lists every root command in canonical order for an empty query', () => {
    expect(labels(filterSlashCommands(defaultCommands, ''))).toEqual([
      '标题',
      '引用',
      '代码块',
      '分割线',
      '任务',
      '图片引用',
      '视频/文件',
      '表格',
      '分栏',
      '标注',
      '数据看板',
      '插入 HTML',
      '插入 CSS',
      '流程图',
      '任务清单',
      '目录导航',
      '内嵌网页',
    ]);
  });

  it('keeps the seven groups contiguous and in order', () => {
    expect(defaultCommands).toHaveLength(17);
    expect(defaultCommands.map((cmd) => cmd.group)).toEqual([
      '基础',
      '基础',
      '基础',
      '基础',
      '常用',
      '常用',
      '常用',
      '常用',
      '常用',
      '常用',
      '数据',
      '绘图',
      '绘图',
      '绘图',
      '团队协作',
      '进阶',
      '更多小组件',
    ]);
  });

  it('assigns /fN codes to the column children and /f to the parent', () => {
    const columns = row('columns');
    expect(columns.code).toBe('f');
    expect((columns.children ?? []).map((child) => child.code)).toEqual([
      'f1',
      'f2',
      'f3',
      'f4',
      'f5',
    ]);
  });

  it('filters /f3 to the 3-column row', () => {
    expect(labels(filterSlashCommands(defaultCommands, 'f3'))).toEqual(['3 栏']);
  });

  it('returns nothing for the stale /fl3 code', () => {
    expect(filterSlashCommands(defaultCommands, 'fl3')).toEqual([]);
  });

  it('declares eight callout styles as second-level options', () => {
    expect(calloutChildren).toHaveLength(8);
  });

  it('keeps only the table for a size query and reads the size from the same rule', () => {
    expect(labels(filterSlashCommands(defaultCommands, 't53'))).toEqual(['表格']);
    const match = TABLE_SIZE_QUERY.exec('t53');
    expect(match).not.toBeNull();
    expect(match?.[1]).toBe('5');
    expect(match?.[2]).toBe('3');
  });

  it('ranks the table first for its full pinyin', () => {
    expect(labels(filterSlashCommands(defaultCommands, 'biaoge'))[0]).toBe('表格');
  });

  it('matches the table by pinyin prefix', () => {
    expect(labels(filterSlashCommands(defaultCommands, 'biao'))).toContain('表格');
  });

  it('keeps the callout parent and surfaces its styles for the parent code', () => {
    const rows = labels(filterSlashCommands(defaultCommands, 'n'));
    expect(rows[0]).toBe('标注');
    expect(rows.slice(1)).toEqual(calloutChildren.map((child) => child.label));
  });

  it('shows only the matching style for a second-level code', () => {
    expect(labels(filterSlashCommands(defaultCommands, 'nd'))).toEqual(['危险']);
  });

  it('ranks an exact code above label matches', () => {
    expect(labels(filterSlashCommands(defaultCommands, 't'))[0]).toBe('表格');
  });

  it('finds the task by its code', () => {
    expect(labels(filterSlashCommands(defaultCommands, 'r'))).toContain('任务');
  });

  it('finds the heading by pinyin initials', () => {
    expect(labels(filterSlashCommands(defaultCommands, 'bt'))).toContain('标题');
  });

  it('finds the divider by its label pinyin', () => {
    expect(labels(filterSlashCommands(defaultCommands, 'fenge'))).toContain('分割线');
  });

  it('returns nothing when the query matches no row', () => {
    expect(filterSlashCommands(defaultCommands, 'zzzz')).toEqual([]);
  });
});