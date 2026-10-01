import type { Range } from '@codemirror/state';
import { Decoration } from '@codemirror/view';

const boldRegex = /\*\*(.+?)\*\*/g;
const italicRegex = /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)|_(.+?)_/g;
const strikeRegex = /~~(.+?)~~/g;
// Match <u>…</u> raw-HTML passthrough (ticket #260). Non-greedy, single-line.
const underlineRegex = /<u>([^<]+?)<\/u>/g;
const fontRegex = /<span class="mdb-font-(serif|mono|sans)">([^<]+?)<\/span>/g;
const colorRegex = /<span class="mdb-color-(red|blue|green|orange|purple)">([^<]+?)<\/span>/g;

const BOLD_CLASS = 'cm-strong';
const ITALIC_CLASS = 'cm-em';
const STRIKE_CLASS = 'cm-strikethrough';
const UNDERLINE_CLASS = 'cm-underline';
const FONT_SERIF_CLASS = 'cm-font-serif';
const FONT_MONO_CLASS = 'cm-font-mono';
const FONT_SANS_CLASS = 'cm-font-sans';
const COLOR_RED_CLASS = 'cm-color-red';
const COLOR_BLUE_CLASS = 'cm-color-blue';
const COLOR_GREEN_CLASS = 'cm-color-green';
const COLOR_ORANGE_CLASS = 'cm-color-orange';
const COLOR_PURPLE_CLASS = 'cm-color-purple';

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

  fontRegex.lastIndex = 0;
  while ((match = fontRegex.exec(text)) !== null) {
    const from = match.index;
    const to = from + match[0].length;
    const fontType = match[1];
    const openTag = `<span class="mdb-font-${fontType}">`;
    const closeTag = '</span>';
    const openLen = openTag.length;
    const closeLen = closeTag.length;

    let fontClass: string;
    switch (fontType) {
      case 'serif':
        fontClass = FONT_SERIF_CLASS;
        break;
      case 'mono':
        fontClass = FONT_MONO_CLASS;
        break;
      case 'sans':
        fontClass = FONT_SANS_CLASS;
        break;
      default:
        fontClass = FONT_SANS_CLASS;
    }

    decorations.push(Decoration.replace({}).range(from, from + openLen));
    decorations.push(
      Decoration.mark({ class: fontClass }).range(from + openLen, to - closeLen),
    );
    decorations.push(Decoration.replace({}).range(to - closeLen, to));
  }

  colorRegex.lastIndex = 0;
  while ((match = colorRegex.exec(text)) !== null) {
    const from = match.index;
    const to = from + match[0].length;
    const colorType = match[1];
    const openTag = `<span class="mdb-color-${colorType}">`;
    const closeTag = '</span>';
    const openLen = openTag.length;
    const closeLen = closeTag.length;

    let colorClass: string;
    switch (colorType) {
      case 'red':
        colorClass = COLOR_RED_CLASS;
        break;
      case 'blue':
        colorClass = COLOR_BLUE_CLASS;
        break;
      case 'green':
        colorClass = COLOR_GREEN_CLASS;
        break;
      case 'orange':
        colorClass = COLOR_ORANGE_CLASS;
        break;
      case 'purple':
        colorClass = COLOR_PURPLE_CLASS;
        break;
      default:
        colorClass = COLOR_RED_CLASS;
    }

    decorations.push(Decoration.replace({}).range(from, from + openLen));
    decorations.push(
      Decoration.mark({ class: colorClass }).range(from + openLen, to - closeLen),
    );
    decorations.push(Decoration.replace({}).range(to - closeLen, to));
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
