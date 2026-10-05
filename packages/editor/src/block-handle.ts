/**
 * Block handle CM6 extension — issue #189: hover shows a `⠿` gutter handle,
 * click opens a 转换为 / 复制块 / 删除块 menu, and drag reorders the block with a
 * blue insertion line (one undoable transaction). Escape, scroll, and view
 * destroy all remove the DOM.
 *
 * Issue #325 adds the hover-driven selection: the block under the pointer is
 * marked through `selectedBlockField` and never enters the undo history, so
 * reaching for a handle cannot create an undo step. `dismiss()` is the single
 * exit for every interaction that ends a hover, which is what keeps the chrome
 * and the selection from drifting apart.
 *
 * Layout comes from `view.coordsAtPos` (jsdom degrades silently to an unplaced
 * element). Block boundaries come from `block-model.ts`; the pure math lives in
 * `block-handle-ops.ts` (re-exported as the single import surface). Drag state
 * lives in `chapter-reorg-extension.ts`, installed alongside this extension.
 */
import {
  StateEffect,
  StateField,
  Transaction,
  type EditorState,
  type Extension,
} from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import { getBlocks, type Block } from './block-model'
import { currentDrag, setDragEffect } from './chapter-reorg-extension'
import { commandRegistry, toggleBlockAlignment } from './commands'
import {
  HandleChrome,
  blockHandleTheme,
  ITEM_CLASS,
  GRID_ITEM_CLASS,
  FLYOUT_ITEM_CLASS,
  FLYOUT_ACTION_ATTR,
  FLYOUT_ATTR,
} from './block-handle-dom'
import { defaultCommands, openInsertMenu, releaseInsertMenu } from './slash'
import {
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
  isBlockInViewport,
  blockHandleIcon,
  computeGutterLeft,
  type BlockConvertTarget,
} from './block-handle-ops'
import { getBlockAt } from './block-model'

export {
  findBlockAt,
  computeBlockMove,
  computeBlockConvert,
  computeBlockDuplicate,
  computeBlockDelete,
  computeMinimalChange,
  computeBlockIndent,
  computeCalloutType,
  isCalloutBlock,
  blockStillExists,
  isBlockInViewport,
  blockHandleIcon,
  type BlockConvertTarget,
} from './block-handle-ops'

// Re-export new turn-into symbols (not used directly in this file)
export {
  computeBlockTurnInto,
  type BlockTurnIntoTarget,
  type MinimalChange,
} from './block-handle-ops'

/** Pointer travel (px) before a press becomes a drag rather than a click. */
const DRAG_THRESHOLD_SQ = 16

/** Width (px) of the gutter corridor between the handle and its menu (#325). */
const GUTTER_GAP = 8

/** Selected-block range effect — issue #325. */
export const setSelectedBlockEffect = StateEffect.define<{ from: number; to: number } | null>()

/**
 * The current block occupying `[from, to)` exactly, or null when those
 * boundaries are not a block. Single identity rule shared by the selection
 * field and the handle chrome: exact boundaries decide whether a selection
 * survives, and the returned descriptor carries the live `type` so the icon
 * and menu target stay current after a reclassification.
 */
function blockAtExactRange(state: EditorState, from: number, to: number): Block | null {
  return getBlocks(state).find((block) => block.from === from && block.to === to) ?? null
}

/** Selected block range or null; hover-driven, so kept out of undo history. */
export const selectedBlockField = StateField.define<{ from: number; to: number } | null>({
  create: () => null,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (!effect.is(setSelectedBlockEffect)) continue
      if (effect.value === null) return null
      const len = tr.state.doc.length
      // Clamp then remap: a stale range must stay in-doc and follow the text.
      const from = Math.min(effect.value.from, len)
      const to = Math.min(effect.value.to, len)
      if (from > to) return null
      return { from: tr.changes.mapPos(from, -1), to: tr.changes.mapPos(to, -1) }
    }
    if (!tr.docChanged) return value
    if (value === null) return null
    const len = tr.state.doc.length
    const from = Math.min(value.from, len)
    const to = Math.min(value.to, len)
    if (from > to) return null
    const mapped = { from: tr.changes.mapPos(from, -1), to: tr.changes.mapPos(to, -1) }
    // Surviving the mapping is not enough: converting `## h` to a paragraph keeps
    // from/to but changes the block, so the range must still land on boundaries.
    if (blockAtExactRange(tr.state, mapped.from, mapped.to) === null) return null
    return mapped
  },
  provide: (f) =>
    EditorView.decorations.compute([f], (state) => {
      const value = state.field(f)
      if (value === null) return Decoration.none
      const { from, to } = value
      if (from >= to) return Decoration.none
      const marks = []
      for (let n = state.doc.lineAt(from).number; n <= state.doc.lineAt(to).number; n++) {
        marks.push(Decoration.line({ class: 'cm-block-selected' }).range(state.doc.line(n).from))
      }
      return Decoration.set(marks)
    }),
})

const CONVERT_TARGETS: readonly BlockConvertTarget[] = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'paragraph',
]

const TURN_INTO_TARGETS: readonly BlockConvertTarget[] = [
  'ordered',
  'bullet',
  'todo',
  'code',
  'quote',
  'callout',
]

const isConvertTarget = (value: string | null): value is BlockConvertTarget =>
  value !== null && (CONVERT_TARGETS as readonly string[]).includes(value)

const isTurnIntoTarget = (value: string | null): value is BlockConvertTarget =>
  value !== null && (TURN_INTO_TARGETS as readonly string[]).includes(value)

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

  /**
   * Publish or clear the hover-driven selection. `addToHistory: false` keeps
   * selection out of undo history — it is a hover affordance, not an edit.
   * Re-dispatching the current range is skipped so pointer movement inside one
   * block does not churn the transaction log.
   */
  private setSelected(range: { from: number; to: number } | null): void {
    const current = this.view.state.field(selectedBlockField, false) ?? null
    const unchanged =
      range === null ? current === null : current !== null && current.from === range.from && current.to === range.to
    if (unchanged) return
    this.view.dispatch({
      effects: setSelectedBlockEffect.of(range),
      annotations: Transaction.addToHistory.of(false),
    })
  }

  /** Drop the chrome and tracked blocks without touching the selection field. */
  private clearChrome(): void {
    this.chrome.hideAll()
    this.currentBlock = null
    this.menuBlock = null
  }

  /**
   * The single dismissal path: drop the chrome, the tracked blocks and the
   * selection together. Escape, outside mousedown and leaving the editor all
   * funnel through here so no transition can leave a selected block stranded
   * without its handle.
   *
   * Never call this from `update()`: CM6 forbids dispatching while an update is
   * in progress. Document edits reach `clearChrome()` instead, because
   * `selectedBlockField` already invalidated the stale range in that same
   * transaction.
   */
  private dismiss(): void {
    this.clearChrome()
    this.setSelected(null)
  }

  /** Escape must close the widget no matter where focus currently is. */
  private readonly onEscape = (): void => this.dismiss()

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
    this.chrome.menu.addEventListener('mouseover', this.onMenuHoverInsert)
    this.chrome.menu.addEventListener('mouseleave', this.onMenuLeaveInsert)
    // The menu has no mouseleave listener on purpose: sliding off the menu onto
    // editor content is a retarget, not a dismissal. `onMouseMove` resolves the
    // block under the pointer and re-anchors the open menu, while `view.dom`'s
    // mouseleave listener dismisses once the pointer leaves the editor entirely.
    // A menu that tore itself down here would drop the retarget selection the
    // pointer had just made (#325).
  }

  // Called by ViewPlugin after each scroll — viewport is guaranteed updated.
  scroll(): void {
    if (!this.currentBlock) return
    if (isBlockInViewport(this.view, this.currentBlock)) {
      this.showHandleAt(this.currentBlock.from)
    } else {
      // Scrolled out of view: the handle cannot stay anchored to a block the
      // user can no longer see, so the selection goes with it (#325).
      this.dismiss()
    }
  }

  update(update: ViewUpdate): void {
    if (!update.docChanged) return

    // Drag abort must ALWAYS run on doc change, regardless of handle state.
    if (currentDrag(update.state)) this.endDrag()

    // Re-anchor on the selection's live block. `selectedBlockField` already
    // remapped or invalidated its range in this transaction, so the chrome
    // follows that verdict instead of holding an older descriptor: the type
    // can change under unchanged boundaries (task/list reclassification) and
    // must still refresh the icon and menu target (#325).
    const range = update.state.field(selectedBlockField, false) ?? null
    const block = range === null ? null : blockAtExactRange(update.state, range.from, range.to)
    if (block) {
      this.currentBlock = block
      this.showHandleAt(block.from)
    } else {
      this.clearChrome()
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
    this.chrome.menu.removeEventListener('mouseover', this.onMenuHoverInsert)
    this.chrome.menu.removeEventListener('mouseleave', this.onMenuLeaveInsert)
    this.removeDocumentListeners()
    this.setSelected(null)
    this.chrome.unmount()
  }

  // --- Positioning -----------------------------------------------------------

  private showHandleAt(from: number): void {
    this.chrome.showHandle()
    const block = findBlockAt(this.view.state, from)
    if (block) {
      const blockText = this.view.state.doc.sliceString(block.from, block.to)
      // Get the line text at the handle position for table line detection
      const line = this.view.state.doc.lineAt(from)
      const lineText = line.text
      this.chrome.setIcon(blockHandleIcon(block, blockText, lineText))
    }
    try {
      const coords = this.view.coordsAtPos(from)
      if (coords) {
        const gutterLeft = computeGutterLeft(this.view)
        this.chrome.handle.style.left = `${gutterLeft}px`
        this.chrome.handle.style.top = `${coords.top - this.view.dom.getBoundingClientRect().top}px`
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
    const block = this.menuBlock ?? this.currentBlock
    if (block) {
      try {
        const coords = this.view.coordsAtPos(block.from)
        if (coords) {
          this.chrome.menu.style.top = `${coords.top - r.top}px`
        } else {
          this.chrome.menu.style.top = `${rect.top - r.top}px`
        }
      } catch {
        this.chrome.menu.style.top = `${rect.top - r.top}px`
      }
    } else {
      this.chrome.menu.style.top = `${rect.top - r.top}px`
    }
    const text = block ? this.view.state.doc.sliceString(block.from, block.to) : ''
    this.chrome.setCalloutContext(block !== null && isCalloutBlock(text))
    this.chrome.setTableContext(block !== null && block.type === 'table')
    this.chrome.showMenu()
  }

  // --- Hover -----------------------------------------------------------------

  private onMouseMove = (event: MouseEvent): void => {
    if (currentDrag(this.view.state) || this.moved) return

    // Events from the handle or the menu arrive here by bubbling. They must not
    // resolve a block — there is no content under the chrome — but they are
    // proof the pointer is on our UI, so the dimmed state is always lifted.
    const target = event.target
    if (target instanceof Node && (this.chrome.handle.contains(target) || this.chrome.menu.contains(target))) {
      this.chrome.setDimmed(false)
      return
    }

    const menuOpen = this.chrome.isMenuOpen()
    if (menuOpen) {
      // The corridor between handle and menu is gutter, not content, so
      // posAtCoords has no meaningful answer there. Dim to mark the crossing
      // while keeping the menu reachable.
      const handleRect = this.chrome.handle.getBoundingClientRect()
      if (event.clientX >= handleRect.right && event.clientX < handleRect.right + GUTTER_GAP) {
        this.chrome.setDimmed(true)
        return
      }
    }

    const pos = this.view.posAtCoords({ x: event.clientX, y: event.clientY })
    const block = pos === null ? null : findBlockAt(this.view.state, pos)
    if (pos === null || !block) {
      // Off-content while the menu is open: the pointer can still be inside the
      // editor (gutter corridor, padding below the last line), so dim instead of
      // tearing the menu down. Reaching the app toolbar means leaving.
      if (menuOpen && this.isPointerInsideEditor(event)) {
        this.chrome.setDimmed(true)
        return
      }
      // With no menu, the handle survives travel through the editor's own
      // vertical space — the "sticky bridge" across blank lines.
      if (!menuOpen && this.currentBlock && this.isPointerInEditorHorizontally(event.clientX)) return
      this.dismiss()
      return
    }

    this.chrome.setDimmed(false)
    this.currentBlock = block
    this.setSelected({ from: block.from, to: block.to })
    this.showHandleAt(block.from)
    if (menuOpen && this.menuBlock?.from !== block.from) {
      this.menuBlock = block
      this.openMenu()
    }
  }

  private isPointerInEditorHorizontally(clientX: number): boolean {
    const contentRect = this.view.contentDOM.getBoundingClientRect()
    const handleLeft = contentRect.left - 22
    const contentRight = contentRect.right
    return clientX >= handleLeft && clientX <= contentRight
  }

  private onMouseLeave = (event: MouseEvent): void => {
    if (currentDrag(this.view.state)) return

    // Moving the pointer from the gutter handle or its menu back into the
    // editor must not tear the chrome down; the mousemove handler picks the new
    // target up on the next event.
    const to = event.relatedTarget
    if (to instanceof Node && (this.chrome.handle.contains(to) || this.chrome.menu.contains(to))) {
      return
    }

    if (this.isPointerInsideEditor(event)) return

    this.dismiss()
  }

  private isPointerInsideEditor(event: MouseEvent): boolean {
    const target = event.target
    if (target instanceof Node && this.view.contentDOM.contains(target)) return true
    // Off-content (gutter, padding, the handle's own column): treat the left
    // half of the editor root as "still in the editor" so the handle survives
    // travel through its own vertical space. Anchored to the editor rect, not
    // window.innerWidth — the editor does not necessarily own the left half of
    // the viewport. Both axes matter: leaving vertically (past the top into a
    // toolbar, or below into a footer) is a dismissal, not a gutter crossing.
    const rect = this.view.dom.getBoundingClientRect()
    return (
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom &&
      event.clientX < rect.left + (rect.right - rect.left) / 2
    )
  }

  // Hovering the handle opens the menu; arriving while it is already open
  // retargets the menu to that block rather than closing and reopening it.
  private onHandleMouseEnter = (): void => {
    if (!this.chrome.isMenuOpen()) {
      if (this.currentBlock) {
        this.menuBlock = this.currentBlock
        this.openMenu()
      }
      return
    }
    const rect = this.chrome.handle.getBoundingClientRect()
    const pos = this.view.posAtCoords({ x: rect.left + 2, y: rect.top + 2 })
    const block = pos === null ? null : findBlockAt(this.view.state, pos)
    if (!block) return
    this.currentBlock = block
    this.menuBlock = block
    this.setSelected({ from: block.from, to: block.to })
    this.showHandleAt(block.from)
    this.openMenu()
  }

  private onHandleMouseLeave = (): void => {
    if (this.chrome.isMenuOpen()) return
    this.dismiss()
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

  /**
   * Hovering 在下方添加› opens the shared insert menu anchored at the block's
   * end. Delegated from the menu root: the row is a button, so a direct
   * listener would not survive the flyout rebuild. The `.mdb-slash-menu`
   * guard stops the delegated mouseover (which also fires for child nodes)
   * from reopening the panel on every event.
   */
  private onMenuHoverInsert = (event: MouseEvent): void => {
    const target = event.target
    if (!(target instanceof Element)) return
    const row = target.closest<HTMLElement>(`[${FLYOUT_ATTR}="insert-menu"]`)
    if (!row || !this.chrome.menu.contains(row)) return
    const block = this.menuBlock ?? this.currentBlock
    if (!block) return
    if (this.view.dom.querySelector('.mdb-slash-menu')) return
    openInsertMenu(this.view, block.to, defaultCommands, { from: block.to, to: block.to }, 'below')
  }

  /**
   * The below menu is opened by hovering a block-handle row, so it has no
   * pointer of its own until the user moves onto it. Releasing it when the
   * pointer leaves the block-handle chrome (and did not transfer onto the menu)
   * closes the panel the hover opened, which the menu's own mouseleave cannot
   * do because it never fired.
   */
  private readonly onMenuLeaveInsert = (event: MouseEvent): void => {
    const to = event.relatedTarget
    if (
      to instanceof Element &&
      (this.chrome.menu.contains(to) || to.closest('.mdb-slash-menu') !== null)
    ) {
      return
    }
    releaseInsertMenu(this.view)
  }

  private onMenuClick = (event: MouseEvent): void => {
    const from = event.target
    if (!(from instanceof Element) || !this.menuBlock) return
    const item = from.closest(`.${ITEM_CLASS}, .${GRID_ITEM_CLASS}, .${FLYOUT_ITEM_CLASS}`)
    if (!item) return

    const block = this.menuBlock
    const flyoutAction = item.getAttribute(FLYOUT_ACTION_ATTR)
    if (flyoutAction !== null) {
      this.applyFlyoutAction(block, flyoutAction)
      this.chrome.hideMenu()
      this.setSelected(null)
      event.stopPropagation()
      return
    }

    const text = this.view.state.doc.toString()
    const convert = item.getAttribute('data-convert')
    const action = item.getAttribute('data-action')
    let next = text
    if (isConvertTarget(convert)) {
      next = computeBlockConvert(text, block.from, block.to, convert)
    } else if (isTurnIntoTarget(convert)) {
      next = computeBlockTurnInto(text, block.from, block.to, convert)
    } else if (action === 'duplicate') {
      next = computeBlockDuplicate(text, block.from, block.to)
    } else if (action === 'delete') {
      next = computeBlockDelete(text, block.from, block.to)
    } else if (action === 'move-up' || action === 'move-down') {
      next = this.computeMove(text, block, action)
    } else if (action === 'toggle-header-row' || action === 'toggle-header-col' || action === 'distribute-columns') {
      this.handleTableAction(block, action)
      this.chrome.hideMenu()
      this.setSelected(null)
      event.stopPropagation()
      return
    } else if (action === 'synced-block') {
      this.chrome.hideMenu()
      this.setSelected(null)
      event.stopPropagation()
      return
    } else if (action === 'comment' || action === 'cut' || action === 'translate' || action === 'share' || action === 'copy-link' || action === 'add-below') {
      this.chrome.hideMenu()
      this.setSelected(null)
      event.stopPropagation()
      return
    }
    if (next !== text) {
      this.view.dispatch({ changes: computeMinimalChange(text, next) })
    }
    this.chrome.hideMenu()
    // Cleared after the action's own change so the null maps against the same
    // document the action produced.
    this.setSelected(null)
    event.stopPropagation()
  }

  private handleTableAction(_block: Block, action: string): void {
    const { state } = this.view
    const { main } = state.selection
    const pos = main.empty ? main.head : main.from
    const blocks = getBlocks(state)
    const tableBlock = getBlockAt(pos, blocks)
    if (!tableBlock || tableBlock.type !== 'table') return

    const docText = state.doc.toString()
    const tableText = docText.slice(tableBlock.from, tableBlock.to)
    let nextText = tableText

    if (action === 'toggle-header-row') {
      const lines = tableText.split('\n')
      const hasHeaderSep = lines[1]?.match(/^\s*\|(\s*:?-+:?\s*\|)+\s*$/)
      if (hasHeaderSep) {
        lines.splice(1, 1)
      } else {
        const firstRow = lines[0]
        const colCount = (firstRow.match(/\|/g) || []).length - 1
        const sepRow = '|' + ' --- |'.repeat(colCount)
        lines.splice(1, 0, sepRow)
      }
      nextText = lines.join('\n')
    } else if (action === 'toggle-header-col') {
      const lines = tableText.split('\n')
      const hasHeaderCol = lines[0]?.startsWith('| ')
      if (hasHeaderCol) {
        nextText = lines.map(l => l.replace(/^\|\s+/, '|')).join('\n')
      } else {
        nextText = lines.map(l => l.replace(/^\|/, '| ')).join('\n')
      }
    } else if (action === 'distribute-columns') {
      return
    }

    if (nextText !== tableText) {
      const change = computeMinimalChange(docText, docText.slice(0, tableBlock.from) + nextText + docText.slice(tableBlock.to))
      this.view.dispatch({ changes: change })
    }
  }

  /** Apply a flyout option (align / indent / color / callout type) to the block. */
  private applyFlyoutAction(block: Block, action: string): void {
    if (action.startsWith('align-')) {
      const alignment = action.slice('align-'.length)
      if (alignment === 'left' || alignment === 'center' || alignment === 'right') {
        toggleBlockAlignment(this.view, alignment)
      }
      return
    }
    if (action === 'indent-increase' || action === 'indent-decrease') {
      const text = this.view.state.doc.toString()
      const next = computeBlockIndent(
        text,
        block.from,
        block.to,
        action === 'indent-increase' ? 'increase' : 'decrease',
      )
      if (next !== text) this.view.dispatch({ changes: computeMinimalChange(text, next) })
      return
    }
    if (action.startsWith('color-')) {
      // Color commands operate on the selection, so cover the whole block first.
      this.view.dispatch({ selection: { anchor: block.from, head: block.to } })
      commandRegistry.execute(action, this.view)
      return
    }
    if (action.startsWith('callout-')) {
      const type = action.slice('callout-'.length)
      const text = this.view.state.doc.toString()
      const blockText = text.slice(block.from, block.to)
      const nextText = computeCalloutType(blockText, type)
      if (nextText !== blockText) {
        this.view.dispatch({ changes: { from: block.from, to: block.to, insert: nextText } })
      }
    }
  }
}

// --- Extension ---------------------------------------------------------------

/**
 * CM6 extension that adds the gutter block handle, its menu, and drag reorder.
 * Requires `chapterReorgExtension()` in the same extension set for drag state.
 */
export function blockHandle(): Extension {
  return [selectedBlockField, ViewPlugin.fromClass(BlockHandlePlugin), blockHandleTheme]
}
