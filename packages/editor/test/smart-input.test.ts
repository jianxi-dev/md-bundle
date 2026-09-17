import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMarkdownEditor } from '../src/editor';
import {
  handleMarkdownShortcut,
  smartEnter,
  smartBackspace,
  handleAutoPair,
  handleChinesePair,
  smartInput,
} from '../src/smart-input';

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

describe('markdown shortcuts', () => {
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

  it('converts "# " to heading shortcut', () => {
    view.dispatch({
      changes: { from: 0, insert: '# ' },
      selection: { anchor: 2 },
    });
    const result = handleMarkdownShortcut(view);
    expect(result).toBe(true);
    expect(view.state.doc.toString()).toBe('# ');
  });

  it('converts "> " to blockquote', () => {
    view.dispatch({
      changes: { from: 0, insert: '> ' },
      selection: { anchor: 2 },
    });
    const result = handleMarkdownShortcut(view);
    expect(result).toBe(true);
    expect(view.state.doc.toString()).toBe('> ');
  });

  it('converts "``` " to code fence', () => {
    view.dispatch({
      changes: { from: 0, insert: '``` ' },
      selection: { anchor: 4 },
    });
    const result = handleMarkdownShortcut(view);
    expect(result).toBe(true);
    expect(view.state.doc.toString()).toBe('```\n\n```');
  });

  it('returns false for non-shortcut text', () => {
    view.dispatch({
      changes: { from: 0, insert: 'hello ' },
      selection: { anchor: 6 },
    });
    const result = handleMarkdownShortcut(view);
    expect(result).toBe(false);
  });
});

describe('smart enter', () => {
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

  it('continues a bullet list', () => {
    view.dispatch({
      changes: { from: 0, insert: '- item' },
      selection: { anchor: 6 },
    });
    const result = smartEnter(view);
    expect(result).toBe(true);
    expect(view.state.doc.toString()).toBe('- item\n- ');
  });

  it('continues an ordered list with incrementing number', () => {
    view.dispatch({
      changes: { from: 0, insert: '1. item' },
      selection: { anchor: 7 },
    });
    const result = smartEnter(view);
    expect(result).toBe(true);
    expect(view.state.doc.toString()).toBe('1. item\n2. ');
  });

  it('exits list on empty item', () => {
    view.dispatch({
      changes: { from: 0, insert: '- ' },
      selection: { anchor: 2 },
    });
    const result = smartEnter(view);
    expect(result).toBe(true);
    expect(view.state.doc.toString()).toBe('');
  });

  it('continues a blockquote', () => {
    view.dispatch({
      changes: { from: 0, insert: '> quoted text' },
      selection: { anchor: 13 },
    });
    const result = smartEnter(view);
    expect(result).toBe(true);
    expect(view.state.doc.toString()).toBe('> quoted text\n> ');
  });

  it('exits blockquote on empty line', () => {
    view.dispatch({
      changes: { from: 0, insert: '> ' },
      selection: { anchor: 2 },
    });
    const result = smartEnter(view);
    expect(result).toBe(true);
    expect(view.state.doc.toString()).toBe('');
  });

  it('preserves indentation in code block', () => {
    const doc = '```\n    indented code\n```';
    view.dispatch({
      changes: { from: 0, insert: doc },
      selection: { anchor: doc.indexOf('code') + 4 },
    });
    const result = smartEnter(view);
    expect(result).toBe(true);
    expect(view.state.doc.toString()).toContain('\n    \n');
  });

  it('returns false for non-list paragraph', () => {
    view.dispatch({
      changes: { from: 0, insert: 'Hello world' },
      selection: { anchor: 11 },
    });
    const result = smartEnter(view);
    expect(result).toBe(false);
  });
});

describe('smart backspace', () => {
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

  it('removes list marker at start of empty list item', () => {
    view.dispatch({
      changes: { from: 0, insert: '- ' },
      selection: { anchor: 2 },
    });
    const result = smartBackspace(view);
    expect(result).toBe(true);
    expect(view.state.doc.toString()).toBe('');
  });

  it('removes ordered list marker at start of empty item', () => {
    view.dispatch({
      changes: { from: 0, insert: '1. ' },
      selection: { anchor: 3 },
    });
    const result = smartBackspace(view);
    expect(result).toBe(true);
    expect(view.state.doc.toString()).toBe('');
  });

  it('removes blockquote marker at start of empty quote', () => {
    view.dispatch({
      changes: { from: 0, insert: '> ' },
      selection: { anchor: 2 },
    });
    const result = smartBackspace(view);
    expect(result).toBe(true);
    expect(view.state.doc.toString()).toBe('');
  });

  it('returns false for non-empty content', () => {
    view.dispatch({
      changes: { from: 0, insert: '- item' },
      selection: { anchor: 6 },
    });
    const result = smartBackspace(view);
    expect(result).toBe(false);
  });
});

describe('auto-pairing', () => {
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

  it('wraps selection with bold markers', () => {
    view.dispatch({
      changes: { from: 0, insert: 'Hello world' },
      selection: { anchor: 0, head: 5 },
    });
    const result = handleAutoPair(view, '**');
    expect(result).toBe(true);
    expect(view.state.doc.toString()).toBe('**Hello** world');
  });

  it('wraps selection with inline code', () => {
    view.dispatch({
      changes: { from: 0, insert: 'some code here' },
      selection: { anchor: 5, head: 9 },
    });
    const result = handleAutoPair(view, '`');
    expect(result).toBe(true);
    expect(view.state.doc.toString()).toBe('some `code` here');
  });

  it('wraps selection with dollar signs (math)', () => {
    view.dispatch({
      changes: { from: 0, insert: 'E = mc^2' },
      selection: { anchor: 0, head: 8 },
    });
    const result = handleAutoPair(view, '$');
    expect(result).toBe(true);
    expect(view.state.doc.toString()).toBe('$E = mc^2$');
  });

  it('wraps selection with brackets (link)', () => {
    view.dispatch({
      changes: { from: 0, insert: 'click here' },
      selection: { anchor: 0, head: 5 },
    });
    const result = handleAutoPair(view, '[');
    expect(result).toBe(true);
    expect(view.state.doc.toString()).toBe('[click] here');
  });

  it('creates image link with ![]', () => {
    view.dispatch({
      changes: { from: 0, insert: 'alt text' },
      selection: { anchor: 0, head: 8 },
    });
    const result = handleAutoPair(view, '![');
    expect(result).toBe(true);
    expect(view.state.doc.toString()).toBe('![alt text](url)');
  });

  it('inserts pair at cursor when no selection', () => {
    view.dispatch({
      changes: { from: 0, insert: 'hello' },
      selection: { anchor: 5 },
    });
    const result = handleAutoPair(view, '**');
    expect(result).toBe(true);
    expect(view.state.doc.toString()).toBe('hello****');
    expect(view.state.selection.main.head).toBe(7);
  });

  it('returns false for unregistered character', () => {
    view.dispatch({
      changes: { from: 0, insert: 'hello' },
      selection: { anchor: 5 },
    });
    const result = handleAutoPair(view, '#');
    expect(result).toBe(false);
  });
});

describe('chinese punctuation pairing', () => {
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

  it('pairs 「 with 」', () => {
    view.dispatch({
      changes: { from: 0, insert: 'hello' },
      selection: { anchor: 5 },
    });
    const result = handleChinesePair(view, '「');
    expect(result).toBe(true);
    expect(view.state.doc.toString()).toBe('hello「」');
    expect(view.state.selection.main.head).toBe(6);
  });

  it('pairs （ with ）', () => {
    view.dispatch({
      changes: { from: 0, insert: 'hello' },
      selection: { anchor: 5 },
    });
    const result = handleChinesePair(view, '（');
    expect(result).toBe(true);
    expect(view.state.doc.toString()).toBe('hello（）');
  });

  it('pairs 【 with 】', () => {
    view.dispatch({
      changes: { from: 0, insert: 'hello' },
      selection: { anchor: 5 },
    });
    const result = handleChinesePair(view, '【');
    expect(result).toBe(true);
    expect(view.state.doc.toString()).toBe('hello【】');
  });

  it('wraps selection with chinese brackets', () => {
    view.dispatch({
      changes: { from: 0, insert: 'hello world' },
      selection: { anchor: 0, head: 5 },
    });
    const result = handleChinesePair(view, '「');
    expect(result).toBe(true);
    expect(view.state.doc.toString()).toBe('「hello」 world');
  });

  it('returns false for non-chinese character', () => {
    view.dispatch({
      changes: { from: 0, insert: 'hello' },
      selection: { anchor: 5 },
    });
    const result = handleChinesePair(view, '(');
    expect(result).toBe(false);
  });
});

describe('smartInput extension', () => {
  it('returns an array of extensions', () => {
    const ext = smartInput();
    expect(Array.isArray(ext)).toBe(true);
  });
});
