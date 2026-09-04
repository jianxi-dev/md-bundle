import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMarkdownEditor } from '../src/editor';
import {
  insertSlashChar,
  slashKeymap,
  slashMenuApply,
  slashMenuClose,
  slashMenuSelectNext,
  slashMenuSelectPrev,
} from '../src/slash';

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
    expect(view.dom.querySelectorAll('.mdb-slash-item').length).toBe(6);
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
});
