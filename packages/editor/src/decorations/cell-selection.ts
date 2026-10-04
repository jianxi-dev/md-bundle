/**
 * View-level table-cell selection state (ticket #328 / change editor-fidelity 7.1).
 *
 * The table widget DOM is rebuilt by CM6 during mousedown capture (see the
 * `table.ts` header). A selection kept on the widget instance would be lost on
 * every rebuild. It is therefore stored per `EditorView` in a WeakMap — view
 * scope, not widget scope — and re-applied whenever a cell DOM is (re)built.
 *
 * A tiny per-view pub/sub keeps the selection-reactive consumers in sync
 * without dispatching a CM6 transaction: the drag handlers mutate this state on
 * raw DOM events, then `emit()` tells the painter and the cell toolbar to
 * re-read. This is deliberately dispatch-free — dispatching mid-drag would
 * rebuild the widget the pointer is dragging over.
 *
 * A selection is a rectangle: `anchor` is where the pointer went down, `head`
 * is the cell it is currently over. Rows use `-1` for the header row, matching
 * the `CellSpan` convention in `table.ts`.
 */
import type { EditorView } from '@codemirror/view';

/** Anchor + head cell of a rectangular cell selection. */
export interface CellSelection {
  /** Ordinal of the table within the document (from `findTables`). */
  readonly tableIndex: number;
  readonly anchorRow: number;
  readonly anchorCol: number;
  readonly headRow: number;
  readonly headCol: number;
}

/** Normalised bounding rectangle of a selection (inclusive on all sides). */
export interface CellRect {
  readonly minRow: number;
  readonly maxRow: number;
  readonly minCol: number;
  readonly maxCol: number;
}

const selections = new WeakMap<EditorView, CellSelection>();
const listeners = new WeakMap<EditorView, Set<() => void>>();

function sameSelection(a: CellSelection, b: CellSelection): boolean {
  return (
    a.tableIndex === b.tableIndex &&
    a.anchorRow === b.anchorRow &&
    a.anchorCol === b.anchorCol &&
    a.headRow === b.headRow &&
    a.headCol === b.headCol
  );
}

/** Current cell selection for a view, or null when none is active. */
export function getCellSelection(view: EditorView): CellSelection | null {
  return selections.get(view) ?? null;
}

/** Replace the selection and notify subscribers (no-op on an identical value). */
export function setCellSelection(view: EditorView, selection: CellSelection): void {
  const previous = selections.get(view);
  if (previous && sameSelection(previous, selection)) return;
  selections.set(view, selection);
  emit(view);
}

/** Drop the selection and notify subscribers (no-op when already empty). */
export function clearCellSelection(view: EditorView): void {
  if (!selections.has(view)) return;
  selections.delete(view);
  emit(view);
}

/** Subscribe to selection changes for one view; returns an unsubscribe fn. */
export function subscribeCellSelection(view: EditorView, cb: () => void): () => void {
  let set = listeners.get(view);
  if (!set) {
    set = new Set();
    listeners.set(view, set);
  }
  set.add(cb);
  return () => {
    set.delete(cb);
    if (set.size === 0) listeners.delete(view);
  };
}

function emit(view: EditorView): void {
  const set = listeners.get(view);
  if (!set) return;
  // Snapshot so a subscriber that unsubscribes mid-emit cannot skip a peer.
  for (const cb of [...set]) cb();
}

/** Normalise a selection into its inclusive bounding rectangle. */
export function cellRect(selection: CellSelection): CellRect {
  return {
    minRow: Math.min(selection.anchorRow, selection.headRow),
    maxRow: Math.max(selection.anchorRow, selection.headRow),
    minCol: Math.min(selection.anchorCol, selection.headCol),
    maxCol: Math.max(selection.anchorCol, selection.headCol),
  };
}

/** Number of cells covered by the selection (1 for a single cell). */
export function cellSelectionCount(selection: CellSelection): number {
  const rect = cellRect(selection);
  return (rect.maxRow - rect.minRow + 1) * (rect.maxCol - rect.minCol + 1);
}

/** Whether a (row, col) cell belongs to the selection's rectangle. */
export function isCellInSelection(
  selection: CellSelection,
  row: number,
  col: number,
): boolean {
  const rect = cellRect(selection);
  return row >= rect.minRow && row <= rect.maxRow && col >= rect.minCol && col <= rect.maxCol;
}
