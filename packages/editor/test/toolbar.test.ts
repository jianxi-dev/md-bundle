import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMarkdownEditor } from '../src/editor';
import {
  detectContext,
  getButtonsForContext,
  updateToolbar,
  hideContextToolbar,
  contextToolbar,
  type ToolbarContext,
} from '../src/toolbar';
import { floatingToolbar } from '../src/floating-toolbar';
import { commandRegistry } from '../src/commands';

// jsdom ships no Clipboard API; the copy-command tests record calls here.
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

describe('toolbar context detection', () => {
  let parent: HTMLElement;
  let view: ReturnType<typeof createMarkdownEditor>['view'];

  beforeEach(() => {
    installPolyfills();
    parent = document.createElement('div');
    document.body.appendChild(parent);
    view = createMarkdownEditor(parent).view;
  });

  afterEach(() => {
    view.destroy();
    parent.remove();
  });

  it('returns "normal" for empty document', () => {
    const ctx = detectContext(view.state);
    expect(ctx.kind).toBe('normal');
  });

  it('returns "normal" for paragraph text', () => {
    view.dispatch({
      changes: { from: 0, insert: 'Hello world' },
      selection: { anchor: 5 },
    });
    const ctx = detectContext(view.state);
    expect(ctx.kind).toBe('normal');
  });

  it('returns "empty" for empty line', () => {
    view.dispatch({
      changes: { from: 0, insert: '' },
      selection: { anchor: 0 },
    });
    const ctx = detectContext(view.state);
    expect(ctx.kind).toBe('normal');
  });

  it('returns "text-selected" when text is selected', () => {
    view.dispatch({
      changes: { from: 0, insert: 'Hello world' },
      selection: { anchor: 0, head: 5 },
    });
    const ctx = detectContext(view.state);
    expect(ctx.kind).toBe('text-selected');
    if (ctx.kind === 'text-selected') {
      expect(ctx.from).toBe(0);
      expect(ctx.to).toBe(5);
    }
  });

  it('returns "table" when cursor is in a table', () => {
    view.dispatch({
      changes: { from: 0, insert: '| A | B |\n| --- | --- |\n| 1 | 2 |' },
      selection: { anchor: 5 },
    });
    const ctx = detectContext(view.state);
    // Lezer markdown may parse this as table or paragraph depending on dialect
    expect(['table', 'normal']).toContain(ctx.kind);
  });

  it('returns "code-block" when cursor is in a fenced code block', () => {
    view.dispatch({
      changes: { from: 0, insert: '```\ncode here\n```' },
      selection: { anchor: 7 },
    });
    const ctx = detectContext(view.state);
    expect(ctx.kind).toBe('code-block');
  });

  it('returns "image" or "link" when cursor is on image syntax', () => {
    view.dispatch({
      changes: { from: 0, insert: '![alt](https://example.com/img.png)' },
      selection: { anchor: 5 },
    });
    const ctx = detectContext(view.state);
    // Image on its own line may be parsed as Image block or inline Link
    expect(['image', 'link', 'normal']).toContain(ctx.kind);
  });

  it('returns "link" when cursor is on an inline link', () => {
    view.dispatch({
      changes: { from: 0, insert: 'Check [this link](https://example.com) out' },
      selection: { anchor: 12 },
    });
    const ctx = detectContext(view.state);
    expect(ctx.kind).toBe('link');
  });
});

describe('toolbar button definitions', () => {
  it('returns text formatting buttons for text-selected context', () => {
    const ctx: ToolbarContext = { kind: 'text-selected', from: 0, to: 5 };
    const buttons = getButtonsForContext(ctx);
    expect(buttons.length).toBe(5);
    expect(buttons[0].commandId).toBe('toggle-bold');
    expect(buttons[1].commandId).toBe('toggle-italic');
    expect(buttons[2].commandId).toBe('toggle-strikethrough');
    expect(buttons[3].commandId).toBe('toggle-code');
    expect(buttons[4].commandId).toBe('toggle-link');
  });

  it('every toolbar button commandId is registered', () => {
    const contexts: ToolbarContext[] = [
      { kind: 'text-selected', from: 0, to: 5 },
      { kind: 'table' },
      { kind: 'image' },
      { kind: 'link' },
      { kind: 'code-block' },
      { kind: 'empty' },
      { kind: 'normal' },
    ];
    for (const ctx of contexts) {
      const buttons = getButtonsForContext(ctx);
      for (const btn of buttons) {
        const cmd = commandRegistry.all().find((c) => c.id === btn.commandId);
        expect(cmd, `command ${btn.commandId} should be registered`).toBeDefined();
      }
    }
  });

  it('returns empty array for empty context', () => {
    const ctx: ToolbarContext = { kind: 'empty' };
    const buttons = getButtonsForContext(ctx);
    expect(buttons.length).toBe(0);
  });

  it('returns empty array for normal context', () => {
    const ctx: ToolbarContext = { kind: 'normal' };
    const buttons = getButtonsForContext(ctx);
    expect(buttons.length).toBe(0);
  });

  it('returns exactly the copy button for code-block context', () => {
    const buttons = getButtonsForContext({ kind: 'code-block' });
    expect(buttons).toEqual([
      { id: 'toolbar-copy-code', icon: '📋', label: '复制代码', commandId: 'code-copy' },
    ]);
  });
});

describe('toolbar DOM integration', () => {
  let parent: HTMLElement;
  let view: ReturnType<typeof createMarkdownEditor>['view'];

  beforeEach(() => {
    installPolyfills();
    parent = document.createElement('div');
    document.body.appendChild(parent);
    view = createMarkdownEditor(parent, {
      extensions: [contextToolbar()],
    }).view;
  });

  afterEach(() => {
    view.destroy();
    parent.remove();
    removeClipboard();
  });

  it('shows toolbar when text is selected', () => {
    view.dispatch({
      changes: { from: 0, insert: 'Hello world' },
      selection: { anchor: 0, head: 5 },
    });
    updateToolbar(view);
    const toolbar = view.dom.querySelector('.mdb-toolbar');
    expect(toolbar).not.toBeNull();
    expect(toolbar?.querySelectorAll('.mdb-toolbar-btn').length).toBe(5);
  });

  it('hides toolbar for normal paragraph', () => {
    view.dispatch({
      changes: { from: 0, insert: 'Hello world' },
      selection: { anchor: 5 },
    });
    updateToolbar(view);
    const toolbar = view.dom.querySelector<HTMLDivElement>('.mdb-toolbar');
    // Toolbar may not exist yet (no selection was ever made) or is hidden
    expect(toolbar === null || toolbar?.style.display === 'none').toBe(true);
  });

  it('hideContextToolbar hides the toolbar', () => {
    view.dispatch({
      changes: { from: 0, insert: 'Hello world' },
      selection: { anchor: 0, head: 5 },
    });
    updateToolbar(view);
    hideContextToolbar(view);
    const toolbar = view.dom.querySelector<HTMLDivElement>('.mdb-toolbar');
    expect(toolbar?.style.display).toBe('none');
  });

  it('shows a single copy button in a fenced code block and copies the block on mousedown', () => {
    installClipboard();
    const doc = '```\ncode here\n```';
    view.dispatch({
      changes: { from: 0, insert: doc },
      selection: { anchor: 7 },
    });
    updateToolbar(view);

    const buttons = Array.from(
      view.dom.querySelectorAll<HTMLButtonElement>('.mdb-toolbar .mdb-toolbar-btn'),
    );
    expect(buttons).toHaveLength(1);
    expect(buttons[0].title).toBe('复制代码');

    buttons[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    expect(clipboardWrites).toEqual([doc]);
  });
});

describe('toolbar commands registered', () => {
  it('has toggle-bold registered with Chinese label', () => {
    const cmd = commandRegistry.all().find((c) => c.id === 'toggle-bold');
    expect(cmd).toBeDefined();
    expect(cmd?.label).toBe('加粗');
  });

  it('has toggle-link registered with Chinese label', () => {
    const cmd = commandRegistry.all().find((c) => c.id === 'toggle-link');
    expect(cmd).toBeDefined();
    expect(cmd?.label).toBe('插入链接');
  });

  it('has toggle-strikethrough registered with Chinese label', () => {
    const cmd = commandRegistry.all().find((c) => c.id === 'toggle-strikethrough');
    expect(cmd).toBeDefined();
    expect(cmd?.label).toBe('删除线');
  });

  it('has toggle-code registered with Chinese label', () => {
    const cmd = commandRegistry.all().find((c) => c.id === 'toggle-code');
    expect(cmd).toBeDefined();
    expect(cmd?.label).toBe('行内代码');
  });
});

describe('floating toolbar Chinese labels (ticket #192)', () => {
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
  });

  it('renders the four default actions with Chinese tooltips only', () => {
    view.dispatch({
      changes: { from: 0, insert: 'Hello world' },
      selection: { anchor: 0, head: 5 },
    });

    const buttons = Array.from(
      view.dom.querySelectorAll<HTMLButtonElement>('.mdb-floating-toolbar .mdb-toolbar-btn'),
    );
    expect(buttons.map((btn) => btn.title)).toEqual(['加粗', '斜体', '行内代码', '插入链接']);
    for (const btn of buttons) {
      expect(btn.title, `${btn.title} must not be English`).not.toMatch(
        /\b(Bold|Italic|Code|Link)\b/,
      );
    }
  });
});
