/**
 * Command registry tests — verifies CommandRegistry behavior.
 *
 * Tests registration, lookup, availability filtering, execution,
 * and key-binding resolution.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMarkdownEditor } from '../src/editor';
import { CommandRegistry, commandRegistry, type Command } from '../src/commands';
import { EDITOR_KEYBINDINGS } from '../src/keybindings';

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

// jsdom lacks requestAnimationFrame/ResizeObserver; CodeMirror 6 uses both.
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

function makeCommand(overrides: Partial<Command> = {}): Command {
  return {
    id: 'test-cmd',
    label: 'Test Command',
    execute: () => {},
    ...overrides,
  };
}

describe('CommandRegistry', () => {
  it('registers and retrieves a command by id', () => {
    const registry = new CommandRegistry();
    const cmd = makeCommand({ id: 'foo', label: 'Foo' });
    registry.register(cmd);
    expect(registry.execute('foo', undefined as never)).toBeUndefined();
  });

  it('returns null for an unregistered command id', () => {
    const registry = new CommandRegistry();
    expect(registry.getKeyBinding('nonexistent')).toBeNull();
  });

  it('returns the key binding for a registered command', () => {
    const registry = new CommandRegistry();
    const cmd = makeCommand({ id: 'bold', keyBinding: 'Mod-b' });
    registry.register(cmd);
    expect(registry.getKeyBinding('bold')).toBe('Mod-b');
  });

  it('returns null for a command without a key binding', () => {
    const registry = new CommandRegistry();
    const cmd = makeCommand({ id: 'plain' });
    registry.register(cmd);
    expect(registry.getKeyBinding('plain')).toBeNull();
  });

  it('overwrites a command with the same id (last-write-wins)', () => {
    const registry = new CommandRegistry();
    const cmd1 = makeCommand({ id: 'dup', label: 'First' });
    const cmd2 = makeCommand({ id: 'dup', label: 'Second' });
    registry.register(cmd1);
    registry.register(cmd2);
    expect(registry.all()).toHaveLength(1);
    expect(registry.all()[0].label).toBe('Second');
  });

  it('returns all registered commands via all()', () => {
    const registry = new CommandRegistry();
    registry.register(makeCommand({ id: 'a' }));
    registry.register(makeCommand({ id: 'b' }));
    registry.register(makeCommand({ id: 'c' }));
    expect(registry.all()).toHaveLength(3);
  });

  it('filters commands by availability', () => {
    const registry = new CommandRegistry();
    registry.register(makeCommand({ id: 'always' }));
    registry.register(
      makeCommand({
        id: 'conditional',
        available: () => false,
      }),
    );
    const available = registry.getAvailable(undefined as never);
    expect(available).toHaveLength(1);
    expect(available[0].id).toBe('always');
  });

  it('returns all commands when none have availability guards', () => {
    const registry = new CommandRegistry();
    registry.register(makeCommand({ id: 'x' }));
    registry.register(makeCommand({ id: 'y' }));
    expect(registry.getAvailable(undefined as never)).toHaveLength(2);
  });

  it('executes a command by id', () => {
    const registry = new CommandRegistry();
    let executed = false;
    registry.register(
      makeCommand({
        id: 'run-me',
        execute: () => {
          executed = true;
        },
      }),
    );
    registry.execute('run-me', undefined as never);
    expect(executed).toBe(true);
  });

  it('no-ops when executing an unregistered command', () => {
    const registry = new CommandRegistry();
    expect(() => registry.execute('missing', undefined as never)).not.toThrow();
  });

  it('preserves the optional group field', () => {
    const registry = new CommandRegistry();
    const cmd = makeCommand({ id: 'g', label: 'G', group: '格式' });
    registry.register(cmd);
    expect(registry.all()[0].group).toBe('格式');
  });

  it('group is optional and defaults to undefined', () => {
    const registry = new CommandRegistry();
    const cmd = makeCommand({ id: 'h', label: 'H' });
    registry.register(cmd);
    expect(registry.all()[0].group).toBeUndefined();
  });
});

describe('CommandRegistry.has', () => {
  it('returns true for a registered id', () => {
    const registry = new CommandRegistry();
    registry.register(makeCommand({ id: 'present' }));
    expect(registry.has('present')).toBe(true);
  });

  it('returns false for an unknown id', () => {
    const registry = new CommandRegistry();
    expect(registry.has('absent')).toBe(false);
  });
});

describe('canonical registry contents', () => {
  it('contains no duplicate ids', () => {
    const ids = commandRegistry.all().map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('does not contain slash-menu-only ids', () => {
    // The slash menu renders from its own defaultCommands array; registering
    // them here would duplicate heading/table/quote/code-block/callout rows
    // in the palette.
    const slashOnlyIds = ['heading', 'callout', 'image-ref', 'code-block', 'table', 'quote'];
    for (const id of slashOnlyIds) {
      expect(commandRegistry.has(id), `slash-only id ${id} must not be registered`).toBe(false);
    }
  });

  it('has exactly one command per capability', () => {
    const ids = commandRegistry.all().map((c) => c.id);
    const headingIds = ids.filter((id) => id.startsWith('heading-'));
    expect(headingIds).toEqual(['heading-1', 'heading-2', 'heading-3']);
    expect(ids).toContain('insert-table');
    expect(ids).toContain('insert-quote');
    expect(ids).toContain('insert-code-block');
    expect(ids).toContain('insert-callout');
    expect(ids).toContain('insert-html');
    expect(ids).toContain('insert-css');
  });

  it('uses only the canonical group values', () => {
    const groups = commandRegistry.all().map((c) => c.group);
    for (const group of groups) {
      expect([undefined, '格式', '块', '视图', '插入', '体检']).toContain(group);
    }
  });

  it('labels the callout command in Chinese', () => {
    const callout = commandRegistry.all().find((c) => c.id === 'insert-callout');
    expect(callout?.label).toBe('插入标注');
  });
});

describe('keyBinding drift prevention', () => {
  it('exactly five commands carry a keyBinding', () => {
    const withBinding = commandRegistry.all().filter((c) => c.keyBinding);
    expect(withBinding.map((c) => c.id).sort()).toEqual([
      'toggle-bold',
      'toggle-code',
      'toggle-italic',
      'toggle-link',
      'toggle-strikethrough',
    ]);
  });

  it('every keyBinding matches the chord bound in keybindings.ts', () => {
    // EDITOR_KEYBINDINGS builds the real CM6 keymap, so this comparison can
    // never drift from the chord the editor actually listens for.
    for (const { id, chord } of EDITOR_KEYBINDINGS) {
      expect(commandRegistry.getKeyBinding(id), `${id} chord drift`).toBe(chord);
    }
  });

  it('the registry and the keymap expose the same bound command ids', () => {
    const registryBound = commandRegistry.all().filter((c) => c.keyBinding).map((c) => c.id).sort();
    expect(registryBound).toEqual(EDITOR_KEYBINDINGS.map((b) => b.id).sort());
  });

  it('commands without a real binding have no keyBinding', () => {
    const boundIds = new Set(EDITOR_KEYBINDINGS.map((binding) => binding.id));
    for (const cmd of commandRegistry.all()) {
      if (!boundIds.has(cmd.id)) {
        expect(cmd.keyBinding, `${cmd.id} must not have a keyBinding`).toBeUndefined();
      }
    }
  });
});

describe('code-copy command (ticket #192)', () => {
  let parent: HTMLElement;
  let view: ReturnType<typeof createMarkdownEditor>['view'];

  beforeEach(() => {
    installPolyfills();
    installClipboard();
    parent = document.createElement('div');
    document.body.appendChild(parent);
    view = createMarkdownEditor(parent).view;
  });

  afterEach(() => {
    view.destroy();
    parent.remove();
    removeClipboard();
  });

  it('copies the current selection', () => {
    view.dispatch({
      changes: { from: 0, insert: 'hello world' },
      selection: { anchor: 0, head: 5 },
    });
    commandRegistry.execute('code-copy', view);
    expect(clipboardWrites).toEqual(['hello']);
  });

  it('copies the whole fenced block when the selection is empty', () => {
    const doc = '```ts\nconst x = 1\n```';
    view.dispatch({ changes: { from: 0, insert: doc }, selection: { anchor: 8 } });
    commandRegistry.execute('code-copy', view);
    expect(clipboardWrites).toEqual([doc]);
  });

  it('is registered without a key binding', () => {
    expect(commandRegistry.has('code-copy')).toBe(true);
    expect(commandRegistry.getKeyBinding('code-copy')).toBeNull();
  });

  it('does not throw when the Clipboard API is unavailable', () => {
    removeClipboard();
    view.dispatch({
      changes: { from: 0, insert: 'hello world' },
      selection: { anchor: 0, head: 5 },
    });
    expect(() => commandRegistry.execute('code-copy', view)).not.toThrow();
  });

  it('does not throw when writeText rejects', () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error('denied')) },
    });
    view.dispatch({
      changes: { from: 0, insert: 'hello world' },
      selection: { anchor: 0, head: 5 },
    });
    expect(() => commandRegistry.execute('code-copy', view)).not.toThrow();
  });
});

describe('registry insert-html / insert-css semantics', () => {
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

  it('insert-html inserts the centered div at the caret without deleting the preceding character', () => {
    view.dispatch({
      changes: { from: 0, insert: 'ab' },
      selection: { anchor: 2 },
    });
    commandRegistry.execute('insert-html', view);
    expect(view.state.doc.toString()).toBe('ab<div align="center">\n\n</div>');
    expect(view.state.selection.main.head).toBe(23);
  });

  it('insert-css inserts the style block at the caret without deleting the preceding character', () => {
    view.dispatch({
      changes: { from: 0, insert: 'ab' },
      selection: { anchor: 2 },
    });
    commandRegistry.execute('insert-css', view);
    expect(view.state.doc.toString()).toBe('ab<style>\n\n</style>');
    expect(view.state.selection.main.head).toBe(10);
  });
});

describe('command anchors stay within document bounds', () => {
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

  // Both positions expose off-by-one anchors: an anchor past the inserted text
  // is out of range at the doc end, and every command must survive an empty doc.
  const scenarios = [
    { label: 'empty document', doc: '', caret: 0 },
    { label: 'caret at document end', doc: 'hello', caret: 5 },
  ];

  const cases = commandRegistry.all().flatMap((cmd) =>
    scenarios.map((scenario) => ({
      cmd,
      id: cmd.id,
      label: scenario.label,
      doc: scenario.doc,
      caret: scenario.caret,
    })),
  );

  it.each(cases)('$id on $label: no throw and selection in bounds', ({ cmd, doc, caret }) => {
    view.dispatch({ changes: { from: 0, insert: doc }, selection: { anchor: caret } });
    expect(() => cmd.execute(view)).not.toThrow();
    const { main } = view.state.selection;
    expect(main.anchor).toBeGreaterThanOrEqual(0);
    expect(main.anchor).toBeLessThanOrEqual(view.state.doc.length);
    expect(main.head).toBeGreaterThanOrEqual(0);
    expect(main.head).toBeLessThanOrEqual(view.state.doc.length);
  });

  it('insert-callout inserts the NOTE template and lands the caret after it', () => {
    commandRegistry.execute('insert-callout', view);
    expect(view.state.doc.toString()).toBe('> [!NOTE]\n> ');
    expect(view.state.selection.main.head).toBe('> [!NOTE]\n> '.length);
  });

  it('insert-callout at the document end keeps the caret in bounds', () => {
    view.dispatch({ changes: { from: 0, insert: 'hello' }, selection: { anchor: 5 } });
    commandRegistry.execute('insert-callout', view);
    expect(view.state.doc.toString()).toBe('hello> [!NOTE]\n> ');
    expect(view.state.selection.main.head).toBe('hello> [!NOTE]\n> '.length);
  });
});
