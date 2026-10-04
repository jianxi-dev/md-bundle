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
      '表格',
      '标注',
      '图片引用',
      '任务',
      '分栏',
      '插入 HTML',
      '插入 CSS',
    ]);
  });

  it('keeps the three groups contiguous and in order', () => {
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
      '绘图',
      '绘图',
    ]);
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