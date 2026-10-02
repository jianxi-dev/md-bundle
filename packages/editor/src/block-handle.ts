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
import { getBlocks, type Block } from './block-model'
import { currentDrag, setDragEffect } from './chapter-reorg-extension'
import { HandleChrome, blockHandleTheme, ITEM_CLASS } from './block-handle-dom'
import {
  findBlockAt,
  computeBlockMove,
  computeBlockConvert,
  computeBlockDuplicate,
  computeBlockDelete,
  computeMinimalChange,
  blockStillExists,
  isBlockInViewport,
  blockHandleIcon,
  type BlockConvertTarget,
} from './block-handle-ops'

export {
  findBlockAt,
  computeBlockMove,
  computeBlockConvert,
  computeBlockDuplicate,
  computeBlockDelete,
  computeMinimalChange,
  blockStillExists,
  isBlockInViewport,
  blockHandleIcon,
  type BlockConvertTarget,
  type MinimalChange,
} from './block-handle-ops'

/** Pointer travel (px) before a press becomes a drag rather than a click. */
const DRAG_THRESHOLD_SQ = 16

const CONVERT_TARGETS: readonly BlockConvertTarget[] = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'paragraph',
]

const isConvertTarget = (value: string | null): value is BlockConvertTarget =>
  value !== null && (CONVERT_TARGETS as readonly string[]).includes(value)

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
  private pointerInHandleOrMenu = false

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
    this.chrome.handle.addEventListener('mousedown', this.onHandleMouseDown)
    this.chrome.handle.addEventListener('click', this.onHandleClick)
    this.chrome.handle.addEventListener('mouseenter', this.onHandleMouseEnter)
    this.chrome.handle.addEventListener('mouseleave', this.onHandleMouseLeave)
    this.chrome.menu.addEventListener('click', this.onMenuClick)
    this.chrome.menu.addEventListener('mouseenter', this.onMenuMouseEnter)
    this.chrome.menu.addEventListener('mouseleave', this.onMenuMouseLeave)
  }

  // Called by ViewPlugin after each scroll — viewport is guaranteed updated.
  scroll(): void {
    if (!this.currentBlock) return
    if (isBlockInViewport(this.view, this.currentBlock)) {
      this.showHandleAt(this.currentBlock.from)
    } else {
      this.chrome.hideHandle()
      this.chrome.hideMenu()
      this.currentBlock = null
      this.menuBlock = null
    }
  }

  update(update: ViewUpdate): void {
    if (!update.docChanged) return

    // Drag abort must ALWAYS run on doc change, regardless of handle state.
    if (currentDrag(update.state)) this.endDrag()

    // Re-anchor: if tracked block still exists, reposition; else hide.
    if (this.currentBlock && blockStillExists(update.state, this.currentBlock)) {
      this.showHandleAt(this.currentBlock.from)
    } else {
      this.chrome.hideAll()
      this.currentBlock = null
    }
  }

  destroy(): void {
    this.view.dom.removeEventListener('mousemove', this.onMouseMove)
    this.view.dom.removeEventListener('mouseleave', this.onMouseLeave)
    this.chrome.handle.removeEventListener('mousedown', this.onHandleMouseDown)
    this.chrome.handle.removeEventListener('click', this.onHandleClick)
    this.chrome.handle.removeEventListener('mouseenter', this.onHandleMouseEnter)
    this.chrome.handle.removeEventListener('mouseleave', this.onHandleMouseLeave)
    this.chrome.menu.removeEventListener('click', this.onMenuClick)
    this.chrome.menu.removeEventListener('mouseenter', this.onMenuMouseEnter)
    this.chrome.menu.removeEventListener('mouseleave', this.onMenuMouseLeave)
    this.removeDocumentListeners()
    this.chrome.unmount()
  }

  // --- Positioning -----------------------------------------------------------

  private showHandleAt(from: number): void {
    this.chrome.showHandle()
    const block = findBlockAt(this.view.state, from)
    if (block) this.chrome.setIcon(blockHandleIcon(block))
    try {
      const coords = this.view.coordsAtPos(from)
      if (coords) {
        const r = this.view.dom.getBoundingClientRect()
        // Fixed gutter column: block.from sits after the list marker, so
        // anchoring x to it drifted the handle inward on lists (#237).
        const contentLeft = this.view.contentDOM.getBoundingClientRect().left
        this.chrome.handle.style.left = `${contentLeft - r.left - 22}px`
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

    // If pointer is over our own UI (handle or menu), don't dismiss —
    // the handle/menu mouseenter/leave handlers track this.
    if (this.pointerInHandleOrMenu) return

    // If menu is open, keep it and the handle visible
    if (this.chrome.menu.style.display !== 'none') return

    const pos = this.view.posAtCoords({ x: event.clientX, y: event.clientY })
    if (pos === null) {
      // Pointer over empty area (e.g. blank line). Keep current handle visible
      // as long as the pointer is horizontally within the editor bounds.
      // This creates the "sticky bridge" across vertical gaps.
      if (this.currentBlock && this.isPointerInEditorHorizontally(event.clientX)) {
        return
      }
      this.chrome.hideAll()
      this.currentBlock = null
      return
    }

    const block = findBlockAt(this.view.state, pos)
    if (!block) {
      // Pointer over non-block area but posAtCoords returned a position.
      // Keep current handle if horizontally in editor.
      if (this.currentBlock && this.isPointerInEditorHorizontally(event.clientX)) {
        return
      }
      this.chrome.hideAll()
      this.currentBlock = null
      return
    }

    // New block hovered — update currentBlock and show handle
    this.currentBlock = block
    this.showHandleAt(block.from)
  }

  private isPointerInEditorHorizontally(clientX: number): boolean {
    const contentRect = this.view.contentDOM.getBoundingClientRect()
    const handleLeft = contentRect.left - 22
    const contentRight = contentRect.right
    return clientX >= handleLeft && clientX <= contentRight
  }

  private onMouseLeave = (event: MouseEvent): void => {
    if (currentDrag(this.view.state)) return

    // If pointer is moving to our own handle or menu, don't hide
    const to = event.relatedTarget
    if (to instanceof Node && (this.chrome.handle.contains(to) || this.chrome.menu.contains(to))) {
      return
    }

    // If pointer is still horizontally within editor bounds, keep handle visible
    // (covers gap-crossing and empty-line traversal).
    if (this.currentBlock && this.isPointerInEditorHorizontally(event.clientX)) {
      return
    }

    this.chrome.hideAll()
    this.currentBlock = null
  }

  private onHandleMouseEnter = (): void => {
    this.pointerInHandleOrMenu = true
  }

  private onHandleMouseLeave = (event: MouseEvent): void => {
    this.pointerInHandleOrMenu = false
    // If leaving handle but still horizontally in editor, keep visible
    if (this.currentBlock && this.isPointerInEditorHorizontally(event.clientX)) {
      return
    }
    // If menu is open, keep handle visible
    if (this.chrome.menu.style.display !== 'none') return
    this.chrome.hideAll()
    this.currentBlock = null
  }

  private onMenuMouseEnter = (): void => {
    this.pointerInHandleOrMenu = true
  }

  private onMenuMouseLeave = (event: MouseEvent): void => {
    this.pointerInHandleOrMenu = false
    // If leaving menu but still horizontally in editor, keep visible
    const refBlock = this.menuBlock ?? this.currentBlock
    if (refBlock && this.isPointerInEditorHorizontally(event.clientX)) {
      return
    }
    // If moving back to handle, keep visible
    const to = event.relatedTarget
    if (to instanceof Node && this.chrome.handle.contains(to)) {
      return
    }
    this.chrome.hideAll()
    this.currentBlock = null
    this.menuBlock = null
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
        this.view.dispatch({ changes: computeMinimalChange(text, next) })
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

  /**
   * 上移/下移 are the same swap from opposite sides: move this block before its
   * previous sibling, or move its next sibling before this block. Returning the
   * source unchanged signals "already at the edge".
   */
  private computeMove(text: string, block: Block, action: 'move-up' | 'move-down'): string {
    const blocks = getBlocks(this.view.state)
    const idx = blocks.findIndex((b) => b.from === block.from && b.to === block.to)
    if (idx < 0) return text
    const doc = this.view.state.doc
    if (action === 'move-up') {
      if (idx === 0) return text
      return computeBlockMove(text, block.from, block.to, doc.lineAt(blocks[idx - 1].from).number)
    }
    if (idx >= blocks.length - 1) return text
    const next = blocks[idx + 1]
    return computeBlockMove(text, next.from, next.to, doc.lineAt(block.from).number)
  }

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
    } else if (action === 'move-up' || action === 'move-down') {
      next = this.computeMove(text, block, action)
    }
    if (next !== text) {
      this.view.dispatch({ changes: computeMinimalChange(text, next) })
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
