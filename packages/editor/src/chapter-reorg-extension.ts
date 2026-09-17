/**
 * Chapter reorganization CM6 extension — drag-to-reorder document sections.
 *
 * Provides mouse-based drag-and-drop for document headings:
 * - Press on a heading line to start dragging its entire section
 * - Release on a target heading to move the dragged section there
 * - The move is dispatched as a single undoable transaction
 *
 * The extension uses CM6's DOMEventHandlers to track mouse events and
 * a StateField to hold the current drag state. On drop, it calls
 * moveSection() from chapter-tree.ts to compute the new document.
 */
import type { Extension } from '@codemirror/state';
import { StateField, StateEffect } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { getHeadings, computeSections, moveSection } from './chapter-tree';

// --- Drag state ----------------------------------------------------------------

/**
 * Represents an ongoing drag operation.
 * `sectionIndex` is the index of the section being dragged.
 * `targetIndex` is the index where the section will be inserted.
 */
export interface DragState {
  readonly sectionIndex: number;
  readonly targetIndex: number;
}

/**
 * StateField that holds the current drag state (null = not dragging).
 */
const dragField = StateField.define<DragState | null>({
  create() {
    return null;
  },
  update(value, tr) {
    // Check for our custom effect.
    for (const effect of tr.effects) {
      if (effect.is(setDragEffect)) {
        return effect.value;
      }
    }
    // Clear drag state on any document change (the move was applied).
    if (tr.docChanged) return null;
    return value;
  },
});

/**
 * Effect to set the drag state (used by mouse handlers).
 */
const setDragEffect = StateEffect.define<DragState | null>();

// --- Helpers -------------------------------------------------------------------

/**
 * Find the section index for a given document position.
 * Returns the section whose range contains the position.
 */
function sectionAtPos(
  sections: { from: number; to: number }[],
  pos: number,
): number {
  for (let i = 0; i < sections.length; i++) {
    if (pos >= sections[i].from && pos < sections[i].to) {
      return i;
    }
  }
  return -1;
}

/**
 * Find the heading index for a given document position.
 * Returns the index of the heading that starts at or after the position.
 */
function headingIndexAtPos(
  headings: { from: number }[],
  pos: number,
): number {
  for (let i = 0; i < headings.length; i++) {
    if (headings[i].from >= pos) {
      return i;
    }
  }
  return headings.length;
}

// --- Mouse handlers ----------------------------------------------------------

/**
 * Mouse event handlers for drag-to-reorder.
 */
const dragHandlers = EditorView.domEventHandlers({
  mousedown(event, view) {
    // Only handle left-click.
    if (event.button !== 0) return false;

    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    if (pos === null) return false;

    const headings = getHeadings(view.state);
    const sections = computeSections(headings, view.state.doc.length);
    const sectionIdx = sectionAtPos(sections, pos);

    if (sectionIdx < 0) return false;

    // Start dragging.
    const drag: DragState = { sectionIndex: sectionIdx, targetIndex: sectionIdx };
    view.dispatch({ effects: setDragEffect.of(drag) });

    // Prevent text selection during drag.
    event.preventDefault();
    return true;
  },

  mousemove(event, view) {
    const drag = view.state.field(dragField);
    if (!drag) return false;

    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    if (pos === null) return false;

    const headings = getHeadings(view.state);
    const targetIdx = headingIndexAtPos(headings, pos);

    // Update the drag state with the new target.
    if (targetIdx !== drag.targetIndex) {
      view.dispatch({
        effects: setDragEffect.of({ ...drag, targetIndex: targetIdx }),
      });
    }
    return true;
  },

  mouseup(event, view) {
    const drag = view.state.field(dragField);
    if (!drag) return false;

    // If the target is different from the source, perform the move.
    if (drag.targetIndex !== drag.sectionIndex && drag.targetIndex >= 0) {
      const state = view.state;
      const headings = getHeadings(state);
      const sections = computeSections(headings, state.doc.length);

      if (drag.sectionIndex < sections.length) {
        const result = moveSection(
          state.doc.toString(),
          sections,
          drag.sectionIndex,
          drag.targetIndex,
        );

        if (result.newText !== state.doc.toString()) {
          view.dispatch({
            changes: {
              from: 0,
              to: state.doc.length,
              insert: result.newText,
            },
          });
        }
      }
    }

    // Clear drag state.
    view.dispatch({ effects: setDragEffect.of(null) });
    event.preventDefault();
    return true;
  },
});

// --- Extension -----------------------------------------------------------------

/**
 * CM6 extension that enables drag-to-reorder for document sections.
 *
 * @returns CM6 Extension for use with createMarkdownEditor.
 */
export function chapterReorgExtension(): Extension {
  return [dragField, dragHandlers];
}
