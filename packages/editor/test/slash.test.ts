import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMarkdownEditor } from '../src/editor';
import {
  defaultCommands,
  insertSlashChar,
  slashKeymap,
  slashMenuApply,
  slashMenuClose,
  slashMenuSelectNext,
  slashMenuSelectPrev,
} from '../src/slash';
import { commandRegistry } from '../src/commands';

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

describe('slash commands', () => {
  let parent: HTMLElement;
  let view: ReturnType<typeof createMarkdownEditor>['view'];

  beforeEach(() => {
    installPolyfills();
    parent = document.createElement('div');
    document.body.appendChild(parent);
    // Wire through the real consumer seam; defaultKeymap is added by
    // createMarkdownEditor, so this also exercises binding precedence.
    view = createMarkdownEditor(parent, {
      extensions: [slashKeymap()],
    }).view;
  });

  afterEach(() => {
    view.destroy();
    parent.remove();
  });

  it('typing "/" inserts the slash and opens the command menu', () => {
    const inserted = insertSlashChar(view);
    expect(inserted).toBe(true);
    expect(view.state.doc.toString()).toBe('/');
    expect(view.dom.querySelector('.mdb-slash-menu')).not.toBeNull();
    expect(view.dom.querySelectorAll('.mdb-slash-item').length).toBe(8);
  });

  it('positions the menu relative to the editor origin, not the viewport (issue #203)', () => {
    // Regression lock for #203: coordsAtPos returns VIEWPORT coordinates, but
    // the menu is an absolutely positioned child of view.dom. Writing viewport
    // coords straight into left/top offsets the menu by the editor's page
    // origin. The bug is invisible unless the two origins differ, so both are
    // stubbed here with deliberately different origins.
    vi.spyOn(view, 'coordsAtPos').mockReturnValue({
      left: 456,
      right: 470,
      top: 370,
      bottom: 399,
    });
    vi.spyOn(view.dom, 'getBoundingClientRect').mockReturnValue(new DOMRect(220, 122, 800, 600));

    insertSlashChar(view);

    const menu = view.dom.querySelector<HTMLElement>('.mdb-slash-menu');
    expect(menu).not.toBeNull();
    // Expected: 456 - 220 = 236; 399 + 4 - 122 = 281.
    expect(menu?.style.left).toBe('236px');
    expect(menu?.style.top).toBe('281px');
  });

  it('applying the heading command replaces the slash with "## " and puts the cursor at the end', () => {
    insertSlashChar(view);
    const applied = slashMenuApply(view);
    expect(applied).toBe(true);
    expect(view.state.doc.toString()).toBe('## ');
    expect(view.dom.querySelector('.mdb-slash-menu')).toBeNull();
    expect(view.state.selection.main.head).toBe(view.state.doc.length);
  });

  it('applying the callout command inserts a standard "> [!NOTE]" blockquote', () => {
    insertSlashChar(view);
    slashMenuSelectNext(view); // row 1 = callout
    slashMenuApply(view);
    const doc = view.state.doc.toString();
    expect(doc).toContain('> [!NOTE]');
    expect(doc).toMatch(/^> \[!NOTE\]\n> $/);
  });

  it('labels the callout slash command in Chinese', () => {
    const callout = defaultCommands.find((c) => c.id === 'callout');
    expect(callout?.label).toBe('标注');
    expect(callout?.hint).toBe('> [!NOTE]');
  });

  it('Escape closes the menu without inserting anything', () => {
    insertSlashChar(view);
    const closed = slashMenuClose(view);
    expect(closed).toBe(true);
    expect(view.dom.querySelector('.mdb-slash-menu')).toBeNull();
    expect(view.state.doc.toString()).toBe('/');
  });

  it('a second consecutive "/" while the menu is open does not double-insert', () => {
    insertSlashChar(view);
    const second = insertSlashChar(view);
    expect(second).toBe(false);
    expect(view.dom.querySelector('.mdb-slash-menu')).toBeNull();
    expect(view.state.doc.toString()).toBe('/');
  });

  it('typing any other character closes the menu and leaves the slash', () => {
    insertSlashChar(view);
    view.dispatch({ changes: { from: view.state.doc.length, insert: 'x' } });
    expect(view.dom.querySelector('.mdb-slash-menu')).toBeNull();
    expect(view.state.doc.toString()).toBe('/x');
  });

  it('ArrowDown/ArrowUp navigate the selected item', () => {
    insertSlashChar(view);
    const items = () => view.dom.querySelectorAll('.mdb-slash-item');
    expect(items()[0].getAttribute('data-selected')).toBe('true');

    expect(slashMenuSelectNext(view)).toBe(true);
    expect(items()[1].getAttribute('data-selected')).toBe('true');
    expect(items()[0].getAttribute('data-selected')).toBeNull();

    expect(slashMenuSelectPrev(view)).toBe(true);
    expect(items()[0].getAttribute('data-selected')).toBe('true');
    expect(items()[1].getAttribute('data-selected')).toBeNull();
  });

  it('command functions return false when the menu is closed', () => {
    expect(slashMenuApply(view)).toBe(false);
    expect(slashMenuSelectNext(view)).toBe(false);
    expect(slashMenuSelectPrev(view)).toBe(false);
    expect(slashMenuClose(view)).toBe(false);
  });

  it('slash does NOT trigger on a non-empty line', () => {
    // Type some text first.
    view.dispatch({
      changes: { from: 0, insert: 'hello' },
      selection: { anchor: 5 },
    });
    const result = insertSlashChar(view);
    expect(result).toBe(false);
    expect(view.state.doc.toString()).toBe('hello');
    expect(view.dom.querySelector('.mdb-slash-menu')).toBeNull();
  });

  it('slash triggers at the start of an empty line', () => {
    // Empty document — cursor at position 0 (start of empty line).
    const result = insertSlashChar(view);
    expect(result).toBe(true);
    expect(view.state.doc.toString()).toBe('/');
    expect(view.dom.querySelector('.mdb-slash-menu')).not.toBeNull();
  });

  it('slash triggers on a line with only whitespace before cursor', () => {
    view.dispatch({
      changes: { from: 0, insert: '   ' },
      selection: { anchor: 3 },
    });
    const result = insertSlashChar(view);
    expect(result).toBe(true);
    expect(view.dom.querySelector('.mdb-slash-menu')).not.toBeNull();
  });

  it('slash triggers at word start (after space mid-line)', () => {
    view.dispatch({
      changes: { from: 0, insert: 'hello ' },
      selection: { anchor: 6 },
    });
    const result = insertSlashChar(view);
    expect(result).toBe(true);
    expect(view.dom.querySelector('.mdb-slash-menu')).not.toBeNull();
  });

  it('slash does NOT trigger mid-word (immediately after non-whitespace)', () => {
    view.dispatch({
      changes: { from: 0, insert: 'hello' },
      selection: { anchor: 5 },
    });
    const result = insertSlashChar(view);
    expect(result).toBe(false);
    expect(view.dom.querySelector('.mdb-slash-menu')).toBeNull();
  });

  it('slash does NOT trigger after a word followed by more text', () => {
    view.dispatch({
      changes: { from: 0, insert: 'foo bar' },
      selection: { anchor: 5 },
    });
    const result = insertSlashChar(view);
    expect(result).toBe(false);
    expect(view.dom.querySelector('.mdb-slash-menu')).toBeNull();
  });
});

describe('slash registry isolation', () => {
  it('does not register its own command ids into the global registry', () => {
    // The slash menu renders from defaultCommands directly; polluting the
    // shared registry would duplicate palette rows and (for insert-html /
    // insert-css) shadow the canonical cursor-insert commands.
    const slashOnlyIds = ['heading', 'callout', 'image-ref', 'code-block', 'table', 'quote'];
    for (const id of slashOnlyIds) {
      expect(commandRegistry.has(id), `slash-only id ${id} must not be registered`).toBe(false);
    }
  });

  it('leaves insert-html / insert-css to the canonical commands.ts registrations', () => {
    expect(commandRegistry.has('insert-html')).toBe(true);
    expect(commandRegistry.has('insert-css')).toBe(true);
  });
});
