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

/** Click a swatch in the 颜色 popup by row variant (`text` / `bg`) + tooltip. */
function clickColorSwatch(
  view: ReturnType<typeof createMarkdownEditor>['view'],
  variant: 'text' | 'bg',
  title: string,
): void {
  const swatch = view.dom.querySelector<HTMLButtonElement>(
    `.mdb-floating-toolbar .mdb-color-swatch-${variant}[title="${title}"]`,
  );
  if (!swatch) throw new Error(`color swatch ${variant} title="${title}" not found`);
  swatch.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
}

/** Click 恢复默认 inside the 颜色 popup. */
function clickColorReset(view: ReturnType<typeof createMarkdownEditor>['view']): void {
  const reset = view.dom.querySelector<HTMLButtonElement>(
    '.mdb-floating-toolbar .mdb-color-reset',
  );
  if (!reset) throw new Error('color reset button not found');
  reset.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
}

/** Open the 分栏 popup and click the bar group for `count` columns. */
function clickColumnBar(
  view: ReturnType<typeof createMarkdownEditor>['view'],
  count: number,
): void {
  const btn = view.dom.querySelector<HTMLButtonElement>(
    `.mdb-floating-toolbar .mdb-column-option[data-columns="${count}"]`,
  );
  if (!btn) throw new Error(`column bar option ${count} not found`);
  btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
}

/** Click 清除 inside the 分栏 popup. */
function clickColumnsClear(view: ReturnType<typeof createMarkdownEditor>['view']): void {
  const clear = view.dom.querySelector<HTMLButtonElement>(
    '.mdb-floating-toolbar .mdb-columns-clear',
  );
  if (!clear) throw new Error('columns clear button not found');
  clear.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
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

describe('floating toolbar: data-driven 11-control set (ticket #260)', () => {
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
      '颜色',
      '对齐',
      '加粗',
      '删除线',
      '斜体',
      '下划线',
      '插入链接',
      '行内代码',
      '分栏',
      '复制',
      '转换',
    ]);
    // The 字体 control was removed in #278.
    expect(buttons.map((b) => b.title)).not.toContain('字体');
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

describe('floating toolbar: color popup (ticket #278)', () => {
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

  it('颜色 popup opens with 字体色/背景色 swatch rows and 恢复默认', () => {
    selectWord(view, 'Hello world', 'Hello');
    clickBtn(view, '颜色');
    const menu = view.dom.querySelector<HTMLDivElement>('.mdb-toolbar-color-menu');
    expect(menu).not.toBeNull();
    expect(menu?.style.display).toBe('flex');
    const labels = Array.from(
      view.dom.querySelectorAll('.mdb-toolbar-color-menu .mdb-color-row-label'),
    ).map((el) => el.textContent);
    expect(labels).toEqual(['字体色', '背景色']);
    expect(view.dom.querySelectorAll('.mdb-toolbar-color-menu .mdb-color-swatch-text')).toHaveLength(5);
    expect(view.dom.querySelectorAll('.mdb-toolbar-color-menu .mdb-color-swatch-bg')).toHaveLength(5);
    expect(view.dom.querySelector('.mdb-toolbar-color-menu .mdb-color-reset')?.textContent).toBe(
      '恢复默认',
    );
  });

  it('字体色 options are letter "A" glyphs tinted with their own color', () => {
    selectWord(view, 'Hello world', 'Hello');
    clickBtn(view, '颜色');
    const red = view.dom.querySelector<HTMLButtonElement>(
      '.mdb-toolbar-color-menu .mdb-color-swatch-text[title="红色"]',
    );
    // The glyph is the label — no text, just a tinted "A".
    const glyph = red?.querySelector('span');
    expect(glyph?.textContent).toBe('A');
    expect(glyph?.style.color).toMatch(/rgb\(207,\s*34,\s*46\)|#cf222e/i);
    // The font row is not a solid swatch.
    expect(red?.style.background).toBe('transparent');
  });

  it('背景色 options stay solid swatches (no glyph)', () => {
    selectWord(view, 'Hello world', 'Hello');
    clickBtn(view, '颜色');
    const blue = view.dom.querySelector<HTMLButtonElement>(
      '.mdb-toolbar-color-menu .mdb-color-swatch-bg[title="蓝色"]',
    );
    expect(blue?.querySelector('span')).toBeNull();
    expect(blue?.style.background).toMatch(/rgb\(215,\s*220,\s*255\)|#d7dcff/i);
  });

  it('字体色 swatch applies 红色 (mdb-color-red)', () => {
    selectWord(view, 'Hello world', 'Hello');
    clickColorSwatch(view, 'text', '红色');
    expect(view.state.doc.toString()).toContain('<span class="mdb-color-red">Hello</span>');
  });

  it('字体色 switching replaces the span class', () => {
    selectWord(view, 'Hello world', 'Hello');
    clickColorSwatch(view, 'text', '红色');
    clickColorSwatch(view, 'text', '蓝色');
    expect(view.state.doc.toString()).not.toContain('mdb-color-red');
    expect(view.state.doc.toString()).toContain('<span class="mdb-color-blue">Hello</span>');
  });

  it('背景色 swatch applies 蓝色 (mdb-bg-blue)', () => {
    selectWord(view, 'Hello world', 'Hello');
    clickColorSwatch(view, 'bg', '蓝色');
    expect(view.state.doc.toString()).toContain('<span class="mdb-bg-blue">Hello</span>');
  });

  it('背景色 toggles off on second click', () => {
    selectWord(view, 'Hello world', 'Hello');
    clickColorSwatch(view, 'bg', '绿色');
    clickColorSwatch(view, 'bg', '绿色');
    expect(view.state.doc.toString()).not.toContain('mdb-bg-');
    expect(view.state.doc.toString()).toContain('Hello');
  });

  it('字体色 and 背景色 coexist on the same selection', () => {
    selectWord(view, 'Hello world', 'Hello');
    clickColorSwatch(view, 'text', '红色');
    clickColorSwatch(view, 'bg', '蓝色');
    const doc = view.state.doc.toString();
    expect(doc).toContain('mdb-color-red');
    expect(doc).toContain('mdb-bg-blue');
    expect(doc).toContain('Hello');
  });

  it('恢复默认 removes both text and background wrappers', () => {
    selectWord(view, 'Hello world', 'Hello');
    clickColorSwatch(view, 'text', '红色');
    clickColorSwatch(view, 'bg', '蓝色');
    clickColorReset(view);
    const doc = view.state.doc.toString();
    expect(doc).not.toContain('mdb-color-');
    expect(doc).not.toContain('mdb-bg-');
    expect(doc).toContain('Hello');
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

describe('floating toolbar: columns bar picker (ticket #290)', () => {
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

  it('分栏 popup renders 1..5 bar groups (N bars for N columns) and 清除', () => {
    selectWord(view, 'Hello world', 'Hello');
    clickBtn(view, '分栏');
    const menu = view.dom.querySelector<HTMLDivElement>('.mdb-toolbar-columns-menu');
    expect(menu).not.toBeNull();
    expect(menu?.style.display).toBe('flex');
    const options = Array.from(
      view.dom.querySelectorAll<HTMLButtonElement>('.mdb-toolbar-columns-menu .mdb-column-option'),
    );
    expect(options.map((o) => o.dataset.columns)).toEqual(['1', '2', '3', '4', '5']);
    expect(options.map((o) => o.querySelectorAll('.mdb-column-bar').length)).toEqual([1, 2, 3, 4, 5]);
    expect(view.dom.querySelector('.mdb-toolbar-columns-menu .mdb-columns-clear')?.textContent).toBe(
      '清除',
    );
  });

  it('clicking the 3rd bar group wraps the block in {.col-3}', () => {
    selectWord(view, 'Hello world', 'Hello');
    clickBtn(view, '分栏');
    clickColumnBar(view, 3);
    expect(view.state.doc.toString()).toBe('::: {.col-3}\nHello world\n:::');
  });

  it('clicking the 5th bar group wraps the block in {.col-5}', () => {
    selectWord(view, 'Hello world', 'Hello');
    clickBtn(view, '分栏');
    clickColumnBar(view, 5);
    expect(view.state.doc.toString()).toBe('::: {.col-5}\nHello world\n:::');
  });

  it('清除 removes the column wrapper', () => {
    selectWord(view, 'Hello world', 'Hello');
    clickBtn(view, '分栏');
    clickColumnBar(view, 3);
    clickBtn(view, '分栏');
    clickColumnsClear(view);
    expect(view.state.doc.toString()).toBe('Hello world');
  });
});
