/**
 * Block handle CM6 extension — issue #189: hover shows a `⠿` gutter handle,
 * click opens a 转换为 / 复制块 / 删除块 menu, and drag reorders the block with a
 * blue insertion line (one undoable transaction). Escape, scroll, and view
 * destroy all remove the DOM.
 *
 * Layout comes from `view.coordsAtPos` (jsdom degrades silently to an unplaced
 * element). Block boundaries come from `block-model.ts`; the pure math lives in
 * `block-handle-ops.ts` (re-exported as the single import surface). Drag state
 * lives in `chapter-reorg-extension.ts`, installed alongside this extension.
 */
import type { Extension } from '@codemirror/state'
import { ViewPlugin, type EditorView, type ViewUpdate } from '@codemirror/view'
import type { Block } from './block-model'
import { currentDrag, setDragEffect } from './chapter-reorg-extension'
import { HandleChrome, blockHandleTheme, ITEM_CLASS } from './block-handle-dom'
import {
  findBlockAt,
  computeBlockMove,
  computeBlockConvert,
  computeBlockDuplicate,
  computeBlockDelete,
  type BlockConvertTarget,
} from './block-handle-ops'

export {
  findBlockAt,
  computeBlockMove,
  computeBlockConvert,
  computeBlockDuplicate,
  computeBlockDelete,
  type BlockConvertTarget,
} from './block-handle-ops'

/** Pointer travel (px) before a press becomes a drag rather than a click. */
const DRAG_THRESHOLD_SQ = 16

const isConvertTarget = (value: string | null): value is BlockConvertTarget =>
  value === 'h1' || value === 'h2' || value === 'h3' || value === 'paragraph'

// --- ViewPlugin --------------------------------------------------------------

class BlockHandlePlugin {
  private readonly view: EditorView
  private readonly chrome: HandleChrome
  private currentBlock: Block | null = null
  private menuBlock: Block | null = null
  private moved = false
  private justDragged = false
  private listening = false
  private dragOrigin = { x: 0, y: 0 }

  /** Escape must close the widget no matter where focus currently is. */
  private readonly onEscape = (): void => this.chrome.hideAll()

  constructor(view: EditorView) {
    this.view = view
    if (view.dom.style.position === '' || view.dom.style.position === 'static') {
      view.dom.style.position = 'relative'
    }
    this.chrome = new HandleChrome(this.onEscape)
    this.chrome.mount(view.dom)

    view.dom.addEventListener('mousemove', this.onMouseMove)
    view.dom.addEventListener('mouseleave', this.onMouseLeave)
    view.scrollDOM.addEventListener('scroll', this.onScroll)
    this.chrome.handle.addEventListener('mousedown', this.onHandleMouseDown)
    this.chrome.handle.addEventListener('click', this.onHandleClick)
    this.chrome.menu.addEventListener('click', this.onMenuClick)
  }

  update(update: ViewUpdate): void {
    if (!update.docChanged) return
    this.chrome.hideAll()
    // A document change under an active drag invalidates its offsets; abort it.
    if (currentDrag(update.state)) this.endDrag()
  }

  destroy(): void {
    this.view.dom.removeEventListener('mousemove', this.onMouseMove)
    this.view.dom.removeEventListener('mouseleave', this.onMouseLeave)
    this.view.scrollDOM.removeEventListener('scroll', this.onScroll)
    this.chrome.handle.removeEventListener('mousedown', this.onHandleMouseDown)
    this.chrome.handle.removeEventListener('click', this.onHandleClick)
    this.chrome.menu.removeEventListener('click', this.onMenuClick)
    this.removeDocumentListeners()
    this.chrome.unmount()
  }

  // --- Positioning -----------------------------------------------------------

  private showHandleAt(from: number): void {
    this.chrome.showHandle()
    try {
      const coords = this.view.coordsAtPos(from)
      if (coords) {
        const r = this.view.dom.getBoundingClientRect()
        this.chrome.handle.style.left = `${coords.left - r.left - 26}px`
        this.chrome.handle.style.top = `${coords.top - r.top}px`
      }
    } catch {
      // jsdom / unmeasured content — keep the default position.
    }
  }

  private showInsertLine(target: Block, before: boolean): void {
    this.chrome.showInsertLine()
    try {
      const at = before ? target.from : Math.max(target.from, target.to - 1)
      const coords = this.view.coordsAtPos(at)
      if (coords) {
        const r = this.view.dom.getBoundingClientRect()
        this.chrome.insertLine.style.top = `${(before ? coords.top : coords.bottom) - r.top}px`
      }
    } catch {
      // jsdom / unmeasured content — keep the default position.
    }
  }

  private openMenu(): void {
    const rect = this.chrome.handle.getBoundingClientRect()
    const r = this.view.dom.getBoundingClientRect()
    this.chrome.menu.style.left = `${rect.right - r.left + 8}px`
    this.chrome.menu.style.top = `${rect.top - r.top}px`
    this.chrome.showMenu()
  }

  // --- Hover -----------------------------------------------------------------

  private onMouseMove = (event: MouseEvent): void => {
    if (currentDrag(this.view.state) || this.moved) return
    const target = event.target
    const overOwnUi =
      target instanceof Node &&
      (this.chrome.handle.contains(target) || this.chrome.menu.contains(target))
    // An open menu (and the handle it hangs from) must never dismiss itself
    // under the pointer that is travelling towards it.
    if (overOwnUi || this.chrome.menu.style.display !== 'none') return
    const pos = this.view.posAtCoords({ x: event.clientX, y: event.clientY })
    if (pos === null) {
      this.chrome.hideAll()
      return
    }
    const block = findBlockAt(this.view.state, pos)
    if (!block) {
      this.chrome.hideAll()
      return
    }
    this.currentBlock = block
    this.showHandleAt(block.from)
  }

  private onMouseLeave = (): void => {
    if (currentDrag(this.view.state)) return
    this.chrome.hideAll()
  }

  private onScroll = (): void => {
    this.chrome.hideHandle()
    this.chrome.hideMenu()
  }

  // --- Drag ------------------------------------------------------------------

  private onHandleMouseDown = (event: MouseEvent): void => {
    if (event.button !== 0 || !this.currentBlock) return
    event.preventDefault()
    this.moved = false
    this.justDragged = false
    this.dragOrigin = { x: event.clientX, y: event.clientY }
    const block = this.currentBlock
    const targetLine = this.view.state.doc.lineAt(block.from).number
    this.view.dispatch({
      effects: setDragEffect.of({ from: block.from, to: block.to, targetLine }),
    })
    this.chrome.hideMenu()
    document.addEventListener('mousemove', this.onDocumentMouseMove)
    document.addEventListener('mouseup', this.onDocumentMouseUp)
    this.listening = true
  }

  private onHandleClick = (event: MouseEvent): void => {
    if (this.justDragged) {
      this.justDragged = false
      return
    }
    if (!this.currentBlock) return
    this.menuBlock = this.currentBlock
    this.openMenu()
    event.stopPropagation()
  }

  private onDocumentMouseMove = (event: MouseEvent): void => {
    const drag = currentDrag(this.view.state)
    if (!drag) return
    if (!this.moved) {
      const dx = event.clientX - this.dragOrigin.x
      const dy = event.clientY - this.dragOrigin.y
      if (dx * dx + dy * dy < DRAG_THRESHOLD_SQ) return
      this.moved = true
    }
    const pos = this.view.posAtCoords({ x: event.clientX, y: event.clientY })
    if (pos === null) return
    const target = findBlockAt(this.view.state, pos)
    if (!target) return

    const midpoint = target.from + (target.to - target.from) / 2
    const dropBefore = pos < midpoint
    const at = dropBefore ? target.from : Math.max(target.from, target.to - 1)
    const targetLine = this.view.state.doc.lineAt(at).number + (dropBefore ? 0 : 1)
    if (targetLine !== drag.targetLine) {
      this.view.dispatch({ effects: setDragEffect.of({ ...drag, targetLine }) })
    }
    this.showInsertLine(target, dropBefore)
    this.chrome.hideHandle()
  }

  private onDocumentMouseUp = (): void => {
    const drag = currentDrag(this.view.state)
    this.removeDocumentListeners()
    this.chrome.hideInsertLine()
    if (!drag) return
    if (this.moved) {
      const text = this.view.state.doc.toString()
      const next = computeBlockMove(text, drag.from, drag.to, drag.targetLine)
      if (next !== text) {
        this.view.dispatch({ changes: { from: 0, to: text.length, insert: next } })
      }
      this.justDragged = true
    }
    this.moved = false
    this.view.dispatch({ effects: setDragEffect.of(null) })
  }

  private endDrag(): void {
    this.removeDocumentListeners()
    this.moved = false
    this.justDragged = false
    this.chrome.hideInsertLine()
  }

  private removeDocumentListeners(): void {
    if (!this.listening) return
    document.removeEventListener('mousemove', this.onDocumentMouseMove)
    document.removeEventListener('mouseup', this.onDocumentMouseUp)
    this.listening = false
  }

  // --- Menu actions ----------------------------------------------------------

  private onMenuClick = (event: MouseEvent): void => {
    const from = event.target
    if (!(from instanceof Element) || !this.menuBlock) return
    const item = from.closest(`.${ITEM_CLASS}`)
    if (!item) return

    const block = this.menuBlock
    const text = this.view.state.doc.toString()
    const convert = item.getAttribute('data-convert')
    const action = item.getAttribute('data-action')
    let next = text
    if (isConvertTarget(convert)) {
      next = computeBlockConvert(text, block.from, block.to, convert)
    } else if (action === 'duplicate') {
      next = computeBlockDuplicate(text, block.from, block.to)
    } else if (action === 'delete') {
      next = computeBlockDelete(text, block.from, block.to)
    }
    if (next !== text) {
      this.view.dispatch({ changes: { from: 0, to: text.length, insert: next } })
    }
    this.chrome.hideMenu()
    event.stopPropagation()
  }
}

// --- Extension ---------------------------------------------------------------

/**
 * CM6 extension that adds the gutter block handle, its menu, and drag reorder.
 * Requires `chapterReorgExtension()` in the same extension set for drag state.
 */
export function blockHandle(): Extension {
  return [ViewPlugin.fromClass(BlockHandlePlugin), blockHandleTheme]
}
