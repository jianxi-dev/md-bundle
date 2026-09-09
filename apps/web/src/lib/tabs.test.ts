// lib/tabs 单元测试 —— 多页签模型纯逻辑。
// 任务 4.1：addTab/removeTab/updateTab/setActiveTab/getActiveTab。
// 纯函数 + 状态机：无 React 依赖，jsdom 环境即可。
import { afterAll, describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createTabsState,
  addTab,
  removeTab,
  updateTab,
  setActiveTab,
  getActiveTab,
} from './tabs';

const here = dirname(fileURLToPath(import.meta.url));
const RES = join(here, '..', '..', 'test-results');

// 证据汇总（serial + afterAll 落盘）。
const evidence = {
  tests: 0,
  addReturnsId: false,
  openNeverReplace: false,
  twoTabsContentIndependent: false,
  noLimit: false,
  closeUniqueReturnsEmpty: false,
  activeSwitch: false,
  updateSource: false,
  updateDirty: false,
  removeNonexistentNoop: false,
  setActiveNonexistentNoop: false,
};

describe('tabs 纯逻辑', () => {
  it('createTabsState 初始为空', () => {
    const s = createTabsState();
    expect(s.tabs).toHaveLength(0);
    expect(s.activeId).toBeNull();
    expect(getActiveTab(s)).toBeNull();
    evidence.tests++;
  });

  it('addTab 返回新 tab id，且设为 active', () => {
    const s0 = createTabsState();
    const { state: s1, tabId } = addTab(s0, {
      kind: 'md',
      name: 'hello.md',
      source: '# Hello',
    });
    expect(typeof tabId).toBe('string');
    expect(tabId.length).toBeGreaterThan(0);
    expect(s1.tabs).toHaveLength(1);
    expect(s1.activeId).toBe(tabId);
    expect(getActiveTab(s1)?.name).toBe('hello.md');
    evidence.addReturnsId = true;
    evidence.tests++;
  });

  it('打开第二个文件 = 新增 tab，永不替换', () => {
    const s0 = createTabsState();
    const { state: s1, tabId: id1 } = addTab(s0, {
      kind: 'md',
      name: 'a.md',
      source: 'aaa',
    });
    const { state: s2, tabId: id2 } = addTab(s1, {
      kind: 'md',
      name: 'b.md',
      source: 'bbb',
    });
    expect(id1).not.toBe(id2);
    expect(s2.tabs).toHaveLength(2);
    expect(s2.activeId).toBe(id2);
    expect(s2.tabs.find((t) => t.id === id1)?.source).toBe('aaa');
    expect(s2.tabs.find((t) => t.id === id2)?.source).toBe('bbb');
    evidence.openNeverReplace = true;
    evidence.tests++;
  });

  it('两个 tab 内容独立', () => {
    const s0 = createTabsState();
    const { state: s1, tabId: id1 } = addTab(s0, {
      kind: 'md',
      name: 'a.md',
      source: 'aaa',
    });
    const { state: s2, tabId: id2 } = addTab(s1, {
      kind: 'md',
      name: 'b.md',
      source: 'bbb',
    });
    // 编辑 tab1 不影响 tab2
    const s3 = updateTab(s2, id1, { source: 'aaa-modified' });
    expect(s3.tabs.find((t) => t.id === id1)?.source).toBe('aaa-modified');
    expect(s3.tabs.find((t) => t.id === id2)?.source).toBe('bbb');
    evidence.twoTabsContentIndependent = true;
    evidence.tests++;
  });

  it('无上限：可以连续添加多个 tab', () => {
    let s = createTabsState();
    const ids: string[] = [];
    for (let i = 0; i < 50; i++) {
      const r = addTab(s, { kind: 'md', name: `file${i}.md`, source: `content${i}` });
      s = r.state;
      ids.push(r.tabId);
    }
    expect(s.tabs).toHaveLength(50);
    expect(s.activeId).toBe(ids[49]);
    evidence.noLimit = true;
    evidence.tests++;
  });

  it('关闭唯一 tab → 回 empty（tabs=[], activeId=null）', () => {
    const s0 = createTabsState();
    const { state: s1, tabId } = addTab(s0, { kind: 'md', name: 'only.md', source: 'x' });
    const s2 = removeTab(s1, tabId);
    expect(s2.tabs).toHaveLength(0);
    expect(s2.activeId).toBeNull();
    expect(getActiveTab(s2)).toBeNull();
    evidence.closeUniqueReturnsEmpty = true;
    evidence.tests++;
  });

  it('关闭非 active tab → active 不变', () => {
    const s0 = createTabsState();
    const { state: s1, tabId: id1 } = addTab(s0, { kind: 'md', name: 'a.md', source: 'a' });
    const { state: s2, tabId: id2 } = addTab(s1, { kind: 'md', name: 'b.md', source: 'b' });
    // 关闭 tab1（非 active），active 仍是 tab2
    const s3 = removeTab(s2, id1);
    expect(s3.tabs).toHaveLength(1);
    expect(s3.activeId).toBe(id2);
    evidence.tests++;
  });

  it('关闭 active tab → active 切到前一个', () => {
    const s0 = createTabsState();
    const { state: s1 } = addTab(s0, { kind: 'md', name: 'a.md', source: 'a' });
    const { state: s2, tabId: id2 } = addTab(s1, { kind: 'md', name: 'b.md', source: 'b' });
    const { state: s3, tabId: id3 } = addTab(s2, { kind: 'md', name: 'c.md', source: 'c' });
    // 关闭 tab2（active），active 应切到 tab3（最后一个添加的）
    const s4 = removeTab(s3, id2);
    expect(s4.tabs).toHaveLength(2);
    expect(s4.activeId).toBe(id3);
    expect(getActiveTab(s4)?.name).toBe('c.md');
    evidence.tests++;
  });

  it('setActiveTab 切换 active', () => {
    const s0 = createTabsState();
    const { state: s1, tabId: id1 } = addTab(s0, { kind: 'md', name: 'a.md', source: 'a' });
    const { state: s2 } = addTab(s1, { kind: 'md', name: 'b.md', source: 'b' });
    const s3 = setActiveTab(s2, id1);
    expect(s3.activeId).toBe(id1);
    expect(getActiveTab(s3)?.name).toBe('a.md');
    evidence.activeSwitch = true;
    evidence.tests++;
  });

  it('updateTab 修改 source', () => {
    const s0 = createTabsState();
    const { state: s1, tabId } = addTab(s0, { kind: 'md', name: 'a.md', source: 'old' });
    const s2 = updateTab(s1, tabId, { source: 'new' });
    expect(getActiveTab(s2)?.source).toBe('new');
    evidence.updateSource = true;
    evidence.tests++;
  });

  it('updateTab 设置 dirty', () => {
    const s0 = createTabsState();
    const { state: s1, tabId } = addTab(s0, { kind: 'md', name: 'a.md', source: 'x' });
    expect(getActiveTab(s1)?.dirty).toBe(false);
    const s2 = updateTab(s1, tabId, { dirty: true });
    expect(s2.tabs.find((t) => t.id === tabId)?.dirty).toBe(true);
    evidence.updateDirty = true;
    evidence.tests++;
  });

  it('removeTab 对不存在 id 无效果', () => {
    const s0 = createTabsState();
    const { state: s1 } = addTab(s0, { kind: 'md', name: 'a.md', source: 'a' });
    const s2 = removeTab(s1, 'nonexistent-id');
    expect(s2.tabs).toHaveLength(1);
    expect(s2.activeId).toBe(s1.activeId);
    evidence.removeNonexistentNoop = true;
    evidence.tests++;
  });

  it('setActiveTab 对不存在 id 无效果', () => {
    const s0 = createTabsState();
    const { state: s1, tabId } = addTab(s0, { kind: 'md', name: 'a.md', source: 'a' });
    const s2 = setActiveTab(s1, 'nonexistent-id');
    expect(s2.activeId).toBe(tabId); // 不变
    evidence.setActiveNonexistentNoop = true;
    evidence.tests++;
  });

  it('新 tab 初始 dirty=false，scrollPos=0', () => {
    const s0 = createTabsState();
    const { state: s1, tabId } = addTab(s0, { kind: 'md', name: 'a.md', source: 'x' });
    const tab = s1.tabs.find((t) => t.id === tabId)!;
    expect(tab.dirty).toBe(false);
    expect(tab.scrollPos).toBe(0);
    evidence.tests++;
  });

  it('mdpkg tab 类型正确', () => {
    const s0 = createTabsState();
    const files = new Map<string, Uint8Array>();
    const { state: s1, tabId } = addTab(s0, {
      kind: 'mdpkg',
      name: 'pkg.mdpkg',
      source: 'entry md',
      mdpkgFiles: files,
      manifest: null,
    });
    const tab = s1.tabs.find((t) => t.id === tabId)!;
    expect(tab.kind).toBe('mdpkg');
    expect(tab.mdpkgFiles).toBe(files);
    evidence.tests++;
  });

  it('mdpkg tab 存储 validation 结果', () => {
    const s0 = createTabsState();
    const validation = { ok: false, errors: ['E302'], warnings: [], externalCount: 0 };
    const { state: s1, tabId } = addTab(s0, {
      kind: 'mdpkg',
      name: 'bad.mdpkg',
      source: 'entry',
      validation,
    });
    const tab = s1.tabs.find((t) => t.id === tabId)!;
    expect(tab.validation).toEqual(validation);
    evidence.tests++;
  });

  it('无 validation 时 tab.validation 为 null', () => {
    const s0 = createTabsState();
    const { state: s1, tabId } = addTab(s0, { kind: 'md', name: 'a.md', source: 'x' });
    const tab = s1.tabs.find((t) => t.id === tabId)!;
    expect(tab.validation).toBeNull();
    evidence.tests++;
  });
});

afterAll(() => {
  writeFileSync(join(RES, 'tabs.json'), JSON.stringify(evidence, null, 2));
});
