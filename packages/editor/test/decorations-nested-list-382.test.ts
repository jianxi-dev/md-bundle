/**
 * #382 — lists inside blockquote / callout containers must decorate in EDIT mode.
 *
 * The list marker regexes are line-start anchored, but a quoted list keeps its
 * `> ` prefix in the source; a callout body is a widget with no editable CM6
 * content. These tests pin that both containers still expose the editor's list
 * affordances (bullet line class / ordered digit marker / task checkbox).
 *
 * jsdom lacks requestAnimationFrame/ResizeObserver; CodeMirror 6 uses both.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EditorView } from '@codemirror/view';
import { createMarkdownEditor } from '../src/editor';
import { editorDecorations } from '../src/decorations';

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

describe('#382 lists inside blockquote / callout (edit mode)', () => {
  let parent: HTMLElement;
  let view: EditorView;

  beforeEach(() => {
    installPolyfills();
    parent = document.createElement('div');
    document.body.appendChild(parent);
  });

  afterEach(() => {
    view?.destroy();
    parent?.remove();
  });

  function mount(value: string): void {
    view = createMarkdownEditor(parent, {
      value,
      extensions: [editorDecorations()],
    }).view;
    // Cursor at end → the containers render in their inactive (fully decorated)
    // state, which is where the bug showed the marker literally.
    view.dispatch({ selection: { anchor: view.state.doc.length } });
    view.requestMeasure();
  }

  describe('blockquote-embedded lists', () => {
    it('decorates a bullet list after the quote marker', () => {
      mount('> 引用\n> - 项一\n> - 项二');

      expect(view.dom.querySelectorAll('.cm-list').length).toBe(2);
      expect(view.dom.querySelectorAll('.cm-quote.cm-list').length).toBe(2);
      // The "- " marker is hidden, not printed literally.
      expect(view.dom.querySelector('.cm-content')?.textContent).not.toContain('- ');
      expect(view.dom.querySelector('.cm-content')?.textContent).toContain('项一');
    });

    it('decorates an ordered list after the quote marker with visible digits', () => {
      mount('> 引用\n> 1. 第一\n> 2. 第二');

      const orderedLines = view.dom.querySelectorAll('.cm-list-ordered');
      expect(orderedLines.length).toBe(2);
      const markers = Array.from(view.dom.querySelectorAll('.cm-list-marker')).map(
        (el) => el.textContent,
      );
      expect(markers).toEqual(['1. ', '2. ']);
    });

    it('decorates a task list after the quote marker with a checkbox', () => {
      mount('> 引用\n> - [x] 完成\n> - [ ] 待办');

      expect(view.dom.querySelectorAll('.cm-task-done').length).toBe(1);
      expect(view.dom.querySelectorAll('.cm-task-pending').length).toBe(1);
      expect(view.dom.querySelectorAll('.cm-task-checkbox').length).toBe(2);
    });
  });

  describe('top-level list regression', () => {
    it('still decorates a plain top-level bullet list', () => {
      mount('- alpha\n- beta');
      expect(view.dom.querySelectorAll('.cm-list').length).toBe(2);
    });
  });

  describe('callout-embedded lists', () => {
    it('renders a bullet list body with list affordances', () => {
      mount('> [!NOTE] 标题\n> - 项一\n> - 项二');

      const content = view.dom.querySelector('.cm-callout-content');
      expect(content).not.toBeNull();
      expect(content?.querySelectorAll('.cm-list').length).toBe(2);
      expect(content?.textContent).toContain('项一');
      expect(content?.textContent).not.toContain('- ');
    });

    it('renders an ordered list body with digit markers', () => {
      mount('> [!NOTE] 标题\n> 1. 第一\n> 2. 第二');

      const markers = Array.from(
        view.dom.querySelectorAll('.cm-callout-content .cm-list-marker'),
      ).map((el) => el.textContent);
      expect(markers).toEqual(['1. ', '2. ']);
    });

    it('renders a task list body with a checkbox', () => {
      mount('> [!NOTE] 标题\n> - [x] 完成');

      const content = view.dom.querySelector('.cm-callout-content');
      expect(content?.querySelectorAll('.cm-task-checkbox').length).toBe(1);
      expect(content?.querySelector('.cm-task-done')).not.toBeNull();
    });

    it('keeps multi-line plain callout text intact', () => {
      mount('> [!NOTE] 标题\n> 第一行\n> 第二行');

      const content = view.dom.querySelector('.cm-callout-content');
      expect(content?.textContent).toContain('第一行');
      expect(content?.textContent).toContain('第二行');
    });
  });

  describe('document value invariant', () => {
    it('never rewrites the source for quoted/callout lists', () => {
      const original = '> 引用\n> - 项一\n\n> [!NOTE] 标题\n> - 项二';
      mount(original);
      expect(view.state.doc.toString()).toBe(original);
    });
  });
});
