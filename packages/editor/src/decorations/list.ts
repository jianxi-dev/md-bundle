import type { Range } from '@codemirror/state';
import { Decoration, WidgetType, type EditorView } from '@codemirror/view';

// List markers are anchored at the start of the line, but a list nested in a
// blockquote keeps its `> ` prefix in the source (`> - item`). Skipping that
// prefix is what lets the same regexes match a top-level list and a quoted one.
const blockquotePrefixRegex = /^(?:>[ \t]?)+/;
const unorderedListRegex = /^[-*+]\s/;
const orderedListRegex = /^\d+\.\s/;
const taskListRegex = /^- \[([ xX])\]\s/;

const LIST_CLASS = 'cm-list';
const LIST_ORDERED_CLASS = 'cm-list-ordered';
const LIST_MARKER_CLASS = 'cm-list-marker';
const TASK_DONE_CLASS = 'cm-task-done';
const TASK_PENDING_CLASS = 'cm-task-pending';
const TASK_CHECKBOX_CLASS = 'cm-task-checkbox';

/** The list kind of a source line, plus the offsets its marker occupies. */
export interface ListLineInfo {
  kind: 'task' | 'unordered' | 'ordered' | 'plain';
  /** Length of a leading blockquote prefix (`> `), or 0 when there is none. */
  prefixLen: number;
  /** Marker length after the prefix (`- `, `1. `, `- [x] `), or 0 for plain. */
  markerLen: number;
  /** For `task` lines: whether the checkbox is checked. */
  checked: boolean;
}

/**
 * Classify one source line as a list item, tolerating a blockquote prefix.
 *
 * Both the decorations and the callout body renderer read this, so a list in a
 * blockquote (or in a callout, whose body is a widget) is recognised by the
 * same rules as a top-level list instead of two drifting copies.
 */
export function classifyListLine(line: string): ListLineInfo {
  const prefixLen = line.match(blockquotePrefixRegex)?.[0].length ?? 0;
  const body = line.slice(prefixLen);

  const task = taskListRegex.exec(body);
  if (task) {
    return {
      kind: 'task',
      prefixLen,
      markerLen: task[0].length,
      checked: task[1].toLowerCase() === 'x',
    };
  }
  const unordered = unorderedListRegex.exec(body);
  if (unordered) {
    return { kind: 'unordered', prefixLen, markerLen: unordered[0].length, checked: false };
  }
  const ordered = orderedListRegex.exec(body);
  if (ordered) {
    return { kind: 'ordered', prefixLen, markerLen: ordered[0].length, checked: false };
  }
  return { kind: 'plain', prefixLen, markerLen: 0, checked: false };
}

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
    box.className = TASK_CHECKBOX_CLASS;
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
 * Quoted lists (`> - item`) are decorated too: the marker range is shifted past
 * the `> ` prefix (which quote.ts hides) so the bullet/checkbox lands on the
 * list marker, not on the quote marker. Without the shift a `> -` line never
 * matched the line-start regexes and rendered literally (#382).
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
    const info = classifyListLine(line);
    const markerFrom = pos + info.prefixLen;

    if (info.kind === 'task' && info.markerLen > 0) {
      const bracketFrom = markerFrom + line.slice(info.prefixLen).indexOf('[');
      const lineClasses = `${LIST_CLASS} ${info.checked ? TASK_DONE_CLASS : TASK_PENDING_CLASS} ${isActive ? 'cm-block-active' : 'cm-block-inactive'}`;
      decorations.push(
        Decoration.replace({ widget: new TaskCheckboxWidget(info.checked, bracketFrom) }).range(
          markerFrom,
          markerFrom + info.markerLen,
        ),
      );
      decorations.push(Decoration.line({ class: lineClasses }).range(pos));
    } else if (info.kind === 'unordered' && info.markerLen > 0) {
      // Unordered "-" is hidden in both states — the CSS ::before bullet
      // is the marker. Revealing it in the active block showed both (#235).
      decorations.push(Decoration.replace({}).range(markerFrom, markerFrom + info.markerLen));
      decorations.push(
        Decoration.line({ class: `${LIST_CLASS} ${isActive ? 'cm-block-active' : 'cm-block-inactive'}` }).range(pos),
      );
    } else if (info.kind === 'ordered' && info.markerLen > 0) {
      // Ordered list markers (1., 2., …) are semantic content — never replaced,
      // always visible. Inactive: plain marker; active: faint low-opacity marker.
      const markerClass = isActive
        ? `${LIST_MARKER_CLASS} cm-list-marker-active`
        : LIST_MARKER_CLASS;
      decorations.push(
        Decoration.mark({ class: markerClass }).range(markerFrom, markerFrom + info.markerLen),
      );
      decorations.push(
        Decoration.line({ class: `${LIST_CLASS} ${LIST_ORDERED_CLASS} ${isActive ? 'cm-block-active' : 'cm-block-inactive'}` }).range(pos),
      );
    }

    pos += lineLen;
  }

  return decorations;
}

/**
 * Build the display DOM for one callout content line.
 *
 * A callout body is rendered by a widget, not editable CM6 content, so it can
 * never be reached by decoration ranges. This is the DOM twin of the list
 * decoration language above: list lines carry the same `cm-line cm-list` /
 * `cm-list-ordered` / `cm-list-marker` / task classes, so a list inside a
 * callout reads identically to a list on its own line (#382).
 */
export function createContentLineElement(line: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'cm-callout-line';
  const info = classifyListLine(line);

  if (info.kind === 'plain') {
    el.textContent = line;
    return el;
  }

  const body = line.slice(info.prefixLen);
  el.classList.add('cm-line', LIST_CLASS);
  if (info.kind === 'ordered') el.classList.add(LIST_ORDERED_CLASS);
  if (info.kind === 'task') {
    el.classList.add(info.checked ? TASK_DONE_CLASS : TASK_PENDING_CLASS);
    const box = document.createElement('span');
    box.className = TASK_CHECKBOX_CLASS;
    box.setAttribute('aria-hidden', 'true');
    if (info.checked) box.setAttribute('data-checked', 'true');
    el.appendChild(box);
  }
  if (info.kind === 'ordered') {
    const marker = document.createElement('span');
    marker.className = LIST_MARKER_CLASS;
    marker.textContent = body.slice(0, info.markerLen);
    el.appendChild(marker);
  }
  el.appendChild(document.createTextNode(body.slice(info.markerLen)));
  return el;
}
