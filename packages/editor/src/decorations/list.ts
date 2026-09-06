import type { Range } from '@codemirror/state';
import { Decoration } from '@codemirror/view';

const unorderedListRegex = /^[-*+]\s/m;
const orderedListRegex = /^\d+\.\s/m;
const taskListRegex = /^- \[[ xX]\]\s/m;

const LIST_CLASS = 'cm-list';
const TASK_DONE_CLASS = 'cm-task-done';
const TASK_PENDING_CLASS = 'cm-task-pending';

export function createListDecorations(text: string): Range<Decoration>[] {
  const decorations: Range<Decoration>[] = [];
  const lines = text.split('\n');

  let pos = 0;
  for (const line of lines) {
    const lineLen = line.length + 1; // +1 for \n

    if (taskListRegex.test(line)) {
      const match = line.match(/^- \[[ xX]\]\s/);
      const markerLen = match ? match[0].length : 0;
      const isDone = /^- \[[xX]\]/.test(line);
      const lineClasses = `${LIST_CLASS} ${isDone ? TASK_DONE_CLASS : TASK_PENDING_CLASS}`;

      // Hide marker + checkbox, apply line style
      if (markerLen > 0) {
        decorations.push(Decoration.replace({}).range(pos, pos + markerLen));
      }
      decorations.push(Decoration.line({ class: lineClasses }).range(pos));
    } else if (unorderedListRegex.test(line)) {
      const match = line.match(unorderedListRegex);
      const markerLen = match ? match[0].length : 0;
      if (markerLen > 0) {
        decorations.push(Decoration.replace({}).range(pos, pos + markerLen));
      }
      decorations.push(Decoration.line({ class: LIST_CLASS }).range(pos));
    } else if (orderedListRegex.test(line)) {
      const match = line.match(orderedListRegex);
      const markerLen = match ? match[0].length : 0;
      if (markerLen > 0) {
        decorations.push(Decoration.replace({}).range(pos, pos + markerLen));
      }
      decorations.push(Decoration.line({ class: LIST_CLASS }).range(pos));
    }

    pos += lineLen;
  }

  return decorations;
}
