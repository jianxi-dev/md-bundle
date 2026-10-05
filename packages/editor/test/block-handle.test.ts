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
import { undoDepth } from '@codemirror/commands'
import { EditorView } from '@codemirror/view'
import { markdown } from '@codemirror/lang-markdown'
import { createMarkdownEditor } from '../src/editor'
import { chapterReorgExtension } from '../src/chapter-reorg-extension'
import {
  blockHandle,
  selectedBlockField,
  findBlockAt,
  computeBlockMove,
  computeBlockConvert,
  computeBlockTurnInto,
  computeBlockDuplicate,
  computeBlockDelete,
  computeMinimalChange,
  computeBlockIndent,
  computeCalloutType,
  isCalloutBlock,
  blockHandleIcon,
} from '../src/block-handle'
import type { Block } from '../src/block-model'

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

  it('computeMinimalChange trims the common prefix and suffix', () => {
    expect(computeMinimalChange('Hello world', '# Hello world')).toEqual({
      from: 0,
      to: 0,
      insert: '# ',
    })
  })

  it('computeMinimalChange is empty for identical text', () => {
    expect(computeMinimalChange('same', 'same')).toEqual({ from: 4, to: 4, insert: '' })
  })

  it('computeMinimalChange keeps a long document out of the change range', () => {
    // #239: converting a late block must not rewrite the whole document.
    const doc = `${'para\n\n'.repeat(50)}target`
    const next = `${'para\n\n'.repeat(50)}# target`
    const change = computeMinimalChange(doc, next)
    expect(change.to - change.from).toBe(0)
    expect(change.insert).toBe('# ')
    expect(change.from).toBeLessThan(doc.length)
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

// --- computeBlockTurnInto ------------------------------------------------------

describe('computeBlockTurnInto', () => {
  // Single-line block tests
  it('turns a paragraph into h1', () => {
    expect(computeBlockTurnInto('Hello', 0, 5, 'h1')).toBe('# Hello')
  })

  it('turns a paragraph into h2', () => {
    expect(computeBlockTurnInto('Hello', 0, 5, 'h2')).toBe('## Hello')
  })

  it('turns a paragraph into h3', () => {
    expect(computeBlockTurnInto('Hello', 0, 5, 'h3')).toBe('### Hello')
  })

  it('turns a paragraph into h4', () => {
    expect(computeBlockTurnInto('Hello', 0, 5, 'h4')).toBe('#### Hello')
  })

  it('turns a paragraph into h5', () => {
    expect(computeBlockTurnInto('Hello', 0, 5, 'h5')).toBe('##### Hello')
  })

  it('turns a paragraph into h6', () => {
    expect(computeBlockTurnInto('Hello', 0, 5, 'h6')).toBe('###### Hello')
  })

  it('turns an h1 into paragraph (strips markers)', () => {
    expect(computeBlockTurnInto('# Title', 0, 7, 'paragraph')).toBe('Title')
  })

  it('turns an h3 into paragraph (strips markers)', () => {
    expect(computeBlockTurnInto('### Title', 0, 9, 'paragraph')).toBe('Title')
  })

  it('turns a paragraph into bullet list', () => {
    expect(computeBlockTurnInto('Hello', 0, 5, 'bullet')).toBe('- Hello')
  })

  it('turns a paragraph into task', () => {
    expect(computeBlockTurnInto('Hello', 0, 5, 'task')).toBe('- [ ] Hello')
  })

  it('turns a paragraph into quote', () => {
    expect(computeBlockTurnInto('Hello', 0, 5, 'quote')).toBe('> Hello')
  })

  it('turns a paragraph into callout', () => {
    expect(computeBlockTurnInto('Hello', 0, 5, 'callout')).toBe('> [!NOTE] Hello')
  })

  it('turns a paragraph into code (wraps in fence)', () => {
    const result = computeBlockTurnInto('Hello', 0, 5, 'code')
    expect(result).toBe('```\nHello\n```')
  })

  it('turns a paragraph into table (single column)', () => {
    const result = computeBlockTurnInto('A B', 0, 3, 'table')
    expect(result).toContain('| A B |')
    expect(result).toContain('| --- |')
  })

  // Multi-line block tests (per-line conversion)
  it('turns multi-line block into h2 (per line)', () => {
    expect(computeBlockTurnInto('one\ntwo\nthree', 0, 13, 'h2')).toBe('## one\n## two\n## three')
  })

  it('turns multi-line block into bullet list (per line)', () => {
    expect(computeBlockTurnInto('one\ntwo\nthree', 0, 13, 'bullet')).toBe('- one\n- two\n- three')
  })

  it('turns multi-line block into task (per line)', () => {
    expect(computeBlockTurnInto('one\ntwo\nthree', 0, 13, 'task')).toBe('- [ ] one\n- [ ] two\n- [ ] three')
  })

  it('turns multi-line block into quote (per line)', () => {
    expect(computeBlockTurnInto('one\ntwo\nthree', 0, 13, 'quote')).toBe('> one\n> two\n> three')
  })

  it('turns multi-line block into callout (first line [!NOTE], rest >)', () => {
    expect(computeBlockTurnInto('one\ntwo\nthree', 0, 13, 'callout')).toBe('> [!NOTE] one\n> two\n> three')
  })

  it('turns multi-line block into code (wraps whole block)', () => {
    const result = computeBlockTurnInto('one\ntwo\nthree', 0, 13, 'code')
    expect(result).toBe('```\none\ntwo\nthree\n```')
  })

  it('turns multi-line block into table (single column)', () => {
    const input = 'Header1 Header2\nRow1 Col1 Row1 Col2\nRow2 Col1 Row2 Col2'
    const result = computeBlockTurnInto(input, 0, input.length, 'table')
    expect(result).toContain('| Header1 Header2 |')
    expect(result).toContain('| --- |')
    expect(result).toContain('| Row1 Col1 Row1 Col2 |')
    expect(result).toContain('| Row2 Col1 Row2 Col2 |')
  })

  // Marker stripping tests
  it('strips existing heading markers before converting to h2', () => {
    expect(computeBlockTurnInto('# Title', 0, 7, 'h2')).toBe('## Title')
  })

  it('strips existing list markers before converting to task', () => {
    expect(computeBlockTurnInto('- Item', 0, 6, 'task')).toBe('- [ ] Item')
  })

  it('strips existing task markers before converting to list', () => {
    expect(computeBlockTurnInto('- [ ] Task', 0, 10, 'bullet')).toBe('- Task')
  })

  it('strips existing quote markers before converting to list', () => {
    expect(computeBlockTurnInto('> Quote', 0, 7, 'bullet')).toBe('- Quote')
  })

  it('strips existing callout markers before converting to quote', () => {
    expect(computeBlockTurnInto('> [!NOTE] Note', 0, 13, 'quote')).toBe('> Note')
  })

  it('strips ordered list markers before converting to list', () => {
    expect(computeBlockTurnInto('1. First', 0, 8, 'bullet')).toBe('- First')
  })

  // Blank line preservation
  it('preserves blank lines in multi-line block', () => {
    expect(computeBlockTurnInto('one\n\ntwo', 0, 9, 'h2')).toBe('## one\n\n## two')
  })

  // Empty block
  it('returns original text for empty block', () => {
    expect(computeBlockTurnInto('Hello', 5, 5, 'h1')).toBe('Hello')
  })

  // Partial selection within a larger document
  it('converts only the specified block range in a larger document', () => {
    const doc = 'Before\n\nTarget block\n\nAfter'
    // "Target block" is at offset 7-19
    const result = computeBlockTurnInto(doc, 7, 19, 'h1')
    expect(result).toBe('Before\n\n# Target block\n\nAfter')
  })
})

// --- blockHandleIcon -----------------------------------------------------------

describe('blockHandleIcon', () => {
  function makeBlock(overrides: Partial<Block>): Block {
    return {
      from: 0,
      to: 10,
      type: 'paragraph',
      node: {},
      ...overrides,
    }
  }

  it('returns H1..H6 icon names for heading blocks with level', () => {
    expect(blockHandleIcon(makeBlock({ type: 'heading', level: 1 }))).toBe('H1Outlined')
    expect(blockHandleIcon(makeBlock({ type: 'heading', level: 2 }))).toBe('H2Outlined')
    expect(blockHandleIcon(makeBlock({ type: 'heading', level: 3 }))).toBe('H3Outlined')
    expect(blockHandleIcon(makeBlock({ type: 'heading', level: 4 }))).toBe('H4Outlined')
    expect(blockHandleIcon(makeBlock({ type: 'heading', level: 5 }))).toBe('H5Outlined')
    expect(blockHandleIcon(makeBlock({ type: 'heading', level: 6 }))).toBe('H6Outlined')
  })

  it('falls back to HOutlined for heading without level', () => {
    expect(blockHandleIcon(makeBlock({ type: 'heading' }))).toBe('HOutlined')
  })

  it('returns checked/unchecked icon names for task blocks', () => {
    expect(blockHandleIcon(makeBlock({ type: 'task', checked: true }))).toBe('TodoOutlined')
    expect(blockHandleIcon(makeBlock({ type: 'task', checked: false }))).toBe('TodoOutlined')
  })

  it('returns quote icon name for blockquote', () => {
    expect(blockHandleIcon(makeBlock({ type: 'blockquote' }))).toBe('ReferenceOutlined')
  })

  it('returns code icon name for fencedCode and codeBlock', () => {
    expect(blockHandleIcon(makeBlock({ type: 'fencedCode' }))).toBe('CodeblockOutlined')
    expect(blockHandleIcon(makeBlock({ type: 'codeBlock' }))).toBe('CodeblockOutlined')
  })

  it('returns list icon name for list', () => {
    expect(blockHandleIcon(makeBlock({ type: 'list' }))).toBe('DisorderListOutlined')
  })

  it('returns table icon name for table', () => {
    expect(blockHandleIcon(makeBlock({ type: 'table' }))).toBe('DataSheetOutlined')
  })

  it('returns thematicBreak icon name', () => {
    expect(blockHandleIcon(makeBlock({ type: 'thematicBreak' }))).toBe('DividerOutlined')
  })

  it('returns image icon name', () => {
    expect(blockHandleIcon(makeBlock({ type: 'image' }))).toBe('ImageOutlined')
  })

  it('returns htmlBlock icon name', () => {
    expect(blockHandleIcon(makeBlock({ type: 'htmlBlock' }))).toBe('CodeOffOutlined')
  })

  it('returns drag-handle icon name for paragraph', () => {
    expect(blockHandleIcon(makeBlock({ type: 'paragraph' }))).toBe('TextOutlined')
  })

  it('returns drag-handle icon name for yamlFrontMatter and unknown types', () => {
    expect(blockHandleIcon(makeBlock({ type: 'yamlFrontMatter' }))).toBe('TextOutlined')
  })
})

// --- #330 menu helpers --------------------------------------------------------

describe('#330 block menu helpers', () => {
  it('detects callout blocks and only them', () => {
    expect(isCalloutBlock('> [!NOTE]\n> body')).toBe(true)
    expect(isCalloutBlock('  > [!WARNING] title')).toBe(true)
    expect(isCalloutBlock('> plain quote')).toBe(false)
    expect(isCalloutBlock('paragraph [!NOTE]')).toBe(false)
  })

  it('rewrites the callout type marker', () => {
    expect(computeCalloutType('> [!NOTE]\n> body', 'WARNING')).toBe('> [!WARNING]\n> body')
  })

  it('indents and outdents a block reversibly', () => {
    const doc = 'a\nb'
    const indented = computeBlockIndent(doc, 0, doc.length, 'increase')
    expect(indented).toBe('  a\n  b')
    expect(computeBlockIndent(indented, 0, indented.length, 'decrease')).toBe('a\nb')
  })

  it('leaves blank lines blank when indenting', () => {
    const doc = 'a\n\nb'
    expect(computeBlockIndent(doc, 0, doc.length, 'increase')).toBe('  a\n\n  b')
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
    // Footer rows carry a visible label span; 转为 rows are icon-only grid
    // buttons identified by aria-label (#330).
    const item =
      Array.from(view.dom.querySelectorAll<HTMLButtonElement>('.mdb-block-handle-item')).find(
        (el) => el.querySelector('.mdb-block-handle-item-label')?.textContent === label,
      ) ??
      Array.from(view.dom.querySelectorAll<HTMLButtonElement>('.mdb-block-handle-grid-item')).find(
        (el) => el.getAttribute('aria-label') === label,
      )
    if (!item) throw new Error(`menu item not found: ${label}`)
    item.dispatchEvent(mouse('click'))
  }

  /** Pointer enters the visible handle (mouseenter does not bubble). */
  function enterHandle(): void {
    handleEl().dispatchEvent(mouse('mouseenter'))
  }

  /** Resolve after the hover-intent delay has elapsed. */
  function waitForHoverIntent(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 200))
  }

  /** Current selected-block range, or null when nothing is selected. */
  function selectedRange(): { from: number; to: number } | null {
    return view.state.field(selectedBlockField, false) ?? null
  }

  function changeDispatchCount(spy: { mock: { calls: unknown[][] } }): number {
    const calls = spy.mock.calls as { changes?: unknown }[][]
    return calls.flat().filter((spec) => spec.changes !== undefined).length
  }

  it('shows a gutter handle while hovering a top-level block', () => {
    hover(PARAGRAPH_POS)
    const el = handleEl()
    expect(el.getAttribute('data-testid')).toBe('block-handle')
    expect(el.getAttribute('data-icon')).toBe('TextOutlined')
    expect(el.querySelector('svg')).not.toBeNull()
    // No bare text nodes as direct children (#322 guard). The block-type glyph
    // lives inside the SVG <text>, so el.textContent legitimately carries it.
    const bareText = Array.from(el.childNodes).some(
      (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim().length > 0,
    )
    expect(bareText).toBe(false)
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
    const gridLabels = Array.from(
      menu?.querySelectorAll('.mdb-block-handle-grid-item') ?? [],
    ).map((el) => el.getAttribute('aria-label'))
    expect(gridLabels).toEqual([
      '正文',
      '一级标题',
      '二级标题',
      '三级标题',
      '有序',
      '无序',
      '待办',
      '代码',
      '引用',
      '高亮',
    ])
    expect(menu?.textContent).toContain('复制')
    expect(menu?.textContent).toContain('删除')
    expect(menu?.style.display).toBe('block')
  })

  it('builds a convert grid plus indent/align and color flyout rows (#330)', () => {
    hover(PARAGRAPH_POS)
    openMenu()
    const menu = menuEl()
    expect(menu?.querySelectorAll('.mdb-block-handle-grid-item').length).toBe(10)
    const flyouts = Array.from(menu?.querySelectorAll('[data-flyout]') ?? []).map((el) =>
      el.getAttribute('data-flyout'),
    )
    // #358: 在下方添加› carries data-flyout="insert-menu" for its chevron; the
    // panel itself is opened by block-handle.ts, not this flyout map.
    expect(flyouts).toEqual(['indent-align', 'color', 'callout-type', 'insert-menu'])
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

  it('复制 duplicates the block in one transaction', () => {
    hover(PARAGRAPH_POS)
    openMenu()
    const dispatchSpy = vi.spyOn(view, 'dispatch')
    clickMenuItem('复制')
    expect(view.state.doc.toString()).toBe('# H1\n\nParagraph one here.\n\nParagraph one here.')
    expect(changeDispatchCount(dispatchSpy)).toBe(1)
  })

  it('删除 removes the block in one transaction', () => {
    hover(PARAGRAPH_POS)
    openMenu()
    const dispatchSpy = vi.spyOn(view, 'dispatch')
    clickMenuItem('删除')
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

  it('删除 works after the pointer crossed from the gutter onto the menu', () => {
    hover(PARAGRAPH_POS)
    openMenu()
    vi.spyOn(view, 'posAtCoords').mockReturnValue(null)
    menuEl()?.dispatchEvent(mouse('mousemove', { clientX: 40, clientY: 25 }))
    const dispatchSpy = vi.spyOn(view, 'dispatch')
    clickMenuItem('删除')
    expect(view.state.doc.toString()).toBe('# H1')
    expect(changeDispatchCount(dispatchSpy)).toBe(1)
  })

  it('dismisses the handle and menu on scroll', () => {
    hover(PARAGRAPH_POS)
    openMenu()
    expect(handleEl().style.display).not.toBe('none')
    expect(menuEl()?.style.display).toBe('block')

    view.scrollDOM.dispatchEvent(new Event('scroll'))
    // Scrolling tears the widget down instead of re-anchoring it (R-CHOREO-03).
    expect(handleEl().style.display).toBe('none')
    expect(menuEl()?.style.display).toBe('none')
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

  it('positions the handle in the gutter column, relative to the editor origin', () => {
    // coordsAtPos/getBoundingClientRect are viewport-relative, but the handle
    // is an absolute child of view.dom — the editor origin must be subtracted.
    vi.spyOn(view, 'posAtCoords').mockReturnValue(PARAGRAPH_POS)
    vi.spyOn(view, 'coordsAtPos').mockReturnValue({ left: 300, right: 320, top: 240, bottom: 260 })
    vi.spyOn(view.dom, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 50, 800, 600))
    vi.spyOn(view.contentDOM, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(100, 50, 800, 600),
    )
    view.dom.dispatchEvent(mouse('mousemove', { clientX: 5, clientY: 25 }))

    const el = handleEl()
    expect(el.style.left).toBe('-44px')
    expect(el.style.top).toBe('190px')
  })

  it('positions the menu relative to the editor origin', () => {
    hover(PARAGRAPH_POS)
    vi.spyOn(view.dom, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 50, 800, 600))
    const el = handleEl()
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(new DOMRect(400, 100, 20, 20))
    openMenu()

    expect(menuEl()?.style.left).toBe('328px')
    expect(menuEl()?.style.top).toBe('-30px')
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

  it('selects the hovered block range', () => {
    hover(PARAGRAPH_POS)
    expect(selectedRange()).toEqual({ from: 6, to: 25 })
  })

  it('selects every line of a multiline block', () => {
    const localParent = document.createElement('div')
    document.body.appendChild(localParent)
    const local = createMarkdownEditor(localParent, {
      value: '# Alpha\n\n- one\n- two\n- three\n\nBeta paragraph.',
      extensions: [chapterReorgExtension(), blockHandle()],
    })
    const localView = local.view
    vi.spyOn(localView, 'posAtCoords').mockReturnValue(16)
    vi.spyOn(localView, 'coordsAtPos').mockReturnValue(RECT)
    localView.dom.dispatchEvent(mouse('mousemove', { clientX: 5, clientY: 25 }))

    const selected = localView.state.field(selectedBlockField, false)
    expect(selected).not.toBeNull()
    if (!selected) throw new Error('expected a selected block range')
    const numbers: number[] = []
    for (let n = localView.state.doc.lineAt(selected.from).number; n <= localView.state.doc.lineAt(selected.to).number; n++) {
      numbers.push(n)
    }
    expect(numbers).toEqual([3, 4, 5])

    local.destroy()
    localParent.remove()
  })

  it('opens the menu only after the hover-intent delay', async () => {
    hover(PARAGRAPH_POS)
    expect(menuEl()?.style.display).not.toBe('block')
    enterHandle()
    // Still closed: the intent buffer has not elapsed yet.
    expect(menuEl()?.style.display).not.toBe('block')
    await waitForHoverIntent()
    expect(menuEl()?.style.display).toBe('block')
  })

  it('keeps the selection while the menu is open and clears it on Escape', async () => {
    hover(PARAGRAPH_POS)
    enterHandle()
    await waitForHoverIntent()
    expect(selectedRange()).toEqual({ from: 6, to: 25 })
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(selectedRange()).toBeNull()
  })

  it('dismisses the open menu when the pointer leaves the merged stack', async () => {
    hover(PARAGRAPH_POS)
    enterHandle()
    await waitForHoverIntent()
    expect(menuEl()?.style.display).toBe('block')
    expect(selectedRange()).toEqual({ from: 6, to: 25 })

    // clientX 40 sits outside the 8px gutter corridor and off the handle/menu,
    // so the pointer has left the merged stack and the widget is torn down.
    vi.spyOn(view, 'posAtCoords').mockReturnValue(HEADING_POS)
    view.dom.dispatchEvent(mouse('mousemove', { clientX: 40, clientY: 25 }))
    expect(menuEl()?.style.display).toBe('none')
    expect(handleEl().style.display).toBe('none')
    expect(selectedRange()).toBeNull()
  })

  it('dims the handle while the pointer crosses the gap and un-dims on the menu', async () => {
    hover(PARAGRAPH_POS)
    enterHandle()
    await waitForHoverIntent()
    const el = handleEl()
    expect(el.classList.contains('mdb-block-handle-dimmed')).toBe(false)

    vi.spyOn(view, 'posAtCoords').mockReturnValue(null)
    view.dom.dispatchEvent(mouse('mousemove', { clientX: 2, clientY: 25 }))
    expect(menuEl()?.style.display).toBe('block')
    expect(el.classList.contains('mdb-block-handle-dimmed')).toBe(true)

    menuEl()?.dispatchEvent(mouse('mousemove', { clientX: 40, clientY: 25 }))
    expect(el.classList.contains('mdb-block-handle-dimmed')).toBe(false)
  })

  it('clears the selection after a menu action', async () => {
    hover(PARAGRAPH_POS)
    enterHandle()
    await waitForHoverIntent()
    clickMenuItem('复制')
    expect(selectedRange()).toBeNull()
  })

  it('does not add undo depth while hovering, selecting or opening the menu', async () => {
    const before = undoDepth(view.state)
    hover(PARAGRAPH_POS)
    enterHandle()
    await waitForHoverIntent()
    expect(undoDepth(view.state)).toBe(before)
  })

  it('fades the handle in on the hidden-to-visible edge only', () => {
    const animate = vi.fn()
    const original = Element.prototype.animate
    Element.prototype.animate = animate as unknown as Element['animate']
    try {
      hover(PARAGRAPH_POS)
      expect(animate).toHaveBeenCalledTimes(1)
      expect(animate.mock.calls[0]?.[0]).toEqual([{ opacity: '0' }, { opacity: '1' }])

      // Further mousemoves within the same block re-anchor without re-fading.
      vi.spyOn(view, 'posAtCoords').mockReturnValue(PARAGRAPH_POS)
      view.dom.dispatchEvent(mouse('mousemove', { clientX: 6, clientY: 25 }))
      expect(animate).toHaveBeenCalledTimes(1)
    } finally {
      if (original === undefined) {
        delete (Element.prototype as { animate?: Element['animate'] }).animate
      } else {
        Element.prototype.animate = original
      }
    }
  })

  it('leaves no handle, menu or selection residue on editor destroy', async () => {
    const localParent = document.createElement('div')
    document.body.appendChild(localParent)
    const local = createMarkdownEditor(localParent, {
      value: DOC,
      extensions: [chapterReorgExtension(), blockHandle()],
    })
    vi.spyOn(local.view, 'posAtCoords').mockReturnValue(PARAGRAPH_POS)
    vi.spyOn(local.view, 'coordsAtPos').mockReturnValue(RECT)
    local.view.dom.dispatchEvent(mouse('mousemove', { clientX: 5, clientY: 25 }))
    const localHandle = local.view.dom.querySelector<HTMLElement>('.mdb-block-handle')
    if (!localHandle) throw new Error('block handle not found')
    localHandle.dispatchEvent(mouse('mouseenter'))
    await waitForHoverIntent()
    expect(local.view.dom.querySelector('[data-testid="block-handle-menu"]')).not.toBeNull()

    local.destroy()
    expect(localHandle.isConnected).toBe(false)
    expect(localParent.querySelector('[data-testid="block-handle-menu"]')).toBeNull()
    localParent.remove()
  })

  it('keeps the chrome alive when the same range is reclassified from list to task', () => {
    const localParent = document.createElement('div')
    document.body.appendChild(localParent)
    const local = createMarkdownEditor(localParent, {
      value: '- a\n- b',
      extensions: [chapterReorgExtension(), blockHandle()],
    })
    const localView = local.view
    vi.spyOn(localView, 'posAtCoords').mockReturnValue(3)
    vi.spyOn(localView, 'coordsAtPos').mockReturnValue(RECT)
    localView.dom.dispatchEvent(mouse('mousemove', { clientX: 5, clientY: 25 }))

    const before = localView.state.field(selectedBlockField, false)
    expect(before).not.toBeNull()
    if (!before) throw new Error('expected a selected block range')
    expect(findBlockAt(localView.state, before.from)?.type).toBe('list')

    // The block keeps its identity across the reclassification, so the mapped
    // range must stay pinned to the exact new boundaries: a stale range would
    // resolve to no block and wrongly clear the chrome.
    const reclassify = localView.state.update({
      changes: { from: before.from, to: before.to, insert: '- [ ] a\n- [ ] b' },
    })
    const retagged = findBlockAt(reclassify.state, before.from)
    expect(retagged?.type).toBe('task')
    expect(reclassify.state.field(selectedBlockField, false)).toEqual({
      from: retagged?.from,
      to: retagged?.to,
    })

    localView.dispatch(reclassify)

    const live = findBlockAt(localView.state, before.from)
    expect(live?.type).toBe('task')
    const handle = localView.dom.querySelector<HTMLElement>('.mdb-block-handle')
    expect(handle?.style.display).not.toBe('none')
    if (!live) throw new Error('expected the task block to survive the dispatch')
    expect(handle?.getAttribute('data-icon')).toBe(blockHandleIcon(live))

    local.destroy()
    localParent.remove()
  })
})
