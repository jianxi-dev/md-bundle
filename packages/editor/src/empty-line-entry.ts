/**
 * Empty line "+" entry CM6 extension — issue #275 task 2.3.
 *
 * Shows a floating "+" button in the left gutter when hovering an empty/whitespace-only line.
 * Clicking the button focuses the editor, places the caret at the line start, and opens the
 * slash insert menu via `insertSlashChar` (which inserts "/" and opens the menu).
 *
 * The button is positioned using the same coordinate recipe as `showHandleAt` in block-handle.ts:
 * - x: contentLeft - editorRect.left - 22 (gutter column)
 * - y: coordsAtPos(line.from).top - editorRect.top (line top)
 */
import type { Extension } from '@codemirror/state'
import { ViewPlugin, EditorView, type ViewUpdate } from '@codemirror/view'
import { insertSlashChar } from './slash'
import { renderIcon, ADD_ICON_NAME } from './icons'

const EMPTY_LINE_ADD_CLASS = 'mdb-empty-line-add'

/** Check if a line's text is empty or whitespace-only. */
export function isEmptyLine(text: string): boolean {
  return text.trim().length === 0
}

class EmptyLineEntryPlugin {
  private readonly view: EditorView
  private readonly button: HTMLButtonElement
  private currentLine: number | null = null
  private pointerInButton = false

  constructor(view: EditorView) {
    this.view = view

    // Ensure the editor root is a positioning context for absolute children.
    if (view.dom.style.position === '' || view.dom.style.position === 'static') {
      view.dom.style.position = 'relative'
    }

    this.button = document.createElement('button')
    this.button.type = 'button'
    this.button.className = EMPTY_LINE_ADD_CLASS
    this.button.setAttribute('data-testid', 'empty-line-add')
    this.button.setAttribute('data-icon', ADD_ICON_NAME)
    this.button.replaceChildren(renderIcon(ADD_ICON_NAME))
    this.button.style.display = 'none'
    this.button.title = '插入块'
    view.dom.appendChild(this.button)

    view.dom.addEventListener('mousemove', this.onMouseMove)
    view.dom.addEventListener('mouseleave', this.onMouseLeave)
    this.button.addEventListener('mousedown', this.onButtonMouseDown)
    this.button.addEventListener('click', this.onButtonClick)
    this.button.addEventListener('mouseenter', this.onButtonMouseEnter)
    this.button.addEventListener('mouseleave', this.onButtonMouseLeave)
  }

  update(update: ViewUpdate): void {
    // If the document changed, the line we were tracking may have shifted or disappeared.
    // Re-evaluate on next mousemove; for now just hide if the tracked line no longer exists
    // or is no longer empty.
    if (update.docChanged && this.currentLine !== null) {
      try {
        const line = update.state.doc.line(this.currentLine)
        if (!isEmptyLine(line.text)) {
          this.hide()
        }
      } catch {
        this.hide()
      }
    }
  }

  destroy(): void {
    this.view.dom.removeEventListener('mousemove', this.onMouseMove)
    this.view.dom.removeEventListener('mouseleave', this.onMouseLeave)
    this.button.removeEventListener('mousedown', this.onButtonMouseDown)
    this.button.removeEventListener('click', this.onButtonClick)
    this.button.removeEventListener('mouseenter', this.onButtonMouseEnter)
    this.button.removeEventListener('mouseleave', this.onButtonMouseLeave)
    this.button.remove()
  }

  private onMouseMove = (event: MouseEvent): void => {
    // If pointer is over our button, don't dismiss — the button mouseenter/leave handlers track this.
    if (this.pointerInButton) return

    const pos = this.view.posAtCoords({ x: event.clientX, y: event.clientY })
    if (pos === null) {
      // Pointer over empty area (e.g. blank line). Keep current button visible
      // as long as the pointer is horizontally within the editor bounds.
      if (this.currentLine !== null && this.isPointerInEditorHorizontally(event.clientX)) {
        return
      }
      this.hide()
      return
    }

    const line = this.view.state.doc.lineAt(pos)
    if (!isEmptyLine(line.text)) {
      // Hovering a non-empty line — always hide the button.
      this.hide()
      return
    }

    // Empty line hovered — show the button at this line.
    this.currentLine = line.number
    this.showAt(line.from)
  }

  private isPointerInEditorHorizontally(clientX: number): boolean {
    const contentRect = this.view.contentDOM.getBoundingClientRect()
    const buttonLeft = contentRect.left - 22
    const contentRight = contentRect.right
    return clientX >= buttonLeft && clientX <= contentRight
  }

  private onMouseLeave = (event: MouseEvent): void => {
    // If pointer is moving to our button, don't hide.
    const to = event.relatedTarget
    if (to instanceof Node && this.button.contains(to)) {
      return
    }

    // If pointer is still horizontally within editor bounds, keep button visible
    // (covers gap-crossing and empty-line traversal).
    if (this.currentLine !== null && this.isPointerInEditorHorizontally(event.clientX)) {
      return
    }

    this.hide()
  }

  private onButtonMouseEnter = (): void => {
    this.pointerInButton = true
  }

  private onButtonMouseLeave = (event: MouseEvent): void => {
    this.pointerInButton = false
    // If leaving button but still horizontally in editor, keep visible.
    if (this.currentLine !== null && this.isPointerInEditorHorizontally(event.clientX)) {
      return
    }
    this.hide()
  }

  private onButtonMouseDown = (event: MouseEvent): void => {
    // Prevent the editor from losing focus or selecting text.
    event.preventDefault()
    event.stopPropagation()
  }

  private onButtonClick = (): void => {
    if (this.currentLine === null) return

    const line = this.view.state.doc.line(this.currentLine)
    this.view.focus()
    // Place selection at the start of the empty line.
    this.view.dispatch({ selection: { anchor: line.from } })
    // Insert "/" and open the slash menu.
    insertSlashChar(this.view)
    // After click, the slash menu is open; hide our button.
    this.hide()
  }

  private showAt(pos: number): void {
    this.button.style.display = 'flex'
    try {
      const coords = this.view.coordsAtPos(pos)
      if (coords) {
        const r = this.view.dom.getBoundingClientRect()
        const contentLeft = this.view.contentDOM.getBoundingClientRect().left
        this.button.style.left = `${contentLeft - r.left - 22}px`
        this.button.style.top = `${coords.top - r.top}px`
      }
    } catch {
      // jsdom / unmeasured content — keep the default position.
    }
  }

  private hide(): void {
    this.button.style.display = 'none'
    this.currentLine = null
  }
}

export const emptyLineEntryTheme = EditorView.baseTheme({
  '.mdb-empty-line-add': {
    position: 'absolute',
    display: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '20px',
    cursor: 'pointer',
    color: 'var(--mdb-text-secondary)',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '4px',
    userSelect: 'none',
    zIndex: '5',
    fontSize: '14px',
    lineHeight: '1',
  },
  '.mdb-empty-line-add:hover': {
    backgroundColor: 'rgba(127, 127, 127, 0.18)',
  },
})

/**
 * CM6 extension that adds the empty-line "+" entry button.
 * Works alongside `blockHandle()` — the block handle hides on empty lines (no block),
 * so the two affordances don't visually collide.
 */
export function emptyLineEntry(): Extension {
  return [ViewPlugin.fromClass(EmptyLineEntryPlugin), emptyLineEntryTheme]
}
