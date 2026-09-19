/**
 * blockHandle tests — issue #189 (gutter block handle).
 *
 * Two layers:
 * - Pure helpers (`findBlockAt`, `computeBlockMove`, `computeBlockConvert`,
 *   `computeBlockDuplicate`, `computeBlockDelete`) — no DOM, deterministic.
 * - Lifecycle through real DOM events on `view.dom` (hover, menu open/close,
 *   Escape, scroll, destroy). jsdom has no layout, so `posAtCoords` and
 *   `coordsAtPos` are stubbed; the handle's existence/visibility is asserted,
 *   never pixel positions.
 *
 * The handle lives in `view.dom` (outside `contentDOM`), so events dispatched
 * on `view.dom` never reach CM6's built-in contentDOM handlers — no need for
 * the isolation trick used by chapter-reorg-extension.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { markdown } from '@codemirror/lang-markdown'
import { createMarkdownEditor } from '../src/editor'
import { chapterReorgExtension } from '../src/chapter-reorg-extension'
import {
  blockHandle,
  findBlockAt,
  computeBlockMove,
  computeBlockConvert,
  computeBlockDuplicate,
  computeBlockDelete,
} from '../src/block-handle'

// jsdom lacks requestAnimationFrame/ResizeObserver; CodeMirror 6 uses both.
function installPolyfills(): void {
  if (typeof globalThis.requestAnimationFrame !== 'function') {
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 16)) as unknown as typeof requestAnimationFrame
    globalThis.cancelAnimationFrame = ((id: number) =>
      clearTimeout(id)) as unknown as typeof cancelAnimationFrame
  }
  if (typeof globalThis.ResizeObserver !== 'function') {
    globalThis.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver
  }
}

const DOC = '# H1\n\nParagraph one here.'
// Offsets: heading block [0, 4), paragraph block [6, 25).
const PARAGRAPH_POS = 8
const HEADING_POS = 1

const RECT = { left: 10, right: 30, top: 20, bottom: 40 }

function mouse(type: string, init: MouseEventInit = {}): MouseEvent {
  return new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...init })
}

// --- Pure helpers ------------------------------------------------------------

describe('block-handle pure helpers', () => {
  function makeState(doc: string): EditorState {
    return EditorState.create({ doc, extensions: [markdown()] })
  }

  it('findBlockAt returns the block containing a position', () => {
    const state = makeState(DOC)
    const block = findBlockAt(state, PARAGRAPH_POS)
    expect(block?.type).toBe('paragraph')
    expect(block?.from).toBe(6)
    expect(block?.to).toBe(25)
  })

  it('findBlockAt returns null for an out-of-range position', () => {
    expect(findBlockAt(makeState(DOC), 999)).toBeNull()
  })

  it('computeBlockMove moves a block down to the end', () => {
    expect(computeBlockMove('A\n\nB\n\nC', 0, 1, 6)).toBe('B\n\nC\n\nA')
  })

  it('computeBlockMove moves a block up to the start', () => {
    expect(computeBlockMove('A\n\nB\n\nC', 6, 7, 1)).toBe('C\n\nA\n\nB')
  })

  it('computeBlockMove keeps order when re-dropped before its current neighbour', () => {
    expect(computeBlockMove('A\n\nB\n\nC', 3, 4, 5)).toBe('A\n\nB\n\nC')
  })

  it('computeBlockMove is a no-op when dropped inside its own block', () => {
    expect(computeBlockMove('A\n\nB', 0, 1, 1)).toBe('A\n\nB')
  })

  it('computeBlockConvert turns a paragraph into an h2', () => {
    expect(computeBlockConvert('Hello', 0, 5, 'h2')).toBe('## Hello')
  })

  it('computeBlockConvert turns an h1 into a paragraph (strips markers)', () => {
    expect(computeBlockConvert('# Title', 0, 7, 'paragraph')).toBe('Title')
  })

  it('computeBlockConvert promotes an h1 to an h3', () => {
    expect(computeBlockConvert('# Title', 0, 7, 'h3')).toBe('### Title')
  })

  it('computeBlockConvert converts only the first line of a multi-line block', () => {
    expect(computeBlockConvert('one\ntwo', 0, 7, 'h1')).toBe('# one\ntwo')
  })

  it('computeBlockDuplicate inserts a copy after the block', () => {
    expect(computeBlockDuplicate('A\n\nB', 3, 4)).toBe('A\n\nB\n\nB')
  })

  it('computeBlockDelete removes a middle block and its separator', () => {
    expect(computeBlockDelete('A\n\nB\n\nC', 3, 4)).toBe('A\n\nC')
  })

  it('computeBlockDelete removes the first block', () => {
    expect(computeBlockDelete('A\n\nB', 0, 1)).toBe('B')
  })

  it('computeBlockDelete removes the last block without trailing blanks', () => {
    expect(computeBlockDelete('A\n\nB', 3, 4)).toBe('A')
  })

  it('computeBlockDelete leaves blank lines outside the deleted block untouched', () => {
    // The fenced block's internal blank lines must survive the delete; only A
    // and its seam separator are removed (issue #189).
    expect(computeBlockDelete('```\n\n\ncode\n```\n\nA\n\nB', 16, 17)).toBe(
      '```\n\n\ncode\n```\n\nB',
    )
  })

  it('computeBlockDelete keeps the document trailing newline when deleting the last block', () => {
    // block offsets from block-model: "B" spans [3, 4); the document's final
    // newline is not part of the block and must be preserved.
    expect(computeBlockDelete('A\n\nB\n', 3, 4)).toBe('A\n')
  })
})

// --- Lifecycle through real DOM events ---------------------------------------

describe('blockHandle lifecycle', () => {
  let parent: HTMLElement
  let editor: ReturnType<typeof createMarkdownEditor>
  let view: EditorView

  beforeEach(() => {
    installPolyfills()
    parent = document.createElement('div')
    document.body.appendChild(parent)
    editor = createMarkdownEditor(parent, {
      value: DOC,
      extensions: [chapterReorgExtension(), blockHandle()],
    })
    view = editor.view
  })

  afterEach(() => {
    editor.destroy()
    parent.remove()
    vi.restoreAllMocks()
  })

  /** Stub layout and dispatch a hover over `pos` on the editor root. */
  function hover(pos: number): void {
    vi.spyOn(view, 'posAtCoords').mockReturnValue(pos)
    vi.spyOn(view, 'coordsAtPos').mockReturnValue(RECT)
    view.dom.dispatchEvent(mouse('mousemove', { clientX: 5, clientY: 25 }))
  }

  function handleEl(): HTMLElement {
    const el = view.dom.querySelector<HTMLElement>('.mdb-block-handle')
    if (!el) throw new Error('block handle not found')
    return el
  }

  function menuEl(): HTMLElement | null {
    return view.dom.querySelector<HTMLElement>('[data-testid="block-handle-menu"]')
  }

  /** hover -> mousedown/mouseup (no move) -> click opens the menu. */
  function openMenu(): void {
    const el = handleEl()
    el.dispatchEvent(mouse('mousedown', { clientX: 0, clientY: 0 }))
    el.dispatchEvent(mouse('mouseup'))
    el.dispatchEvent(mouse('click'))
  }

  function clickMenuItem(label: string): void {
    const item = Array.from(
      view.dom.querySelectorAll<HTMLButtonElement>('.mdb-block-handle-item'),
    ).find((el) => el.textContent === label)
    if (!item) throw new Error(`menu item not found: ${label}`)
    item.dispatchEvent(mouse('click'))
  }

  function changeDispatchCount(spy: { mock: { calls: unknown[][] } }): number {
    const calls = spy.mock.calls as { changes?: unknown }[][]
    return calls.flat().filter((spec) => spec.changes !== undefined).length
  }

  it('shows a gutter handle while hovering a top-level block', () => {
    hover(PARAGRAPH_POS)
    const el = handleEl()
    expect(el.getAttribute('data-testid')).toBe('block-handle')
    expect(el.textContent).toBe('⠿')
    expect(el.style.display).not.toBe('none')
  })

  it('degrades silently when the view has no layout', () => {
    vi.spyOn(view, 'posAtCoords').mockReturnValue(null)
    view.dom.dispatchEvent(mouse('mousemove'))
    expect(handleEl().style.display).toBe('none')
  })

  it('opens a menu with convert/copy/delete actions on handle click', () => {
    hover(PARAGRAPH_POS)
    openMenu()
    const menu = menuEl()
    expect(menu).not.toBeNull()
    expect(menu?.textContent).toContain('转换为')
    expect(menu?.textContent).toContain('一级标题')
    expect(menu?.textContent).toContain('二级标题')
    expect(menu?.textContent).toContain('三级标题')
    expect(menu?.textContent).toContain('正文')
    expect(menu?.textContent).toContain('复制块')
    expect(menu?.textContent).toContain('删除块')
    expect(menu?.style.display).toBe('block')
  })

  it('转换为 二级标题 dispatches exactly one undoable transaction', () => {
    hover(PARAGRAPH_POS)
    openMenu()
    const dispatchSpy = vi.spyOn(view, 'dispatch')
    clickMenuItem('二级标题')
    expect(view.state.doc.toString()).toBe('# H1\n\n## Paragraph one here.')
    expect(changeDispatchCount(dispatchSpy)).toBe(1)
  })

  it('转换为 正文 strips heading markers from a heading block', () => {
    hover(HEADING_POS)
    openMenu()
    clickMenuItem('正文')
    expect(view.state.doc.toString()).toBe('H1\n\nParagraph one here.')
  })

  it('复制块 duplicates the block in one transaction', () => {
    hover(PARAGRAPH_POS)
    openMenu()
    const dispatchSpy = vi.spyOn(view, 'dispatch')
    clickMenuItem('复制块')
    expect(view.state.doc.toString()).toBe('# H1\n\nParagraph one here.\n\nParagraph one here.')
    expect(changeDispatchCount(dispatchSpy)).toBe(1)
  })

  it('删除块 removes the block in one transaction', () => {
    hover(PARAGRAPH_POS)
    openMenu()
    const dispatchSpy = vi.spyOn(view, 'dispatch')
    clickMenuItem('删除块')
    expect(view.state.doc.toString()).toBe('# H1')
    expect(changeDispatchCount(dispatchSpy)).toBe(1)
  })

  it('Escape dispatched on document.body closes the handle and the menu', () => {
    hover(PARAGRAPH_POS)
    openMenu()
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(handleEl().style.display).toBe('none')
    expect(menuEl()?.style.display).toBe('none')
  })

  it('binds the document Escape listener only while the widget is on screen', () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    const keydownDelta = (): number =>
      addSpy.mock.calls.filter(([type, , capture]) => type === 'keydown' && capture === true)
        .length -
      removeSpy.mock.calls.filter(([type, , capture]) => type === 'keydown' && capture === true)
        .length
    const initial = keydownDelta()
    hover(PARAGRAPH_POS)
    expect(keydownDelta()).toBe(initial + 1)
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(keydownDelta()).toBe(initial)
  })

  it('keeps the menu open when the pointer moves from the gutter onto it', () => {
    hover(PARAGRAPH_POS)
    openMenu()
    const menu = menuEl()
    expect(menu?.style.display).toBe('block')
    vi.spyOn(view, 'posAtCoords').mockReturnValue(null)
    menu?.dispatchEvent(mouse('mousemove', { clientX: 40, clientY: 25 }))
    expect(menu?.style.display).toBe('block')
  })

  it('删除块 works after the pointer crossed from the gutter onto the menu', () => {
    hover(PARAGRAPH_POS)
    openMenu()
    vi.spyOn(view, 'posAtCoords').mockReturnValue(null)
    menuEl()?.dispatchEvent(mouse('mousemove', { clientX: 40, clientY: 25 }))
    const dispatchSpy = vi.spyOn(view, 'dispatch')
    clickMenuItem('删除块')
    expect(view.state.doc.toString()).toBe('# H1')
    expect(changeDispatchCount(dispatchSpy)).toBe(1)
  })

  it('hides the handle when the editor scrolls away', () => {
    hover(PARAGRAPH_POS)
    view.scrollDOM.dispatchEvent(new Event('scroll'))
    expect(handleEl().style.display).toBe('none')
  })

  it('drag shows a blue insertion line and reorders the block in one transaction', () => {
    hover(PARAGRAPH_POS)
    const dispatchSpy = vi.spyOn(view, 'dispatch')
    const el = handleEl()
    // Drag start at the origin, then move far enough to cross the threshold.
    el.dispatchEvent(mouse('mousedown', { clientX: 0, clientY: 0 }))
    vi.spyOn(view, 'posAtCoords').mockReturnValue(HEADING_POS)
    document.dispatchEvent(mouse('mousemove', { clientX: 80, clientY: 80 }))

    const line = view.dom.querySelector<HTMLElement>('.block-insert-line')
    expect(line).not.toBeNull()
    expect(line?.style.display).toBe('block')

    document.dispatchEvent(mouse('mouseup'))
    expect(view.state.doc.toString()).toBe('Paragraph one here.\n\n# H1')
    expect(changeDispatchCount(dispatchSpy)).toBe(1)
  })

  it('positions the handle relative to the editor origin, not the viewport', () => {
    // coordsAtPos/getBoundingClientRect are viewport-relative, but the handle
    // is an absolute child of view.dom — the editor origin must be subtracted.
    vi.spyOn(view, 'posAtCoords').mockReturnValue(PARAGRAPH_POS)
    vi.spyOn(view, 'coordsAtPos').mockReturnValue({ left: 300, right: 320, top: 240, bottom: 260 })
    vi.spyOn(view.dom, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 50, 800, 600))
    view.dom.dispatchEvent(mouse('mousemove', { clientX: 5, clientY: 25 }))

    const el = handleEl()
    expect(el.style.left).toBe('174px')
    expect(el.style.top).toBe('190px')
  })

  it('positions the menu relative to the editor origin', () => {
    hover(PARAGRAPH_POS)
    vi.spyOn(view.dom, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 50, 800, 600))
    const el = handleEl()
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(new DOMRect(400, 100, 20, 20))
    openMenu()

    expect(menuEl()?.style.left).toBe('328px')
    expect(menuEl()?.style.top).toBe('50px')
  })

  it('positions the insertion line relative to the editor origin during a drag', () => {
    vi.spyOn(view, 'posAtCoords').mockReturnValue(PARAGRAPH_POS)
    vi.spyOn(view, 'coordsAtPos').mockReturnValue({ left: 300, right: 320, top: 240, bottom: 260 })
    vi.spyOn(view.dom, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 50, 800, 600))
    view.dom.dispatchEvent(mouse('mousemove', { clientX: 5, clientY: 25 }))

    const el = handleEl()
    el.dispatchEvent(mouse('mousedown', { clientX: 0, clientY: 0 }))
    vi.spyOn(view, 'posAtCoords').mockReturnValue(HEADING_POS)
    document.dispatchEvent(mouse('mousemove', { clientX: 80, clientY: 80 }))

    const line = view.dom.querySelector<HTMLElement>('.block-insert-line')
    expect(line?.style.top).toBe('190px')
    document.dispatchEvent(mouse('mouseup'))
  })

  it('removes the handle and menu DOM on editor destroy', () => {
    const localParent = document.createElement('div')
    document.body.appendChild(localParent)
    const local = createMarkdownEditor(localParent, {
      value: DOC,
      extensions: [chapterReorgExtension(), blockHandle()],
    })
    vi.spyOn(local.view, 'posAtCoords').mockReturnValue(PARAGRAPH_POS)
    vi.spyOn(local.view, 'coordsAtPos').mockReturnValue(RECT)
    local.view.dom.dispatchEvent(mouse('mousemove'))

    const handleElement = local.view.dom.querySelector('.mdb-block-handle')
    expect(handleElement).not.toBeNull()

    local.destroy()
    expect(handleElement?.isConnected).toBe(false)
    localParent.remove()
  })
})
