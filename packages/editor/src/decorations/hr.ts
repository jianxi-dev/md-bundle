/**
 * Thematic break (horizontal rule) decoration — renders `---`, `***`, `___`
 * as a horizontal rule in inactive blocks. When the cursor enters
 * the hr line (active block), the raw source is revealed for editing.
 *
 * Uses a line decoration for the horizontal rule visual and a replace
 * decoration to hide the raw markers. The line remains editable so
 * the cursor can enter it (unlike block widgets which are atomic).
 */
import type { Range } from '@codemirror/state';
import { Decoration, WidgetType } from '@codemirror/view';

const HR_CLASS = 'cm-thematic-break';

/**
 * Matches thematic breaks: ---, ***, ___ (with optional spaces)
 * Must be on its own line (CommonMark spec).
 */
const hrRegex = /^( {0,3})([-*_])([-*_])([-*_])[ \t]*$/m;

/**
 * Empty widget that replaces the hr markers but keeps the line editable.
 */
class EmptyWidget extends WidgetType {
  eq(other: EmptyWidget): boolean {
    return other instanceof EmptyWidget;
  }

  toDOM(): HTMLElement {
    return document.createElement('span');
  }

  ignoreEvent(): boolean {
    return false;
  }
}

const emptyWidget = new EmptyWidget();

/**
 * Create thematic break decorations for the document.
 *
 * @param text - Full document text.
 * @param activeFrom - Start offset of the active block (or -1 if none).
 * @param activeTo - End offset of the active block (or -1 if none).
 */
export function createHrDecorations(
  text: string,
  activeFrom: number = -1,
  activeTo: number = -1,
): Range<Decoration>[] {
  const decorations: Range<Decoration>[] = [];
  const lines = text.split('\n');

  let pos = 0;
  for (const line of lines) {
    const match = line.match(hrRegex);
    if (match) {
      const lineStart = pos;
      const lineEnd = pos + line.length;
      const isActive = activeFrom >= 0 && lineStart >= activeFrom && lineEnd <= activeTo;

      if (!isActive) {
        // Inactive block: style the line as a horizontal rule and hide the raw markers
        // Line decoration adds the horizontal rule visual (border)
        decorations.push(
          Decoration.line({ class: HR_CLASS }).range(lineStart),
        );
        // Replace decoration hides the raw markers (---, ***, ___) but keeps the line editable
        // (not block: true, so cursor can enter the line)
        decorations.push(
          Decoration.replace({ widget: emptyWidget }).range(lineStart, lineEnd),
        );
      }
      // Active block: no decoration, raw source visible
    }
    pos += line.length + 1; // +1 for \n
  }

  return decorations;
}