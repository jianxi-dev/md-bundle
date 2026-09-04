import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMarkdownEditor } from '../src/editor';

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

describe('createMarkdownEditor', () => {
  let parent: HTMLElement;

  beforeEach(() => {
    installPolyfills();
    parent = document.createElement('div');
    document.body.appendChild(parent);
  });

  afterEach(() => {
    parent.remove();
  });

  it('returns a handle with a working view', () => {
    const handle = createMarkdownEditor(parent, { value: '# hello' });
    expect(handle.view).toBeDefined();
    expect(handle.getValue()).toBe('# hello');
    handle.destroy();
  });

  it('setValue -> getValue round-trips', () => {
    const handle = createMarkdownEditor(parent, { value: 'a' });
    handle.setValue('**bold** text');
    expect(handle.getValue()).toBe('**bold** text');
    handle.destroy();
  });

  it('fires onChange after setValue and after a direct dispatch', () => {
    const changes: string[] = [];
    const handle = createMarkdownEditor(parent, {
      value: 'init',
      onChange: (v) => changes.push(v),
    });
    handle.setValue('second');
    handle.view.dispatch({
      changes: {
        from: 0,
        to: handle.view.state.doc.length,
        insert: 'third',
      },
    });
    expect(changes).toEqual(['second', 'third']);
    handle.destroy();
  });

  it('renders empty without throwing when value is undefined', () => {
    const handle = createMarkdownEditor(parent, { value: undefined });
    expect(handle.getValue()).toBe('');
    handle.destroy();
  });

  it('destroy() does not throw', () => {
    const handle = createMarkdownEditor(parent, { value: 'x' });
    expect(() => handle.destroy()).not.toThrow();
  });

  it('setTheme reconfigures without error', () => {
    const handle = createMarkdownEditor(parent, { value: 'x', theme: 'dark' });
    expect(() => handle.setTheme('light')).not.toThrow();
    expect(() => handle.setTheme('dark')).not.toThrow();
    handle.destroy();
  });
});
