import type { Range } from '@codemirror/state';
import { Decoration } from '@codemirror/view';

const boldRegex = /\*\*(.+?)\*\*/g;
const italicRegex = /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)|_(.+?)_/g;

const BOLD_CLASS = 'cm-strong';
const ITALIC_CLASS = 'cm-em';

// --- Incomplete marker detection (Type-as-Render) ----------------------------

/**
 * Detects incomplete bold markers (`**` without closing) for fluid editing.
 * Returns the start position of the opening `**` and the content range.
 */
function findIncompleteBold(text: string): { openPos: number; contentFrom: number; contentTo: number } | null {
  // Match ** followed by content but no closing ** before end of line
  const incompleteBoldRegex = /\*\*([^\n*]+?)(?:\*\*|$)/g;
  incompleteBoldRegex.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = incompleteBoldRegex.exec(text)) !== null) {
    const from = match.index;
    const to = from + match[0].length;
    // Check if this is actually a complete **bold** match
    const isComplete = match[0].endsWith('**') && match[0].length > 4;
    if (!isComplete) {
      // Incomplete: **text (no closing **)
      return {
        openPos: from,
        contentFrom: from + 2,
        contentTo: to,
      };
    }
  }
  return null;
}

/**
 * Detects incomplete italic markers (`*` without closing) for fluid editing.
 * Returns the start position of the opening `*` and the content range.
 */
function findIncompleteItalic(text: string): { openPos: number; contentFrom: number; contentTo: number } | null {
  // Match single * followed by content but no closing * before end of line
  // Must not be part of ** (bold)
  const incompleteItalicRegex = /(?<!\*)\*(?!\*)([^\n*]+?)(?:\*(?!\*)|$)/g;
  incompleteItalicRegex.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = incompleteItalicRegex.exec(text)) !== null) {
    const from = match.index;
    const to = from + match[0].length;
    // Check if this is actually a complete *italic* match
    const isComplete = match[0].endsWith('*') && !match[0].endsWith('**') && match[0].length > 2;
    if (!isComplete) {
      // Incomplete: *text (no closing *)
      return {
        openPos: from,
        contentFrom: from + 1,
        contentTo: to,
      };
    }
  }
  return null;
}

export function createBoldItalicDecorations(text: string): Range<Decoration>[] {
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

  // Type-as-Render: Apply styling to incomplete markers
  // Incomplete bold: **text (no closing **)
  const incompleteBold = findIncompleteBold(text);
  if (incompleteBold) {
    // Hide opening **
    decorations.push(Decoration.replace({}).range(incompleteBold.openPos, incompleteBold.openPos + 2));
    // Style content (fluid: show bold while typing)
    decorations.push(
      Decoration.mark({ class: BOLD_CLASS }).range(incompleteBold.contentFrom, incompleteBold.contentTo),
    );
  }

  // Incomplete italic: *text (no closing *)
  const incompleteItalic = findIncompleteItalic(text);
  if (incompleteItalic) {
    // Hide opening *
    decorations.push(Decoration.replace({}).range(incompleteItalic.openPos, incompleteItalic.openPos + 1));
    // Style content (fluid: show italic while typing)
    decorations.push(
      Decoration.mark({ class: ITALIC_CLASS }).range(incompleteItalic.contentFrom, incompleteItalic.contentTo),
    );
  }

  return decorations;
}
