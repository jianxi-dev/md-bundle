/**
 * CALLOUT TITLE EDIT TEST — issue #395.
 *
 * Real EditorView path: a pointer press on the callout title opens an inline
 * input, and committing writes back through the callout staging/flush so the
 * source line becomes `> [!TYPE] <new title>`. #395 found this write path
 * missing — the title was rendered as inert textContent.
 *
 * jsdom lacks requestAnimationFrame/ResizeObserver; CodeMirror 6 uses both.
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EditorView } from '@codemirror/view';
import { createMarkdownEditor } from '../src/editor';
import { editorDecorations } from '../src/decorations';

// jsdom polyfills for CM6
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

/** Let the widget's deferred `requestAnimationFrame(open)` run. */
const frame = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 40));

const evidence = {
  titleEditorOpens: false,
  titleRoundTrip: false,
  emptyTitleFallsBack: false,
  escapeCancels: false,
  tests: 0, // keep in sync with it() count below
};

describe('callout title inline editing (#395)', () => {
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
    // Cursor outside the callout so the card widget is rendered.
    view.dispatch({ selection: { anchor: view.state.doc.length } });
    view.requestMeasure();
  }

  function titleEl(): HTMLElement {
    const el = view.dom.querySelector<HTMLElement>('.cm-callout-title');
    if (!el) throw new Error('callout title not rendered');
    return el;
  }

  /** Real path: press the title, then wait for the widget's next-frame open. */
  async function pressTitle(): Promise<void> {
    titleEl().dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    await frame();
  }

  function titleInput(): HTMLInputElement | null {
    return view.dom.querySelector<HTMLInputElement>('.cm-callout-title-editor');
  }

  it('opens an inline title editor when the title is pressed', async () => {
    mount('> [!NOTE] 旧标题\n> 内容');
    await pressTitle();

    const input = titleInput();
    expect(input).not.toBeNull();
    expect(input?.value).toBe('旧标题');
    evidence.titleEditorOpens = true;
    evidence.tests++;
  });

  it('commits an edited title back into the source line', async () => {
    mount('> [!NOTE] 旧标题\n> 内容');
    await pressTitle();

    const input = titleInput();
    expect(input).not.toBeNull();
    if (!input) return;
    input.value = '自定义标题';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );

    expect(view.state.doc.toString()).toBe('> [!NOTE] 自定义标题\n> 内容');
    evidence.titleRoundTrip = true;
    evidence.tests++;
  });

  it('clearing the title falls back to the type default (no title in source)', async () => {
    mount('> [!TIP] 自定义\n> 内容');
    await pressTitle();

    const input = titleInput();
    expect(input).not.toBeNull();
    if (!input) return;
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );

    expect(view.state.doc.toString()).toBe('> [!TIP]\n> 内容');
    evidence.emptyTitleFallsBack = true;
    evidence.tests++;
  });

  it('Escape cancels the title edit without touching the source', async () => {
    mount('> [!NOTE] 旧标题\n> 内容');
    await pressTitle();

    const input = titleInput();
    expect(input).not.toBeNull();
    if (!input) return;
    input.value = '不该保存';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );

    expect(view.state.doc.toString()).toBe('> [!NOTE] 旧标题\n> 内容');
    evidence.escapeCancels = true;
    evidence.tests++;
  });
});

afterAll(() => {
  const dir = path.resolve(import.meta.dirname ?? process.cwd(), '../test-results');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'callout-title-edit.json'), JSON.stringify(evidence, null, 2));
});
