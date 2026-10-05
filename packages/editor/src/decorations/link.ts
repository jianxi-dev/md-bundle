/**
 * Link decoration — renders markdown links `[text](url)` as visible link text
 * with the URL hidden in inactive blocks. When the cursor enters the link
 * range (active block), the raw source is revealed for editing.
 *
 * Follows the same active/inactive pattern as inline code and bold/italic:
 * - Inactive: URL part replaced (hidden), link text styled with .cm-link
 * - Active: raw source visible (no replace), link text still styled
 */
import type { Range } from '@codemirror/state';
import { Decoration } from '@codemirror/view';

const LINK_CLASS = 'cm-link';

/**
 * Matches markdown links: [text](url)
 * Excludes images (which start with !) and links inside code fences.
 */
const linkRegex = /(?<!!)\[([^\]]+)\]\(([^)]+)\)/g;

/**
 * Finds line ranges that are inside code fences (``` delimited).
 * Returns an array of [start, end] offsets for fenced content.
 */
function findFencedRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const lines = text.split('\n');
  let inFence = false;
  let fenceStart = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineStart = i === 0 ? 0 : lines.slice(0, i).join('\n').length + 1;

    if (/^\s*```/.test(line)) {
      if (!inFence) {
        inFence = true;
        fenceStart = lineStart;
      } else {
        // End of fence — include the closing ``` line
        ranges.push([fenceStart, lineStart + line.length]);
        inFence = false;
        fenceStart = -1;
      }
    }
  }

  // Unclosed fence — treat rest of document as fenced
  if (inFence) {
    ranges.push([fenceStart, text.length]);
  }

  // Also handle indented code blocks (4 spaces or tab)
  let indentedStart = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineStart = i === 0 ? 0 : lines.slice(0, i).join('\n').length + 1;
    const isIndented = /^\s{4}|\t/.test(line);

    if (isIndented && indentedStart === -1) {
      indentedStart = lineStart;
    } else if (!isIndented && indentedStart !== -1) {
      ranges.push([indentedStart, lineStart]);
      indentedStart = -1;
    }
  }
  if (indentedStart !== -1) {
    ranges.push([indentedStart, text.length]);
  }

  return ranges;
}

/**
 * Checks if a position is inside any of the given ranges.
 */
function isInsideRange(pos: number, ranges: Array<[number, number]>): boolean {
  for (const [start, end] of ranges) {
    if (pos >= start && pos < end) return true;
  }
  return false;
}

/**
 * Create link decorations for the document.
 *
 * @param text - Full document text.
 * @param activeFrom - Start offset of the active block (or -1 if none).
 * @param activeTo - End offset of the active block (or -1 if none).
 */
export function createLinkDecorations(
  text: string,
  activeFrom: number = -1,
  activeTo: number = -1,
): Range<Decoration>[] {
  const decorations: Range<Decoration>[] = [];

  // Find code fence ranges to exclude
  const fencedRanges = findFencedRanges(text);

  linkRegex.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(text)) !== null) {
    const matchStart = match.index;

    // Skip links inside code fences
    if (isInsideRange(matchStart, fencedRanges)) continue;

    const linkText = match[1];
    const from = matchStart;
    const to = matchStart + match[0].length;

    // Find the positions of the parts: [text](url)
    // match[0] = [text](url)
    // match[1] = text
    // match[2] = url
    const openBracketLen = 1; // '['
    const closeParenLen = 1; // ')'

    const textStart = from + openBracketLen;
    const textEnd = from + openBracketLen + linkText.length;

    const isActive = activeFrom >= 0 && from >= activeFrom && to <= activeTo;

    if (isActive) {
      // Active block: show raw source, but still style the link text
      decorations.push(
        Decoration.mark({ class: `${LINK_CLASS} cm-block-active` }).range(textStart, textEnd),
      );
    } else {
      // Inactive block: hide the URL part (](url)), style the link text
      decorations.push(Decoration.replace({}).range(textEnd, to - closeParenLen));
      decorations.push(
        Decoration.mark({ class: LINK_CLASS }).range(textStart, textEnd),
      );
    }
  }

  return decorations;
}