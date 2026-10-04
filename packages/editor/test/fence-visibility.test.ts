/**
 * D3 (change editor-fidelity / task 9.1) — fence marker visibility.
 *
 * When a fenced code block is NOT the active block (cursor outside), its
 * ``` / ~~~ markers must not survive in the rendered DOM. When the cursor is
 * inside the block, the raw source (fences included) must be visible and
 * editable. Mermaid blocks are owned by decorations/mermaid.ts and must keep
 * their whole-block replacement.
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

describe('fenced code fence visibility (D3)', () => {
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

  function renderedText(): string {
    return view.dom.querySelector('.cm-content')?.textContent ?? '';
  }

  it('hides both fence lines when the block is inactive (cursor outside)', () => {
    const doc = '```ts\nconst x = 1;\n```\n\nparagraph';
    view = createMarkdownEditor(parent, {
      value: doc,
      extensions: [editorDecorations()],
    }).view;

    // Cursor at the far end lands in the paragraph, outside the fence.
    view.dispatch({ selection: { anchor: view.state.doc.length } });
    view.requestMeasure();

    const text = renderedText();
    expect(text).not.toContain('```');
    expect(text).not.toContain('```ts');
    // The code body must survive the marker replacement.
    expect(text).toContain('const x = 1;');
    // The language label widget is still rendered.
    expect(view.dom.querySelector('.cm-fenced-code-language')?.textContent).toBe('ts');
    // Source value is untouched — decorations are view-only.
    expect(view.state.doc.toString()).toBe(doc);
  });

  it('reveals the raw fences when the cursor enters the block (active)', () => {
    const doc = '```ts\nconst x = 1;\n```\n\nparagraph';
    view = createMarkdownEditor(parent, {
      value: doc,
      extensions: [editorDecorations()],
    }).view;

    // Position 10 sits inside the code body.
    view.dispatch({ selection: { anchor: 10 } });
    view.requestMeasure();

    const text = renderedText();
    expect(text).toContain('```ts');
    expect(text).toContain('const x = 1;');
    expect(text).toContain('```');
  });

  it('hides tilde fences when inactive', () => {
    const doc = '~~~python\nprint(1)\n~~~\n\nparagraph';
    view = createMarkdownEditor(parent, {
      value: doc,
      extensions: [editorDecorations()],
    }).view;

    view.dispatch({ selection: { anchor: view.state.doc.length } });
    view.requestMeasure();

    const text = renderedText();
    expect(text).not.toContain('~~~');
    expect(text).toContain('print(1)');
  });

  it('hides fences without a language while emitting no label', () => {
    const doc = '```\nplain text\n```\n\nparagraph';
    view = createMarkdownEditor(parent, {
      value: doc,
      extensions: [editorDecorations()],
    }).view;

    view.dispatch({ selection: { anchor: view.state.doc.length } });
    view.requestMeasure();

    expect(renderedText()).not.toContain('```');
    expect(renderedText()).toContain('plain text');
    expect(view.dom.querySelector('.cm-fenced-code-language')).toBeNull();
  });

  it('keeps mermaid blocks owned by the mermaid decorator (no regression)', () => {
    const doc = '```mermaid\ngraph TD;\n```';
    view = createMarkdownEditor(parent, {
      value: doc,
      extensions: [editorDecorations({ hydrateMermaid: async () => {} })],
    }).view;

    view.dispatch({ selection: { anchor: view.state.doc.length } });
    view.requestMeasure();

    // The mermaid widget replaces the whole block; no fence text survives and
    // the code decorator neither labels nor line-classes the mermaid fence.
    expect(view.dom.querySelector('.cm-mermaid-block')).not.toBeNull();
    expect(renderedText()).not.toContain('```mermaid');
    expect(view.dom.querySelector('.cm-fenced-code-language')).toBeNull();
    expect(view.dom.querySelector('.cm-fenced-code')).toBeNull();
  });

  it('leaves an unclosed fence visible (no closing marker to pair)', () => {
    const doc = '~~~ts\nconst x = 1;';
    view = createMarkdownEditor(parent, {
      value: doc,
      extensions: [editorDecorations()],
    }).view;

    view.dispatch({ selection: { anchor: view.state.doc.length } });
    view.requestMeasure();

    expect(renderedText()).toContain('~~~ts');
  });

  it('still hides inline code backticks (regression)', () => {
    view = createMarkdownEditor(parent, {
      value: 'Use `code` here',
      extensions: [editorDecorations()],
    }).view;

    view.dispatch({ selection: { anchor: view.state.doc.length } });
    view.requestMeasure();

    expect(renderedText()).not.toContain('`code`');
    expect(view.dom.querySelector('.cm-inline-code')?.textContent).toBe('code');
  });
});
