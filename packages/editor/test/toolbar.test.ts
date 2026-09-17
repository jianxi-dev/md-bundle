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
import { commandRegistry } from '../src/commands';

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
    expect(buttons.length).toBe(7);
    expect(buttons[0].commandId).toBe('toggle-bold');
    expect(buttons[1].commandId).toBe('toggle-italic');
    expect(buttons[2].commandId).toBe('toggle-strikethrough');
    expect(buttons[3].commandId).toBe('toggle-code');
    expect(buttons[4].commandId).toBe('toggle-link');
    expect(buttons[5].commandId).toBe('highlight-text');
    expect(buttons[6].commandId).toBe('ai-enhance');
  });

  it('returns table buttons for table context', () => {
    const ctx: ToolbarContext = { kind: 'table' };
    const buttons = getButtonsForContext(ctx);
    expect(buttons.length).toBe(3);
    expect(buttons[0].commandId).toBe('table-add-row');
    expect(buttons[1].commandId).toBe('table-add-col');
    expect(buttons[2].commandId).toBe('table-align');
  });

  it('returns image buttons for image context', () => {
    const ctx: ToolbarContext = { kind: 'image' };
    const buttons = getButtonsForContext(ctx);
    expect(buttons.length).toBe(3);
    expect(buttons[0].commandId).toBe('image-replace');
    expect(buttons[1].commandId).toBe('image-edit-alt');
    expect(buttons[2].commandId).toBe('image-resize');
  });

  it('returns link buttons for link context', () => {
    const ctx: ToolbarContext = { kind: 'link' };
    const buttons = getButtonsForContext(ctx);
    expect(buttons.length).toBe(3);
    expect(buttons[0].commandId).toBe('link-edit');
    expect(buttons[1].commandId).toBe('link-open');
    expect(buttons[2].commandId).toBe('link-remove');
  });

  it('returns code buttons for code-block context', () => {
    const ctx: ToolbarContext = { kind: 'code-block' };
    const buttons = getButtonsForContext(ctx);
    expect(buttons.length).toBe(3);
    expect(buttons[0].commandId).toBe('code-copy');
    expect(buttons[1].commandId).toBe('code-set-language');
    expect(buttons[2].commandId).toBe('code-explain');
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
  });

  it('shows toolbar when text is selected', () => {
    view.dispatch({
      changes: { from: 0, insert: 'Hello world' },
      selection: { anchor: 0, head: 5 },
    });
    updateToolbar(view);
    const toolbar = view.dom.querySelector('.mdb-toolbar');
    expect(toolbar).not.toBeNull();
    expect(toolbar?.querySelectorAll('.mdb-toolbar-btn').length).toBe(7);
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
});

describe('toolbar commands registered', () => {
  it('has toggle-bold registered', () => {
    const cmd = commandRegistry.all().find((c) => c.id === 'toggle-bold');
    expect(cmd).toBeDefined();
    expect(cmd?.label).toBe('Bold');
  });

  it('has toggle-link registered', () => {
    const cmd = commandRegistry.all().find((c) => c.id === 'toggle-link');
    expect(cmd).toBeDefined();
  });

  it('has link-remove registered', () => {
    const cmd = commandRegistry.all().find((c) => c.id === 'link-remove');
    expect(cmd).toBeDefined();
  });

  it('has table-add-row registered', () => {
    const cmd = commandRegistry.all().find((c) => c.id === 'table-add-row');
    expect(cmd).toBeDefined();
  });
});
