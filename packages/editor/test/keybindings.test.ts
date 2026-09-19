import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { createMarkdownEditor } from '../src/editor';
import { editorKeybindings, runCommandById } from '../src/keybindings';
import { commandRegistry } from '../src/commands';

// CM6 resolves `Mod-` to Meta on macOS and Ctrl elsewhere (jsdom reports an
// empty platform), so the synthetic event must carry the same modifier.
const IS_MAC = /Mac/.test(navigator.platform);

function modKeyEvent(key: string): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    metaKey: IS_MAC,
    ctrlKey: !IS_MAC,
  });
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

function makeView() {
  const parent = document.createElement('div');
  document.body.appendChild(parent);
  const view = createMarkdownEditor(parent, {
    extensions: [editorKeybindings()],
  }).view;
  return { parent, view };
}

describe('editorKeybindings', () => {
  let parent: HTMLElement;
  let view: ReturnType<typeof createMarkdownEditor>['view'];

  beforeEach(() => {
    installPolyfills();
    ({ parent, view } = makeView());
  });

  afterEach(() => {
    view.destroy();
    parent.remove();
  });

  it('Mod-b wraps selection with **', () => {
    view.dispatch({
      changes: { from: 0, insert: 'hello world' },
      selection: { anchor: 0, head: 5 },
    });
    commandRegistry.execute('toggle-bold', view);
    expect(view.state.doc.toString()).toBe('**hello** world');
  });

  it('Mod-b on empty selection inserts ** with caret inside', () => {
    view.dispatch({
      changes: { from: 0, insert: '' },
      selection: { anchor: 0 },
    });
    commandRegistry.execute('toggle-bold', view);
    expect(view.state.doc.toString()).toBe('****');
    expect(view.state.selection.main.head).toBe(2);
  });

  it('Mod-i wraps selection with *', () => {
    view.dispatch({
      changes: { from: 0, insert: 'hello world' },
      selection: { anchor: 0, head: 5 },
    });
    commandRegistry.execute('toggle-italic', view);
    expect(view.state.doc.toString()).toBe('*hello* world');
  });

  it('Mod-Shift-x wraps selection with ~~', () => {
    view.dispatch({
      changes: { from: 0, insert: 'hello world' },
      selection: { anchor: 0, head: 5 },
    });
    commandRegistry.execute('toggle-strikethrough', view);
    expect(view.state.doc.toString()).toBe('~~hello~~ world');
  });

  it('Mod-e wraps selection with `', () => {
    view.dispatch({
      changes: { from: 0, insert: 'hello world' },
      selection: { anchor: 0, head: 5 },
    });
    commandRegistry.execute('toggle-code', view);
    expect(view.state.doc.toString()).toBe('`hello` world');
  });

  it('Mod-l wraps selection with [](url)', () => {
    view.dispatch({
      changes: { from: 0, insert: 'hello world' },
      selection: { anchor: 0, head: 5 },
    });
    commandRegistry.execute('toggle-link', view);
    expect(view.state.doc.toString()).toBe('[hello](url) world');
  });

  it('Mod-l on empty selection inserts [](url) with caret inside brackets', () => {
    view.dispatch({
      changes: { from: 0, insert: '' },
      selection: { anchor: 0 },
    });
    commandRegistry.execute('toggle-link', view);
    expect(view.state.doc.toString()).toBe('[](url)');
    expect(view.state.selection.main.head).toBe(1);
  });
});

describe('keybinding fallthrough for unknown command ids', () => {
  let parent: HTMLElement;
  let view: ReturnType<typeof createMarkdownEditor>['view'];

  beforeEach(() => {
    installPolyfills();
    ({ parent, view } = makeView());
  });

  afterEach(() => {
    view.destroy();
    parent.remove();
  });

  it('returns false and leaves the document unchanged when the id is not registered', () => {
    view.dispatch({
      changes: { from: 0, insert: 'hello world' },
      selection: { anchor: 0, head: 5 },
    });
    const run = runCommandById('not-a-registered-command');
    expect(run(view)).toBe(false);
    expect(view.state.doc.toString()).toBe('hello world');
  });

  it('returns true and dispatches the command when the id is registered', () => {
    view.dispatch({
      changes: { from: 0, insert: 'hello world' },
      selection: { anchor: 0, head: 5 },
    });
    const run = runCommandById('toggle-bold');
    expect(run(view)).toBe(true);
    expect(view.state.doc.toString()).toBe('**hello** world');
  });
});

describe('Command.group values', () => {
  it('toggle-bold has group 格式', () => {
    const cmd = commandRegistry.all().find((c) => c.id === 'toggle-bold');
    expect(cmd?.group).toBe('格式');
  });

  it('insert-html has group 插入', () => {
    const cmd = commandRegistry.all().find((c) => c.id === 'insert-html');
    expect(cmd?.group).toBe('插入');
  });

  it('insert-css has group 插入', () => {
    const cmd = commandRegistry.all().find((c) => c.id === 'insert-css');
    expect(cmd?.group).toBe('插入');
  });

  it('structure-check has group 体检', () => {
    const cmd = commandRegistry.all().find((c) => c.id === 'structure-check');
    expect(cmd?.group).toBe('体检');
  });

  it('heading-1 has group 块', () => {
    const cmd = commandRegistry.all().find((c) => c.id === 'heading-1');
    expect(cmd?.group).toBe('块');
  });
});

describe('insert-html and insert-css commands', () => {
  let parent: HTMLElement;
  let view: ReturnType<typeof createMarkdownEditor>['view'];

  beforeEach(() => {
    installPolyfills();
    ({ parent, view } = makeView());
  });

  afterEach(() => {
    view.destroy();
    parent.remove();
  });

  it('insert-html inserts a centered div template', () => {
    commandRegistry.execute('insert-html', view);
    expect(view.state.doc.toString()).toBe('<div align="center">\n\n</div>');
    expect(view.state.selection.main.head).toBe(21);
  });

  it('insert-css inserts a style template', () => {
    commandRegistry.execute('insert-css', view);
    expect(view.state.doc.toString()).toBe('<style>\n\n</style>');
    expect(view.state.selection.main.head).toBe(8);
  });
});

describe('editorKeybindings on real keydown events (ticket #193)', () => {
  let parent: HTMLElement;
  let view: EditorView;

  beforeEach(() => {
    installPolyfills();
    parent = document.createElement('div');
    document.body.appendChild(parent);
    view = new EditorView({
      state: EditorState.create({
        doc: 'hello world',
        extensions: [markdown(), editorKeybindings()],
      }),
      parent,
    });
    view.dispatch({ selection: EditorSelection.range(0, 5) });
  });

  afterEach(() => {
    view.destroy();
    parent.remove();
  });

  it('Mod-b wraps the selected text when the keymap receives a real keydown', () => {
    view.contentDOM.dispatchEvent(modKeyEvent('b'));
    expect(view.state.doc.toString()).toBe('**hello** world');
  });

  it('Mod-e wraps the selected text in backticks', () => {
    view.contentDOM.dispatchEvent(modKeyEvent('e'));
    expect(view.state.doc.toString()).toBe('`hello` world');
  });

  it('an unbound chord leaves the document unchanged', () => {
    view.contentDOM.dispatchEvent(modKeyEvent('j'));
    expect(view.state.doc.toString()).toBe('hello world');
  });
});
