import type { Range } from '@codemirror/state';
import { Decoration } from '@codemirror/view';

const boldRegex = /\*\*(.+?)\*\*/g;
const italicRegex = /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)|_(.+?)_/g;

const BOLD_CLASS = 'cm-strong';
const ITALIC_CLASS = 'cm-em';

/**
 * Create bold/italic decorations for the document.
 *
 * Inline markers (**, *, _) are always hidden in both active and inactive
 * blocks — they don't help editing. The text styling (bold/italic) is always
 * applied so the rendered appearance is consistent.
 *
 * @param text - Full document text.
 * @param _activeFrom - Start offset of the active block (unused, inline markers always hidden).
 * @param _activeTo - End offset of the active block (unused, inline markers always hidden).
 */
export function createBoldItalicDecorations(
  text: string,
  _activeFrom: number = -1,
  _activeTo: number = -1,
): Range<Decoration>[] {
  const decorations: Range<Decoration>[] = [];

  // Bold: **text** → hide **, style text
  boldRegex.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = boldRegex.exec(text)) !== null) {
    const from = match.index;
    const to = from + match[0].length;
    const delimLen = 2;

    // Hide opening **
    decorations.push(Decoration.replace({}).range(from, from + delimLen));
    // Style content
    decorations.push(
      Decoration.mark({ class: BOLD_CLASS }).range(from + delimLen, to - delimLen),
    );
    // Hide closing **
    decorations.push(Decoration.replace({}).range(to - delimLen, to));
  }

  // Italic: *text* or _text_ → hide delimiter, style text
  italicRegex.lastIndex = 0;
  while ((match = italicRegex.exec(text)) !== null) {
    const from = match.index;
    const to = from + match[0].length;
    const delimLen = 1;

    decorations.push(Decoration.replace({}).range(from, from + delimLen));
    decorations.push(
      Decoration.mark({ class: ITALIC_CLASS }).range(from + delimLen, to - delimLen),
    );
    decorations.push(Decoration.replace({}).range(to - delimLen, to));
  }

  return decorations;
}
