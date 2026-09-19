/**
 * Fenced code block decorations — language label + nested-language highlighting.
 *
 * Verifies defect #179 fix: fenced code blocks now render a language label
 * and get syntax highlighting via CM6's native nested-language support.
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

describe('fenced code block decorations (#179)', () => {
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

  it('renders a language label for a fenced block with a language', () => {
    const doc = '```ts\nconst x = 1;\n```';
    view = createMarkdownEditor(parent, {
      value: doc,
      extensions: [editorDecorations()],
    }).view;

    // Move cursor to end so decorations render (no selection-reveal suppression)
    view.dispatch({ selection: { anchor: view.state.doc.length } });
    view.requestMeasure();

    const label = view.dom.querySelector('.cm-fenced-code-language');
    expect(label).not.toBeNull();
    expect(label?.textContent).toBe('ts');
  });

  it('renders no label for a fenced block without a language', () => {
    const doc = '```\nplain text\n```';
    view = createMarkdownEditor(parent, {
      value: doc,
      extensions: [editorDecorations()],
    }).view;

    view.dispatch({ selection: { anchor: view.state.doc.length } });
    view.requestMeasure();

    const label = view.dom.querySelector('.cm-fenced-code-language');
    expect(label).toBeNull();
    // Document value must be unchanged.
    expect(view.state.doc.toString()).toBe(doc);
  });

  it('does not throw when editing inside a fenced block', () => {
    const doc = '```python\nprint("hello")\n```';
    view = createMarkdownEditor(parent, {
      value: doc,
      extensions: [editorDecorations()],
    }).view;

    // Edit inside the code block (after the opening fence line).
    expect(() => {
      view.dispatch({
        changes: { from: 10, insert: '#' },
      });
      view.requestMeasure();
    }).not.toThrow();

    // Label still present after edit.
    const label = view.dom.querySelector('.cm-fenced-code-language');
    expect(label).not.toBeNull();
    expect(label?.textContent).toBe('python');
  });

  it('still renders inline code decorations (regression)', () => {
    const doc = 'Use `code` in a sentence.';
    view = createMarkdownEditor(parent, {
      value: doc,
      extensions: [editorDecorations()],
    }).view;

    view.dispatch({ selection: { anchor: view.state.doc.length } });
    view.requestMeasure();

    const inlineCode = view.dom.querySelector('.cm-inline-code');
    expect(inlineCode).not.toBeNull();
    expect(inlineCode?.textContent).toBe('code');
  });

  it('renders labels for multiple fenced blocks with different languages', () => {
    const doc = '```ts\nconst a = 1;\n```\n\n```python\nprint(a)\n```';
    view = createMarkdownEditor(parent, {
      value: doc,
      extensions: [editorDecorations()],
    }).view;

    view.dispatch({ selection: { anchor: view.state.doc.length } });
    view.requestMeasure();

    const labels = view.dom.querySelectorAll('.cm-fenced-code-language');
    expect(labels.length).toBe(2);
    expect(labels[0]?.textContent).toBe('ts');
    expect(labels[1]?.textContent).toBe('python');
  });
});
