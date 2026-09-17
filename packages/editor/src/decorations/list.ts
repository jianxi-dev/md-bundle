import type { Range } from '@codemirror/state';
import { Decoration } from '@codemirror/view';

const unorderedListRegex = /^[-*+]\s/m;
const orderedListRegex = /^\d+\.\s/m;
const taskListRegex = /^- \[[ xX]\]\s/m;

const LIST_CLASS = 'cm-list';
const TASK_DONE_CLASS = 'cm-task-done';
const TASK_PENDING_CLASS = 'cm-task-pending';

/**
 * Create list decorations for the document.
 *
 * Non-active blocks: bullet/checkbox hidden, rendered with theme-colored
 * bullet via CSS ::before pseudo-element.
 * Active blocks: bullet + faint marker prefix shown at low opacity for
 * structural awareness.
 *
 * @param text - Full document text.
 * @param activeFrom - Start offset of the active block (or -1 if none).
 * @param activeTo - End offset of the active block (or -1 if none).
 */
export function createListDecorations(
  text: string,
  activeFrom: number = -1,
  activeTo: number = -1,
): Range<Decoration>[] {
  const decorations: Range<Decoration>[] = [];
  const lines = text.split('\n');

  let pos = 0;
  for (const line of lines) {
    const lineLen = line.length + 1; // +1 for \n
    const lineStart = pos;
    const lineEnd = pos + line.length;
    const isActive = activeFrom >= 0 && lineStart >= activeFrom && lineEnd <= activeTo;

    if (taskListRegex.test(line)) {
      const match = line.match(/^- \[[ xX]\]\s/);
      const markerLen = match ? match[0].length : 0;
      const isDone = /^- \[[xX]\]/.test(line);
      const lineClasses = `${LIST_CLASS} ${isDone ? TASK_DONE_CLASS : TASK_PENDING_CLASS} ${isActive ? 'cm-block-active' : 'cm-block-inactive'}`;

      // In active blocks, show the marker at low opacity instead of hiding.
      if (markerLen > 0) {
        if (isActive) {
          // Mark the marker range with a faint class for low-opacity display.
          decorations.push(
            Decoration.mark({ class: 'cm-list-marker-active' }).range(pos, pos + markerLen),
          );
        } else {
          decorations.push(Decoration.replace({}).range(pos, pos + markerLen));
        }
      }
      decorations.push(Decoration.line({ class: lineClasses }).range(pos));
    } else if (unorderedListRegex.test(line)) {
      const match = line.match(unorderedListRegex);
      const markerLen = match ? match[0].length : 0;
      if (markerLen > 0) {
        if (isActive) {
          decorations.push(
            Decoration.mark({ class: 'cm-list-marker-active' }).range(pos, pos + markerLen),
          );
        } else {
          decorations.push(Decoration.replace({}).range(pos, pos + markerLen));
        }
      }
      decorations.push(Decoration.line({ class: `${LIST_CLASS} ${isActive ? 'cm-block-active' : 'cm-block-inactive'}` }).range(pos));
    } else if (orderedListRegex.test(line)) {
      const match = line.match(orderedListRegex);
      const markerLen = match ? match[0].length : 0;
      if (markerLen > 0) {
        if (isActive) {
          decorations.push(
            Decoration.mark({ class: 'cm-list-marker-active' }).range(pos, pos + markerLen),
          );
        } else {
          decorations.push(Decoration.replace({}).range(pos, pos + markerLen));
        }
      }
      decorations.push(Decoration.line({ class: `${LIST_CLASS} ${isActive ? 'cm-block-active' : 'cm-block-inactive'}` }).range(pos));
    }

    pos += lineLen;
  }

  return decorations;
}
