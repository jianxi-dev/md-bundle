import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { EditorView } from '@codemirror/view';
import { MarkdownEditor } from '../src/MarkdownEditor';
import type { MarkdownEditorHandle } from '../src/editor';

// jsdom lacks requestAnimationFrame/ResizeObserver; CodeMirror 6 uses both.
// (Same pattern as test/editor.test.ts.)
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

describe('MarkdownEditor (React wrapper)', () => {
  beforeEach(() => {
    installPolyfills();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders a controlled editor and forwards a change round-trip', () => {
    const onChange = vi.fn();
    let handle: MarkdownEditorHandle | undefined;

    render(
      <MarkdownEditor
        value="# hi"
        onChange={onChange}
        onMount={(h) => {
          handle = h;
        }}
      />,
    );

    expect(handle).toBeDefined();
    expect(handle!.getValue()).toBe('# hi');

    act(() => {
      handle!.setValue('changed');
    });
    expect(onChange).toHaveBeenCalledWith('changed');
  });

  it('syncs an external value prop into the editor doc', () => {
    let handle: MarkdownEditorHandle | undefined;

    const { rerender } = render(
      <MarkdownEditor
        value="# hi"
        onMount={(h) => {
          handle = h;
        }}
      />,
    );

    rerender(
      <MarkdownEditor
        value="external"
        onMount={(h) => {
          handle = h;
        }}
      />,
    );

    expect(handle!.getValue()).toBe('external');
  });

  it('skips value sync when the editor doc already matches (cursor-preserving)', () => {
    let handle: MarkdownEditorHandle | undefined;
    const onChange = vi.fn();

    const { rerender } = render(
      <MarkdownEditor
        value="# hi"
        onChange={onChange}
        onMount={(h) => {
          handle = h;
        }}
      />,
    );

    // Same value re-rendered — must NOT dispatch, so onChange stays silent and
    // the editor doc is untouched.
    rerender(
      <MarkdownEditor
        value="# hi"
        onChange={onChange}
        onMount={(h) => {
          handle = h;
        }}
      />,
    );

    expect(handle!.getValue()).toBe('# hi');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reconfigures the theme prop without throwing and keeps the editor alive', () => {
    let handle: MarkdownEditorHandle | undefined;

    const { rerender } = render(
      <MarkdownEditor
        theme="dark"
        value="abc"
        onMount={(h) => {
          handle = h;
        }}
      />,
    );

    expect(() => {
      rerender(
        <MarkdownEditor
          theme="light"
          value="abc"
          onMount={(h) => {
            handle = h;
          }}
        />,
      );
    }).not.toThrow();

    expect(handle).toBeDefined();
    expect(handle!.getValue()).toBe('abc');
  });

  it('forwards extensions to the underlying editor', () => {
    let handle: MarkdownEditorHandle | undefined;

    render(
      <MarkdownEditor
        value="x"
        extensions={[EditorView.contentAttributes.of({ spellcheck: 'false' })]}
        onMount={(h) => {
          handle = h;
        }}
      />,
    );

    expect(handle).toBeDefined();
    const content = document.querySelector('.cm-content');
    expect(content?.getAttribute('spellcheck')).toBe('false');
  });

  it('destroys the editor on unmount without throwing', () => {
    const { unmount } = render(<MarkdownEditor value="x" />);
    expect(() => unmount()).not.toThrow();
  });
});
