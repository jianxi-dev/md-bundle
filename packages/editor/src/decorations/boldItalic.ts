import type { Range } from '@codemirror/state';
import { Decoration } from '@codemirror/view';

const boldRegex = /\*\*(.+?)\*\*/g;
const italicRegex = /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)|_(.+?)_/g;
const strikeRegex = /~~(.+?)~~/g;
// Match <u>…</u> raw-HTML passthrough (ticket #260). Non-greedy, single-line.
const underlineRegex = /<u>([^<]+?)<\/u>/g;
const fontRegex = /<span class="mdb-font-(serif|mono|sans)">([^<]+?)<\/span>/g;
const colorRegex = /<span class="mdb-color-(red|blue|green|orange|purple)">([^<]+?)<\/span>/g;
const bgRegex = /<span class="mdb-bg-(red|blue|green|orange|purple)">([^<]+?)<\/span>/g;

const BOLD_CLASS = 'cm-strong';
const ITALIC_CLASS = 'cm-em';
const STRIKE_CLASS = 'cm-strikethrough';
const UNDERLINE_CLASS = 'cm-underline';

/** Class families with raw-HTML passthrough spans (font / text color / background color). */
type SpanFamily = 'mdb-font' | 'mdb-color' | 'mdb-bg';

/**
 * Decorate `mdb-{family}-{variant}` passthrough spans: hide both raw tags and
 * mark the content with the matching `cm-*` class. Shared by font / text color
 * / background color (ticket #278) so the families cannot drift apart.
 */
function decorateSpanFamily(
  text: string,
  regex: RegExp,
  family: SpanFamily,
  decorations: Range<Decoration>[],
): void {
  regex.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const from = match.index;
    const to = from + match[0].length;
    const openTag = `<span class="${family}-${match[1]}">`;
    const closeTag = '</span>';
    const openLen = openTag.length;
    const closeLen = closeTag.length;
    const markClass = `cm-${family.slice('mdb-'.length)}-${match[1]}`;

    decorations.push(Decoration.replace({}).range(from, from + openLen));
    decorations.push(Decoration.mark({ class: markClass }).range(from + openLen, to - closeLen));
    decorations.push(Decoration.replace({}).range(to - closeLen, to));
  }
}

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

  // Strikethrough: ~~text~~ → hide ~~ delimiters, style text (ticket #260)
  strikeRegex.lastIndex = 0;
  while ((match = strikeRegex.exec(text)) !== null) {
    const from = match.index;
    const to = from + match[0].length;
    const delimLen = 2;
    decorations.push(Decoration.replace({}).range(from, from + delimLen));
    decorations.push(
      Decoration.mark({ class: STRIKE_CLASS }).range(from + delimLen, to - delimLen),
    );
    decorations.push(Decoration.replace({}).range(to - delimLen, to));
  }

  // Underline: <u>text</u> → hide the raw HTML tags, style text (ticket #260)
  underlineRegex.lastIndex = 0;
  while ((match = underlineRegex.exec(text)) !== null) {
    const from = match.index;
    const to = from + match[0].length;
    const openLen = '<u>'.length;
    const closeLen = '</u>'.length;
    decorations.push(Decoration.replace({}).range(from, from + openLen));
    decorations.push(
      Decoration.mark({ class: UNDERLINE_CLASS }).range(from + openLen, to - closeLen),
    );
    decorations.push(Decoration.replace({}).range(to - closeLen, to));
  }

  // Raw-HTML passthrough spans: font family / text color / background color.
  decorateSpanFamily(text, fontRegex, 'mdb-font', decorations);
  decorateSpanFamily(text, colorRegex, 'mdb-color', decorations);
  decorateSpanFamily(text, bgRegex, 'mdb-bg', decorations);

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
