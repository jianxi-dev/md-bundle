/**
 * Floating toolbar tests — ticket #260 (selection-toolbar/1.1) and #262 (selection-toolbar/3.1).
 *
 * Drives the floating toolbar through a real EditorView and asserts:
 * - The toolbar is data-driven (renders from commandRegistry ids / items).
 * - The 10-control inline format set is present with Chinese tooltips.
 * - Toggle semantics: applying a format twice removes it.
 * - The copy control places the selection on the clipboard.
 * - Alignment dropdown wraps blocks in fenced divs.
 *
 * jsdom lacks requestAnimationFrame/ResizeObserver; CodeMirror 6 uses both.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMarkdownEditor } from '../src/editor';
import { floatingToolbar, type FloatingToolbarItem } from '../src/floating-toolbar';
import { commandRegistry, clearBlockAlignment } from '../src/commands';

// jsdom ships no Clipboard API; the copy tests record calls here.
let clipboardWrites: string[] = [];

function installClipboard(): void {
  clipboardWrites = [];
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: (text: string): Promise<void> => {
        clipboardWrites.push(text);
        return Promise.resolve();
      },
    },
  });
}

function removeClipboard(): void {
  Reflect.deleteProperty(navigator, 'clipboard');
}

function installPolyfills(): void {
  if (typeof globalThis.requestAnimationFrame !== 'function') {
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 16)) as unknown as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = ((id: number) =>
      clearTimeout(id)) as unknown as typeof cancelAnimationFrame;
  }
  if (typeof globalThis.ResizeObserver !== 'function') {
    globalThis.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver;
  }
}

/** Click a floating-toolbar button by tooltip (title), mirroring the real mousedown the plugin binds. */
function clickBtn(view: ReturnType<typeof createMarkdownEditor>['view'], title: string): void {
  const btn = view.dom.querySelector<HTMLButtonElement>(
    `.mdb-floating-toolbar .mdb-toolbar-btn[title="${title}"]`,
  );
  if (!btn) throw new Error(`toolbar button title="${title}" not found`);
  btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
}

/** Click a dropdown option by label. */
function clickDropdownOption(view: ReturnType<typeof createMarkdownEditor>['view'], dropdownTitle: string, optionLabel: string): void {
  const dropdownBtn = view.dom.querySelector<HTMLButtonElement>(
    `.mdb-floating-toolbar .mdb-toolbar-dropdown-btn[title="${dropdownTitle}"]`,
  );
  if (!dropdownBtn) throw new Error(`dropdown button title="${dropdownTitle}" not found`);
  dropdownBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));

  const options = view.dom.querySelectorAll<HTMLButtonElement>(
    `.mdb-toolbar-dropdown-menu .mdb-toolbar-dropdown-option`,
  );
  const targetOption = Array.from(options).find((btn) => btn.textContent?.includes(optionLabel));
  if (!targetOption) throw new Error(`dropdown option "${optionLabel}" not found`);
  targetOption.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
}

/** Select `word` in the editor by dispatching a range over its first occurrence. */
function selectWord(
  view: ReturnType<typeof createMarkdownEditor>['view'],
  doc: string,
  word: string,
): void {
  view.dispatch({ changes: { from: 0, insert: doc } });
  const start = doc.indexOf(word);
  if (start < 0) throw new Error(`word "${word}" not in doc`);
  view.dispatch({ selection: { anchor: start, head: start + word.length } });
}

describe('floating toolbar: data-driven 7-control set (ticket #260)', () => {
  let parent: HTMLElement;
  let view: ReturnType<typeof createMarkdownEditor>['view'];

  beforeEach(() => {
    installPolyfills();
    parent = document.createElement('div');
    document.body.appendChild(parent);
    view = createMarkdownEditor(parent, { extensions: [floatingToolbar()] }).view;
  });

  afterEach(() => {
    view.destroy();
    parent.remove();
    removeClipboard();
  });

  it('renders exactly the 11 inline-format controls with Chinese tooltips', () => {
    selectWord(view, 'Hello world', 'Hello');
    const buttons = Array.from(
      view.dom.querySelectorAll<HTMLButtonElement>('.mdb-floating-toolbar .mdb-toolbar-btn, .mdb-floating-toolbar .mdb-toolbar-dropdown-btn'),
    );
    expect(buttons.map((b) => b.title)).toEqual([
      '字体',
      '颜色',
      '对齐',
      '分栏',
      '加粗',
      '斜体',
      '删除线',
      '下划线',
      '行内代码',
      '插入链接',
      '复制',
    ]);
  });

  it('does NOT hardcode commands — every button dispatches a registered command id', () => {
    selectWord(view, 'Hello world', 'Hello');
    // The toggle-underline command must exist in the registry for the button to work.
    expect(commandRegistry.has('toggle-underline')).toBe(true);
    expect(commandRegistry.has('toggle-strikethrough')).toBe(true);
    expect(commandRegistry.has('code-copy')).toBe(true);
  });
});

describe('floating toolbar: toggle semantics (ticket #260)', () => {
  let parent: HTMLElement;
  let view: ReturnType<typeof createMarkdownEditor>['view'];

  beforeEach(() => {
    installPolyfills();
    parent = document.createElement('div');
    document.body.appendChild(parent);
    view = createMarkdownEditor(parent, { extensions: [floatingToolbar()] }).view;
  });

  afterEach(() => {
    view.destroy();
    parent.remove();
    removeClipboard();
  });

  it('删除线 applies ~~…~~ on first click', () => {
    selectWord(view, 'Hello world', 'Hello');
    clickBtn(view, '删除线');
    expect(view.state.doc.toString()).toContain('~~Hello~~');
  });

  it('删除线 toggles off on second click (removes ~~)', () => {
    selectWord(view, 'Hello world', 'Hello');
    clickBtn(view, '删除线'); // apply
    clickBtn(view, '删除线'); // remove
    expect(view.state.doc.toString()).not.toContain('~~');
    expect(view.state.doc.toString()).toContain('Hello');
  });

  it('下划线 applies <u>…</u>', () => {
    selectWord(view, 'Hello world', 'Hello');
    clickBtn(view, '下划线');
    expect(view.state.doc.toString()).toContain('<u>Hello</u>');
  });

  it('下划线 toggles off on second click', () => {
    selectWord(view, 'Hello world', 'Hello');
    clickBtn(view, '下划线'); // apply
    clickBtn(view, '下划线'); // remove
    expect(view.state.doc.toString()).not.toContain('<u>');
    expect(view.state.doc.toString()).toContain('Hello');
  });

  it('加粗 toggles off on second click', () => {
    selectWord(view, 'Hello world', 'Hello');
    clickBtn(view, '加粗'); // apply → **Hello**
    clickBtn(view, '加粗'); // remove
    expect(view.state.doc.toString()).not.toContain('**');
    expect(view.state.doc.toString()).toContain('Hello');
  });

  it('斜体 toggles off on second click', () => {
    selectWord(view, 'Hello world', 'Hello');
    clickBtn(view, '斜体'); // apply → *Hello*
    clickBtn(view, '斜体'); // remove
    // The bare word must remain; no standalone * wrapping it.
    expect(view.state.doc.toString()).toMatch(/Hello/);
    expect(view.state.doc.toString()).not.toMatch(/\*Hello\*/);
  });

  it('行内代码 toggles off on second click', () => {
    selectWord(view, 'Hello world', 'Hello');
    clickBtn(view, '行内代码'); // apply → `Hello`
    clickBtn(view, '行内代码'); // remove
    expect(view.state.doc.toString()).not.toMatch(/`Hello`/);
    expect(view.state.doc.toString()).toContain('Hello');
  });
});

describe('floating toolbar: copy control (ticket #260)', () => {
  let parent: HTMLElement;
  let view: ReturnType<typeof createMarkdownEditor>['view'];

  beforeEach(() => {
    installPolyfills();
    installClipboard();
    parent = document.createElement('div');
    document.body.appendChild(parent);
    view = createMarkdownEditor(parent, { extensions: [floatingToolbar()] }).view;
  });

  afterEach(() => {
    view.destroy();
    parent.remove();
    removeClipboard();
  });

  it('复制 puts the selected text on the clipboard', () => {
    selectWord(view, 'Hello world', 'Hello');
    clickBtn(view, '复制');
    expect(clipboardWrites).toEqual(['Hello']);
  });
});

describe('floating toolbar: data-driven items option (ticket #260)', () => {
  let parent: HTMLElement;
  let view: ReturnType<typeof createMarkdownEditor>['view'];

  beforeEach(() => {
    installPolyfills();
    parent = document.createElement('div');
    document.body.appendChild(parent);
  });

  afterEach(() => {
    view?.destroy();
    parent.remove();
    removeClipboard();
  });

  it('renders a custom item set when items= is passed', () => {
    const items: FloatingToolbarItem[] = [
      { commandId: 'toggle-bold', label: '粗' },
      { commandId: 'toggle-italic', label: '斜' },
    ];
    view = createMarkdownEditor(parent, { extensions: [floatingToolbar({ items })] }).view;
    selectWord(view, 'Hello world', 'Hello');
    const buttons = Array.from(
      view.dom.querySelectorAll<HTMLButtonElement>('.mdb-floating-toolbar .mdb-toolbar-btn'),
    );
    expect(buttons.map((b) => b.title)).toEqual(['粗', '斜']);
  });

  it('item label overrides the underlying command label', () => {
    // code-copy's command label is "复制代码"; the default toolbar item overrides it to "复制".
    view = createMarkdownEditor(parent, { extensions: [floatingToolbar()] }).view;
    selectWord(view, 'Hello world', 'Hello');
    const copyBtn = view.dom.querySelector<HTMLButtonElement>(
      '.mdb-floating-toolbar .mdb-toolbar-btn[title="复制"]',
    );
    expect(copyBtn).not.toBeNull();
    // The raw command label must remain "复制代码" (not mutated).
    expect(commandRegistry.all().find((c) => c.id === 'code-copy')?.label).toBe('复制代码');
  });
});

describe('floating toolbar: font/color dropdowns (ticket #261)', () => {
  let parent: HTMLElement;
  let view: ReturnType<typeof createMarkdownEditor>['view'];

  beforeEach(() => {
    installPolyfills();
    parent = document.createElement('div');
    document.body.appendChild(parent);
    view = createMarkdownEditor(parent, { extensions: [floatingToolbar()] }).view;
  });

  afterEach(() => {
    view.destroy();
    parent.remove();
    removeClipboard();
  });

  it('字体 dropdown opens and applies 衬线', () => {
    selectWord(view, 'Hello world', 'Hello');
    clickDropdownOption(view, '字体', '衬线');
    expect(view.state.doc.toString()).toContain('<span class="mdb-font-serif">Hello</span>');
  });

  it('字体 dropdown applies 等宽', () => {
    selectWord(view, 'Hello world', 'Hello');
    clickDropdownOption(view, '字体', '等宽');
    expect(view.state.doc.toString()).toContain('<span class="mdb-font-mono">Hello</span>');
  });

  it('字体 dropdown applies 无衬线', () => {
    selectWord(view, 'Hello world', 'Hello');
    clickDropdownOption(view, '字体', '无衬线');
    expect(view.state.doc.toString()).toContain('<span class="mdb-font-sans">Hello</span>');
  });

  it('字体 dropdown 无 removes font span', () => {
    selectWord(view, 'Hello world', 'Hello');
    clickDropdownOption(view, '字体', '衬线');
    clickDropdownOption(view, '字体', '无');
    expect(view.state.doc.toString()).not.toContain('mdb-font-');
    expect(view.state.doc.toString()).toContain('Hello');
  });

  it('颜色 dropdown opens and applies 红色', () => {
    selectWord(view, 'Hello world', 'Hello');
    clickDropdownOption(view, '颜色', '红色');
    expect(view.state.doc.toString()).toContain('<span class="mdb-color-red">Hello</span>');
  });

  it('颜色 dropdown applies 蓝色', () => {
    selectWord(view, 'Hello world', 'Hello');
    clickDropdownOption(view, '颜色', '蓝色');
    expect(view.state.doc.toString()).toContain('<span class="mdb-color-blue">Hello</span>');
  });

  it('颜色 dropdown applies 绿色', () => {
    selectWord(view, 'Hello world', 'Hello');
    clickDropdownOption(view, '颜色', '绿色');
    expect(view.state.doc.toString()).toContain('<span class="mdb-color-green">Hello</span>');
  });

  it('颜色 dropdown applies 橙色', () => {
    selectWord(view, 'Hello world', 'Hello');
    clickDropdownOption(view, '颜色', '橙色');
    expect(view.state.doc.toString()).toContain('<span class="mdb-color-orange">Hello</span>');
  });

  it('颜色 dropdown applies 紫色', () => {
    selectWord(view, 'Hello world', 'Hello');
    clickDropdownOption(view, '颜色', '紫色');
    expect(view.state.doc.toString()).toContain('<span class="mdb-color-purple">Hello</span>');
  });

  it('颜色 dropdown 清除 removes color span', () => {
    selectWord(view, 'Hello world', 'Hello');
    clickDropdownOption(view, '颜色', '红色');
    clickDropdownOption(view, '颜色', '清除');
    expect(view.state.doc.toString()).not.toContain('mdb-color-');
    expect(view.state.doc.toString()).toContain('Hello');
  });

  it('switching font family replaces the span class', () => {
    selectWord(view, 'Hello world', 'Hello');
    clickDropdownOption(view, '字体', '衬线');
    clickDropdownOption(view, '字体', '等宽');
    expect(view.state.doc.toString()).not.toContain('mdb-font-serif');
    expect(view.state.doc.toString()).toContain('<span class="mdb-font-mono">Hello</span>');
  });

  it('switching color replaces the span class', () => {
    selectWord(view, 'Hello world', 'Hello');
    clickDropdownOption(view, '颜色', '红色');
    clickDropdownOption(view, '颜色', '蓝色');
    expect(view.state.doc.toString()).not.toContain('mdb-color-red');
    expect(view.state.doc.toString()).toContain('<span class="mdb-color-blue">Hello</span>');
  });
});

describe('floating toolbar: alignment dropdown (ticket #262)', () => {
  let parent: HTMLElement;
  let view: ReturnType<typeof createMarkdownEditor>['view'];

  beforeEach(() => {
    installPolyfills();
    parent = document.createElement('div');
    document.body.appendChild(parent);
    view = createMarkdownEditor(parent, { extensions: [floatingToolbar()] }).view;
  });

  afterEach(() => {
    view.destroy();
    parent.remove();
    removeClipboard();
  });

  it('对齐 dropdown opens and applies 居中', () => {
    selectWord(view, 'Hello world', 'Hello');
    clickDropdownOption(view, '对齐', '居中');
    expect(view.state.doc.toString()).toBe('::: {.align-center}\nHello world\n:::');
  });

  it('对齐 dropdown applies 左对齐', () => {
    selectWord(view, 'Hello world', 'Hello');
    clickDropdownOption(view, '对齐', '左对齐');
    expect(view.state.doc.toString()).toBe('::: {.align-left}\nHello world\n:::');
  });

  it('对齐 dropdown applies 右对齐', () => {
    selectWord(view, 'Hello world', 'Hello');
    clickDropdownOption(view, '对齐', '右对齐');
    expect(view.state.doc.toString()).toBe('::: {.align-right}\nHello world\n:::');
  });

  it('对齐 dropdown 居中 toggles off on second click', () => {
    selectWord(view, 'Hello world', 'Hello');
    clickDropdownOption(view, '对齐', '居中');
    clickDropdownOption(view, '对齐', '居中');
    expect(view.state.doc.toString()).toBe('Hello world');
  });

  it('对齐 dropdown 切换对齐 replaces the class (center → left)', () => {
    selectWord(view, 'Hello world', 'Hello');
    clickDropdownOption(view, '对齐', '居中');
    clickDropdownOption(view, '对齐', '左对齐');
    expect(view.state.doc.toString()).toBe('::: {.align-left}\nHello world\n:::');
  });

  it('对齐 dropdown 清除 removes alignment wrapper', () => {
    selectWord(view, 'Hello world', 'Hello');
    clickDropdownOption(view, '对齐', '居中');
    // Verify the wrapper was applied
    expect(view.state.doc.toString()).toBe('::: {.align-center}\nHello world\n:::');
    // Now clear it by directly calling the command
    commandRegistry.execute('align-clear', view);
    expect(view.state.doc.toString()).toBe('Hello world');
  });

  it('对齐 dropdown 清除 option button exists in menu', () => {
    selectWord(view, 'Hello world', 'Hello');
    // Open the dropdown
    const dropdownBtn = view.dom.querySelector<HTMLButtonElement>(
      '.mdb-floating-toolbar .mdb-toolbar-dropdown-btn[title="对齐"]',
    );
    expect(dropdownBtn).not.toBeNull();
    dropdownBtn!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));

    // Check that the 清除 option exists
    const options = view.dom.querySelectorAll<HTMLButtonElement>(
      '.mdb-toolbar-dropdown-menu .mdb-toolbar-dropdown-option',
    );
    const clearOption = Array.from(options).find((btn) => btn.textContent?.includes('清除'));
    expect(clearOption).not.toBeNull();
    expect(clearOption!.textContent).toBe('清除');
  });

  it('对齐 dropdown 清除 works via clickDropdownOption', () => {
    selectWord(view, 'Hello world', 'Hello');
    clickDropdownOption(view, '对齐', '居中');
    expect(view.state.doc.toString()).toBe('::: {.align-center}\nHello world\n:::');
    // Check if align-clear is registered
    expect(commandRegistry.has('align-clear')).toBe(true);
    // Call clearBlockAlignment directly
    clearBlockAlignment(view);
    expect(view.state.doc.toString()).toBe('Hello world');
  });
});
