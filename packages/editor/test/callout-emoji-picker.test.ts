/**
 * #361 (change editor-fidelity-2 / 2.6) — callout header emoji picker.
 *
 * Drives the real jsdom DOM: click the header emoji -> picker opens -> pick an
 * emoji -> `data-callout-emoji` and the visible glyph update. Also covers
 * 恢复默认 and the optional search filter.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EditorView } from '@codemirror/view';
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

const nextFrame = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 30));

describe('#361 callout emoji picker', () => {
  let parent: HTMLElement;
  let view: EditorView;

  beforeEach(() => {
    installPolyfills();
    parent = document.createElement('div');
    document.body.appendChild(parent);
    view = createMarkdownEditor(parent, {
      value: '> [!NOTE]\n> callout body',
      extensions: [editorDecorations()],
    }).view;
    view.dispatch({ selection: { anchor: view.state.doc.length } });
    view.requestMeasure();
  });

  afterEach(() => {
    view?.destroy();
    parent?.remove();
  });

  function card(): HTMLElement {
    const el = view.dom.querySelector<HTMLElement>('.cm-callout');
    if (!el) throw new Error('callout card not rendered');
    return el;
  }

  function icon(): HTMLElement {
    const el = view.dom.querySelector<HTMLElement>('.cm-callout-icon');
    if (!el) throw new Error('callout icon not rendered');
    return el;
  }

  it('renders data-callout-emoji on the card with the type default', () => {
    expect(card().getAttribute('data-callout-emoji')).toBe('📝');
    expect(icon().textContent).toBe('📝');
  });

  it('opens the picker on header-emoji mousedown and closes after a pick', async () => {
    icon().dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    await nextFrame();

    const picker = view.dom.querySelector<HTMLElement>('[data-testid="cm-callout-emoji-picker"]');
    expect(picker).not.toBeNull();

    const option = picker?.querySelector<HTMLButtonElement>('[data-emoji="🎉"]');
    expect(option).not.toBeNull();
    option?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(card().getAttribute('data-callout-emoji')).toBe('🎉');
    expect(icon().textContent).toBe('🎉');
    expect(view.dom.querySelector('[data-testid="cm-callout-emoji-picker"]')).toBeNull();
  });

  it('restores the type default through 恢复默认', async () => {
    icon().dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    await nextFrame();
    view.dom
      .querySelector<HTMLButtonElement>('[data-testid="cm-callout-emoji-option"][data-emoji="🔥"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(icon().textContent).toBe('🔥');

    icon().dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    await nextFrame();
    view.dom
      .querySelector<HTMLButtonElement>('[data-testid="cm-callout-emoji-reset"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(card().getAttribute('data-callout-emoji')).toBe('📝');
    expect(icon().textContent).toBe('📝');
  });

  it('closes the picker on an outside press', async () => {
    icon().dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    await nextFrame();
    expect(view.dom.querySelector('[data-testid="cm-callout-emoji-picker"]')).not.toBeNull();

    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    expect(view.dom.querySelector('[data-testid="cm-callout-emoji-picker"]')).toBeNull();
  });

  it('filters the grid from the search box', async () => {
    icon().dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    await nextFrame();

    const search = view.dom.querySelector<HTMLInputElement>('[data-testid="cm-callout-emoji-search"]');
    if (!search) throw new Error('search box missing');
    search.value = 'rocket';
    search.dispatchEvent(new Event('input', { bubbles: true }));

    const visible = Array.from(
      view.dom.querySelectorAll<HTMLButtonElement>('[data-testid="cm-callout-emoji-option"]'),
    ).filter((btn) => btn.style.display !== 'none');
    expect(visible.map((btn) => btn.getAttribute('data-emoji'))).toEqual(['🚀']);
  });

  it('keeps the chosen emoji across a widget rebuild (doc edit re-applies it)', async () => {
    icon().dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    await nextFrame();
    view.dom
      .querySelector<HTMLButtonElement>('[data-testid="cm-callout-emoji-option"][data-emoji="🎯"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(icon().textContent).toBe('🎯');

    // A document edit rebuilds the decoration from source (no emoji in markdown);
    // the session override must survive it.
    view.dispatch({ changes: { from: view.state.doc.length, insert: ' more' } });
    view.requestMeasure();
    expect(card().getAttribute('data-callout-emoji')).toBe('🎯');
    expect(icon().textContent).toBe('🎯');
  });
});
