import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { createMarkdownEditor } from '../src/editor';
import { editorKeybindings, runCommandById, formatKeyChord, isMacPlatform } from '../src/keybindings';
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

  it('heading-4 has group 块', () => {
    const cmd = commandRegistry.all().find((c) => c.id === 'heading-4');
    expect(cmd?.group).toBe('块');
  });

  it('heading-5 has group 块', () => {
    const cmd = commandRegistry.all().find((c) => c.id === 'heading-5');
    expect(cmd?.group).toBe('块');
  });

  it('heading-6 has group 块', () => {
    const cmd = commandRegistry.all().find((c) => c.id === 'heading-6');
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

describe('formatKeyChord / isMacPlatform (ticket #335)', () => {
  // All real chords from EDITOR_KEYBINDINGS + commands.ts
  const chords = [
    'Mod-b',
    'Mod-i',
    'Mod-Shift-x',
    'Mod-e',
    'Mod-l',
    'Mod-Shift-7',
    'Mod-Shift-8',
    'Mod-Shift-9',
    'Mod-Alt-1',
    'Mod-Alt-2',
    'Mod-Alt-3',
    'Mod-Alt-4',
    'Mod-Alt-5',
    'Mod-Alt-6',
  ] as const;

  describe('isMacPlatform', () => {
    it('returns false in jsdom (no navigator.platform)', () => {
      // jsdom default: navigator.platform === ''
      expect(isMacPlatform()).toBe(false);
    });
  });

  describe('mac formatting (isMac=true)', () => {
    it.each(chords)('formats %s correctly on mac', (chord) => {
      const result = formatKeyChord(chord, true);
      expect(result).toBeTruthy();
      // Mac: no separator, Mod→⌘, Shift→⇧, Alt→⌥
      expect(result).not.toContain('+');
      expect(result).not.toContain('Mod');
      expect(result).not.toContain('Shift');
      expect(result).not.toContain('Alt');
      expect(result).not.toContain('ctrl');
      expect(result).not.toContain('CMD');
    });

    it('Mod-b → ⌘B', () => {
      expect(formatKeyChord('Mod-b', true)).toBe('⌘B');
    });

    it('Mod-i → ⌘I', () => {
      expect(formatKeyChord('Mod-i', true)).toBe('⌘I');
    });

    it('Mod-Shift-x → ⌘⇧X', () => {
      expect(formatKeyChord('Mod-Shift-x', true)).toBe('⌘⇧X');
    });

    it('Mod-e → ⌘E', () => {
      expect(formatKeyChord('Mod-e', true)).toBe('⌘E');
    });

    it('Mod-l → ⌘L', () => {
      expect(formatKeyChord('Mod-l', true)).toBe('⌘L');
    });

    it('Mod-Shift-7 → ⌘⇧7', () => {
      expect(formatKeyChord('Mod-Shift-7', true)).toBe('⌘⇧7');
    });

    it('Mod-Shift-8 → ⌘⇧8', () => {
      expect(formatKeyChord('Mod-Shift-8', true)).toBe('⌘⇧8');
    });

    it('Mod-Shift-9 → ⌘⇧9', () => {
      expect(formatKeyChord('Mod-Shift-9', true)).toBe('⌘⇧9');
    });

    it('Mod-Alt-1 → ⌘⌥1', () => {
      expect(formatKeyChord('Mod-Alt-1', true)).toBe('⌘⌥1');
    });

    it('Mod-Alt-2 → ⌘⌥2', () => {
      expect(formatKeyChord('Mod-Alt-2', true)).toBe('⌘⌥2');
    });

    it('Mod-Alt-3 → ⌘⌥3', () => {
      expect(formatKeyChord('Mod-Alt-3', true)).toBe('⌘⌥3');
    });

    it('Mod-Alt-4 → ⌘⌥4', () => {
      expect(formatKeyChord('Mod-Alt-4', true)).toBe('⌘⌥4');
    });

    it('Mod-Alt-5 → ⌘⌥5', () => {
      expect(formatKeyChord('Mod-Alt-5', true)).toBe('⌘⌥5');
    });

    it('Mod-Alt-6 → ⌘⌥6', () => {
      expect(formatKeyChord('Mod-Alt-6', true)).toBe('⌘⌥6');
    });
  });

  describe('non-mac formatting (isMac=false)', () => {
    it.each(chords)('formats %s correctly on non-mac', (chord) => {
      const result = formatKeyChord(chord, false);
      expect(result).toBeTruthy();
      // Non-mac: + separator, Mod→Ctrl, Shift→Shift, Alt→Alt
      expect(result).toContain('+');
      expect(result).not.toContain('Mod');
      expect(result).not.toContain('⌘');
      expect(result).not.toContain('⇧');
      expect(result).not.toContain('⌥');
    });

    it('Mod-b → Ctrl+B', () => {
      expect(formatKeyChord('Mod-b', false)).toBe('Ctrl+B');
    });

    it('Mod-i → Ctrl+I', () => {
      expect(formatKeyChord('Mod-i', false)).toBe('Ctrl+I');
    });

    it('Mod-Shift-x → Ctrl+Shift+X', () => {
      expect(formatKeyChord('Mod-Shift-x', false)).toBe('Ctrl+Shift+X');
    });

    it('Mod-e → Ctrl+E', () => {
      expect(formatKeyChord('Mod-e', false)).toBe('Ctrl+E');
    });

    it('Mod-l → Ctrl+L', () => {
      expect(formatKeyChord('Mod-l', false)).toBe('Ctrl+L');
    });

    it('Mod-Shift-7 → Ctrl+Shift+7', () => {
      expect(formatKeyChord('Mod-Shift-7', false)).toBe('Ctrl+Shift+7');
    });

    it('Mod-Shift-8 → Ctrl+Shift+8', () => {
      expect(formatKeyChord('Mod-Shift-8', false)).toBe('Ctrl+Shift+8');
    });

    it('Mod-Shift-9 → Ctrl+Shift+9', () => {
      expect(formatKeyChord('Mod-Shift-9', false)).toBe('Ctrl+Shift+9');
    });

    it('Mod-Alt-1 → Ctrl+Alt+1', () => {
      expect(formatKeyChord('Mod-Alt-1', false)).toBe('Ctrl+Alt+1');
    });

    it('Mod-Alt-2 → Ctrl+Alt+2', () => {
      expect(formatKeyChord('Mod-Alt-2', false)).toBe('Ctrl+Alt+2');
    });

    it('Mod-Alt-3 → Ctrl+Alt+3', () => {
      expect(formatKeyChord('Mod-Alt-3', false)).toBe('Ctrl+Alt+3');
    });

    it('Mod-Alt-4 → Ctrl+Alt+4', () => {
      expect(formatKeyChord('Mod-Alt-4', false)).toBe('Ctrl+Alt+4');
    });

    it('Mod-Alt-5 → Ctrl+Alt+5', () => {
      expect(formatKeyChord('Mod-Alt-5', false)).toBe('Ctrl+Alt+5');
    });

    it('Mod-Alt-6 → Ctrl+Alt+6', () => {
      expect(formatKeyChord('Mod-Alt-6', false)).toBe('Ctrl+Alt+6');
    });
  });

  describe('edge cases', () => {
    it('empty string returns empty', () => {
      expect(formatKeyChord('', true)).toBe('');
      expect(formatKeyChord('', false)).toBe('');
    });

    it('unknown tokens are uppercased and passed through', () => {
      expect(formatKeyChord('Mod-Unknown', true)).toBe('⌘UNKNOWN');
      expect(formatKeyChord('Mod-Unknown', false)).toBe('Ctrl+UNKNOWN');
    });

    it('extra hyphens produce empty tokens that are filtered', () => {
      expect(formatKeyChord('Mod--b', true)).toBe('⌘B');
      expect(formatKeyChord('Mod--b', false)).toBe('Ctrl+B');
    });

    it('whitespace around tokens is trimmed', () => {
      expect(formatKeyChord(' Mod - b ', true)).toBe('⌘B');
      expect(formatKeyChord(' Mod - b ', false)).toBe('Ctrl+B');
    });

    it('case-insensitive token matching', () => {
      expect(formatKeyChord('mod-b', true)).toBe('⌘B');
      expect(formatKeyChord('MOD-B', false)).toBe('Ctrl+B');
      expect(formatKeyChord('mod-shift-x', true)).toBe('⌘⇧X');
      expect(formatKeyChord('mod-alt-1', false)).toBe('Ctrl+Alt+1');
    });
  });
});
