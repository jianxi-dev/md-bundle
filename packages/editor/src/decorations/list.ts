import type { Range } from '@codemirror/state';
import { Decoration, WidgetType, type EditorView } from '@codemirror/view';

const unorderedListRegex = /^[-*+]\s/m;
const orderedListRegex = /^\d+\.\s/m;
const taskListRegex = /^- \[[ xX]\]\s/m;

const LIST_CLASS = 'cm-list';
const LIST_ORDERED_CLASS = 'cm-list-ordered';
const LIST_MARKER_CLASS = 'cm-list-marker';
const TASK_DONE_CLASS = 'cm-task-done';
const TASK_PENDING_CLASS = 'cm-task-pending';

/**
 * Clickable checkbox that replaces the `- [ ] ` / `- [x] ` task marker.
 * Toggling writes `[ ]` / `[x]` back to the source at the bracket offset.
 */
class TaskCheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly bracketFrom: number,
  ) {
    super();
  }

  toDOM(view?: EditorView): HTMLElement {
    const box = document.createElement('span');
    box.className = 'cm-task-checkbox';
    box.setAttribute('role', 'checkbox');
    box.setAttribute('aria-checked', String(this.checked));
    box.setAttribute('data-testid', 'task-checkbox');
    if (this.checked) box.setAttribute('data-checked', 'true');
    box.title = this.checked ? '标记为未完成' : '标记为已完成';
    box.addEventListener('mousedown', (event) => {
      if (!view) return;
      event.preventDefault();
      event.stopPropagation();
      view.dispatch({
        changes: {
          from: this.bracketFrom,
          to: this.bracketFrom + 3,
          insert: this.checked ? '[ ]' : '[x]',
        },
      });
      view.focus();
    });
    return box;
  }

  eq(other: TaskCheckboxWidget): boolean {
    return this.checked === other.checked && this.bracketFrom === other.bracketFrom;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

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

      if (markerLen > 0) {
        const bracketFrom = pos + line.indexOf('[');
        decorations.push(
          Decoration.replace({ widget: new TaskCheckboxWidget(isDone, bracketFrom) }).range(
            pos,
            pos + markerLen,
          ),
        );
      }
      decorations.push(Decoration.line({ class: lineClasses }).range(pos));
    } else if (unorderedListRegex.test(line)) {
      const match = line.match(unorderedListRegex);
      const markerLen = match ? match[0].length : 0;
      if (markerLen > 0) {
        // Unordered "-" is hidden in both states — the CSS ::before bullet
        // is the marker. Revealing it in the active block showed both (#235).
        decorations.push(Decoration.replace({}).range(pos, pos + markerLen));
      }
      decorations.push(Decoration.line({ class: `${LIST_CLASS} ${isActive ? 'cm-block-active' : 'cm-block-inactive'}` }).range(pos));
    } else if (orderedListRegex.test(line)) {
      const match = line.match(orderedListRegex);
      const markerLen = match ? match[0].length : 0;
      // Ordered list markers (1., 2., …) are semantic content — never replaced,
      // always visible. Inactive: plain marker; active: faint low-opacity marker.
      if (markerLen > 0) {
        const markerClass = isActive
          ? `${LIST_MARKER_CLASS} cm-list-marker-active`
          : LIST_MARKER_CLASS;
        decorations.push(
          Decoration.mark({ class: markerClass }).range(pos, pos + markerLen),
        );
      }
      decorations.push(Decoration.line({ class: `${LIST_CLASS} ${LIST_ORDERED_CLASS} ${isActive ? 'cm-block-active' : 'cm-block-inactive'}` }).range(pos));
    }

    pos += lineLen;
  }

  return decorations;
}
