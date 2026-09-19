/**
 * chapterReorgExtension tests — mousedown guard (issue #188).
 *
 * Regression: `dragHandlers.mousedown` used to react to ANY left mousedown
 * inside a heading section — which is the whole document once it has at least
 * one heading — dispatching a drag effect and calling `preventDefault()`.
 * That stopped CM6 from ever focusing the editor, leaving it uneditable and
 * killing every editor-scoped keymap (`/`, Cmd+K).
 *
 * The invariant locked here: only a mousedown whose target sits inside a
 * `.mdb-block-handle` (the block-handle DOM is added by issue #189; until then
 * the drag stays intentionally dormant) may start a drag. A plain content
 * mousedown must fall through without dispatching and without preventDefault.
 *
 * jsdom has no layout, so `EditorView.posAtCoords` is stubbed to return a real
 * document position. To make `defaultPrevented` observable on a content
 * mousedown we must also keep CM6's own built-in pointer handler from claiming
 * the event: a boundary click (detail 1) inside an existing selection is the
 * built-in's no-op branch — it neither dispatches nor prevents default.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { chapterReorgExtension } from '../src/chapter-reorg-extension';

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

const DOC = '# H1 Title\n\nParagraph one here.';
// Document position inside the H1 section (the heading line ends at offset 10).
const SECTION_POS = 12;

/** Dispatch a real bubbling mouse event and return it for assertions. */
function dispatchMouse(target: EventTarget, type: 'mousedown' | 'mousemove' | 'mouseup'): MouseEvent {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    detail: 1,
    clientX: 10,
    clientY: 10,
  });
  target.dispatchEvent(event);
  return event;
}

/** Pick out dispatches carrying our drag StateEffect (spec.effects present). */
function dragDispatchCount(spy: { mock: { calls: unknown[][] } }): number {
  const calls = spy.mock.calls as { effects?: unknown }[][];
  return calls.flat().filter((spec) => spec.effects !== undefined).length;
}

describe('chapterReorgExtension mousedown guard (issue #188)', () => {
  let parent: HTMLElement;
  let view: EditorView;

  beforeEach(() => {
    installPolyfills();
    parent = document.createElement('div');
    document.body.appendChild(parent);
    view = new EditorView({
      state: EditorState.create({
        doc: DOC,
        extensions: [markdown(), chapterReorgExtension()],
      }),
      parent,
    });
  });

  afterEach(() => {
    view.destroy();
    parent.remove();
  });

  it('plain content mousedown does not preventDefault and starts no drag', () => {
    // Non-empty selection + detail 1 + layout stubs: steers CM6's built-in
    // pointer handler into its no-op branch so this test observes OUR handler.
    view.dispatch({ selection: EditorSelection.range(0, 5) });
    vi.spyOn(view, 'posAtCoords').mockReturnValue(SECTION_POS);
    const posAssoc: { pos: number; assoc: -1 | 1 } = { pos: 2, assoc: 1 };
    vi.spyOn(view, 'posAndSideAtCoords').mockReturnValue(posAssoc);
    const dispatchSpy = vi.spyOn(view, 'dispatch');

    const event = dispatchMouse(view.contentDOM, 'mousedown');

    // The editor must keep its normal focus/selection handling.
    expect(event.defaultPrevented).toBe(false);
    expect(dragDispatchCount(dispatchSpy)).toBe(0);
    expect(view.state.doc.toString()).toBe(DOC);
  });

  it('mousemove without an active drag does not preventDefault', () => {
    const event = dispatchMouse(view.contentDOM, 'mousemove');
    expect(event.defaultPrevented).toBe(false);
  });

  it('mouseup without an active drag does not preventDefault', () => {
    const event = dispatchMouse(view.contentDOM, 'mouseup');
    expect(event.defaultPrevented).toBe(false);
  });

  it('mousedown inside a .mdb-block-handle starts the drag', () => {
    vi.spyOn(view, 'posAtCoords').mockReturnValue(SECTION_POS);
    const dispatchSpy = vi.spyOn(view, 'dispatch');
    const handle = document.createElement('div');
    handle.className = 'mdb-block-handle';
    view.contentDOM.appendChild(handle);

    const event = dispatchMouse(handle, 'mousedown');
    handle.remove();

    expect(event.defaultPrevented).toBe(true);
    expect(dragDispatchCount(dispatchSpy)).toBe(1);
    expect(view.state.doc.toString()).toBe(DOC);
  });

  it('mouseup clears the drag started from the handle', () => {
    vi.spyOn(view, 'posAtCoords').mockReturnValue(SECTION_POS);
    const handle = document.createElement('div');
    handle.className = 'mdb-block-handle';
    view.contentDOM.appendChild(handle);
    dispatchMouse(handle, 'mousedown');
    handle.remove();

    // While the drag is active the mouseup is consumed (and clears it)...
    expect(dispatchMouse(view.contentDOM, 'mouseup').defaultPrevented).toBe(true);
    // ...after which the next mouseup is a plain content event again.
    expect(dispatchMouse(view.contentDOM, 'mouseup').defaultPrevented).toBe(false);
  });
});
