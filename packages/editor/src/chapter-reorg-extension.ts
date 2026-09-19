/**
 * Chapter reorganization — shared drag state.
 *
 * Historically this module owned the mouse handlers for section drag-and-drop.
 * Issue #189 moved every drag interaction to the gutter block handle
 * (`block-handle.ts`), which is now the single drag entry point. The old
 * `dragHandlers` are gone: an ordinary mousedown inside document content must
 * stay untouched (that regression is issue #188 — reacting to any mousedown
 * dispatched a drag effect and called `preventDefault()`, so CM6 never focused
 * and the editor became uneditable).
 *
 * What remains is the state this drag still needs: the active `DragState`
 * held in a StateField that the block handle reads and writes. Section math
 * itself lives in `chapter-tree.ts`.
 */
import type { EditorState, Extension } from '@codemirror/state';
import { StateField, StateEffect } from '@codemirror/state';

/**
 * An ongoing block drag.
 * `from`/`to` are the document offsets of the dragged block (the cut range);
 * `targetLine` is the 1-based line number the block would be inserted before.
 */
export interface DragState {
  readonly from: number;
  readonly to: number;
  readonly targetLine: number;
}

/**
 * Effect that sets (or clears, with null) the active drag state.
 * Dispatched by the block handle; carries no document change, so it never
 * creates an undo step on its own.
 */
export const setDragEffect = StateEffect.define<DragState | null>();

/**
 * Holds the active drag, or null when nothing is being dragged.
 * It also clears itself on any document change, so a dropped/reordered
 * document can never leave a stale drag range behind.
 */
const dragField = StateField.define<DragState | null>({
  create() {
    return null;
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setDragEffect)) return effect.value;
    }
    if (tr.docChanged) return null;
    return value;
  },
});

/** Read the active drag, or null when no drag state field is installed. */
export function currentDrag(state: EditorState): DragState | null {
  return state.field(dragField, false) ?? null;
}

/**
 * CM6 extension providing the drag state field.
 * Install alongside `blockHandle()`; the handle drives the field.
 */
export function chapterReorgExtension(): Extension {
  return [dragField];
}
