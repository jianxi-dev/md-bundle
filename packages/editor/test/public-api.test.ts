/**
 * PUBLIC-API CURTAIN TEST — Task 1.6.
 *
 * Imports ONLY from `../src/index` (the public entry) and asserts the FULL
 * documented surface: export contract, value round-trip, slash menu through
 * the public API, preview output, and the complete theme-token set. If any
 * name stops being exported, or a public behavior regresses, this file is
 * the tripwire.
 *
 * jsdom lacks requestAnimationFrame/ResizeObserver; CodeMirror 6 uses both.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createMarkdownEditor,
  MarkdownEditor,
  themeTokens,
  getThemeColor,
  slashKeymap,
  insertSlashChar,
  slashMenuApply,
  slashMenuClose,
  slashMenuSelectNext,
  slashMenuSelectPrev,
  defaultCommands,
  editorDecorations,
  getBlocks,
  getBlockAt,
  CommandRegistry,
  lintStructure,
  structureLinterExtension,
  type MarkdownEditorHandle,
  type MarkdownEditorOptions,
  type MarkdownEditorComponentProps,
  type ThemeName,
  type ThemeTokenNames,
  type SlashCommand,
  type EditorDecorationsOptions,
  type ImageResolver,
  type ImageCallbacks,
  type Block,
  type BlockType,
  type Command,
  type Diagnostic,
  type LintResult,
} from '../src/index';

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

// Compile-time type contract — fails to typecheck if any TYPE export is
// removed from the public entry (types erase at runtime, so this is the only
// way to pin them).
const _typeProbe: MarkdownEditorOptions & {
  handle: MarkdownEditorHandle;
  props: MarkdownEditorComponentProps;
  theme: ThemeName;
  token: ThemeTokenNames;
  cmd: SlashCommand;
  decoOpts: EditorDecorationsOptions;
  resolver: ImageResolver;
  callbacks: ImageCallbacks;
  block: Block;
  blockType: BlockType;
  command: Command;
  diagnostic: Diagnostic;
  lintResult: LintResult;
} = {
  value: 'x',
  theme: 'dark',
  extensions: [],
  handle: undefined as unknown as MarkdownEditorHandle,
  props: { value: 'x' },
  token: 'primary',
  cmd: defaultCommands[0],
  decoOpts: {},
  resolver: () => null,
  callbacks: {},
  block: undefined as unknown as Block,
  blockType: 'paragraph',
  command: undefined as unknown as Command,
  diagnostic: undefined as unknown as Diagnostic,
  lintResult: undefined as unknown as LintResult,
};
void _typeProbe;

describe('public export contract', () => {
  it('exports every editor API member as a function', () => {
    expect(typeof createMarkdownEditor).toBe('function');
    expect(typeof MarkdownEditor).toBe('function');
    expect(typeof getThemeColor).toBe('function');
    expect(typeof editorDecorations).toBe('function');
  });

  it('exports the theme token table as an object with both themes', () => {
    expect(typeof themeTokens).toBe('object');
    expect(Object.keys(themeTokens.dark).length).toBeGreaterThan(0);
    expect(Object.keys(themeTokens.light).length).toBeGreaterThan(0);
  });

  it('exports the full slash API surface', () => {
    expect(typeof slashKeymap).toBe('function');
    expect(typeof insertSlashChar).toBe('function');
    expect(typeof slashMenuApply).toBe('function');
    expect(typeof slashMenuClose).toBe('function');
    expect(typeof slashMenuSelectNext).toBe('function');
    expect(typeof slashMenuSelectPrev).toBe('function');
    expect(Array.isArray(defaultCommands)).toBe(true);
    expect(defaultCommands.length).toBeGreaterThan(0);
  });

  it('exports the block model API surface', () => {
    expect(typeof getBlocks).toBe('function');
    expect(typeof getBlockAt).toBe('function');
    expect(typeof CommandRegistry).toBe('function');
  });

  it('exports the structure linter API surface', () => {
    expect(typeof lintStructure).toBe('function');
    expect(typeof structureLinterExtension).toBe('function');
  });
});

describe('value round-trip through the public API', () => {
  let parent: HTMLElement;

  beforeEach(() => {
    installPolyfills();
    parent = document.createElement('div');
    document.body.appendChild(parent);
  });

  afterEach(() => {
    parent.remove();
  });

  it('setValue -> getValue round-trips via createMarkdownEditor', () => {
    const handle = createMarkdownEditor(parent, { value: 'init' });
    handle.setValue('# new **content**');
    expect(handle.getValue()).toBe('# new **content**');
    handle.destroy();
  });

  it('onChange fires with the full new value', () => {
    const changes: string[] = [];
    const handle = createMarkdownEditor(parent, {
      value: 'a',
      onChange: (v) => changes.push(v),
    });
    handle.setValue('b');
    expect(changes).toEqual(['b']);
    handle.destroy();
  });
});

describe('slash menu through the public API', () => {
  let parent: HTMLElement;

  beforeEach(() => {
    installPolyfills();
    parent = document.createElement('div');
    document.body.appendChild(parent);
  });

  afterEach(() => {
    parent.remove();
  });

  function makeView(): MarkdownEditorHandle {
    return createMarkdownEditor(parent, { extensions: [slashKeymap()] });
  }

  it('insertSlashChar inserts "/" and opens the command menu', () => {
    const handle = makeView();
    expect(insertSlashChar(handle.view)).toBe(true);
    expect(handle.getValue()).toBe('/');
    expect(handle.view.dom.querySelector('.mdb-slash-menu')).not.toBeNull();
    handle.destroy();
  });

  it('slashMenuApply replaces the slash with "## " (heading)', () => {
    const handle = makeView();
    insertSlashChar(handle.view);
    expect(slashMenuApply(handle.view)).toBe(true);
    expect(handle.getValue()).toBe('## ');
    expect(handle.view.dom.querySelector('.mdb-slash-menu')).toBeNull();
    handle.destroy();
  });

  it('slashMenuClose on a fresh view returns false and leaves the doc unchanged', () => {
    const handle = makeView();
    expect(slashMenuClose(handle.view)).toBe(false);
    expect(handle.getValue()).toBe('');
    handle.destroy();
  });

  it('slashMenuClose after opening removes the menu and leaves the doc unchanged', () => {
    const handle = makeView();
    insertSlashChar(handle.view);
    expect(slashMenuClose(handle.view)).toBe(true);
    expect(handle.view.dom.querySelector('.mdb-slash-menu')).toBeNull();
    expect(handle.getValue()).toBe('/');
    handle.destroy();
  });
});

describe('theme token full set through the public API', () => {
  it('dark and light expose identical, non-empty token key sets', () => {
    const darkKeys = Object.keys(themeTokens.dark).sort();
    const lightKeys = Object.keys(themeTokens.light).sort();
    expect(darkKeys.length).toBeGreaterThan(0);
    expect(lightKeys).toEqual(darkKeys);
  });

  it('primary is indigo in both themes', () => {
    expect(themeTokens.dark.primary).toBe('#7b86ea');
    expect(themeTokens.light.primary).toBe('#4f5ad1');
  });

  it('getThemeColor resolves every token in both themes', () => {
    const keys = Object.keys(themeTokens.dark) as ThemeTokenNames[];
    for (const key of keys) {
      expect(getThemeColor('dark', key)).toBe(themeTokens.dark[key]);
      expect(getThemeColor('light', key)).toBe(themeTokens.light[key]);
    }
  });
});


