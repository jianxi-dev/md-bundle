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
 * Finds callout block ranges (entire block including > lines).
 * Returns array of [from, to] offsets.
 */
function findCalloutRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const lines = text.split('\n');
  const CALLOUT_OPEN_RE = /^>\s*\[!([A-Za-z]+)\]([+-]?)\s*(.*)$/;
  const CALLOUT_LINE_RE = /^>\s?(.*)$/;

  let i = 0;
  while (i < lines.length) {
    const openMatch = CALLOUT_OPEN_RE.exec(lines[i]);
    if (openMatch) {
      let from = 0;
      for (let j = 0; j < i; j++) {
        from += lines[j].length + 1;
      }

      let j = i + 1;
      while (j < lines.length) {
        const lineMatch = CALLOUT_LINE_RE.exec(lines[j]);
        if (lineMatch && lines[j].startsWith('>')) {
          j++;
        } else {
          break;
        }
      }

      let to = from;
      for (let k = i; k < j; k++) {
        to += lines[k].length;
        if (k < j - 1) to += 1;
      }

      ranges.push([from, to]);
      i = j;
    } else {
      i++;
    }
  }

  return ranges;
}

/**
 * Finds table block ranges using the same logic as table.ts.
 * Returns array of [from, to] offsets.
 */
function findTableRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const lines = text.split('\n');
  const TABLE_ROW_RE = /^\s*\|.*\|\s*$/;

  let i = 0;
  while (i < lines.length) {
    if (TABLE_ROW_RE.test(lines[i])) {
      let from = 0;
      for (let j = 0; j < i; j++) {
        from += lines[j].length + 1;
      }

      let j = i;
      while (j < lines.length && TABLE_ROW_RE.test(lines[j])) {
        j++;
      }

      let to = from;
      for (let k = i; k < j; k++) {
        to += lines[k].length;
        if (k < j - 1) to += 1;
      }

      ranges.push([from, to]);
      i = j;
    } else {
      i++;
    }
  }

  return ranges;
}

/**
 * Finds column block ranges (::: {.col-N} ... :::).
 * Returns array of [from, to] offsets.
 */
function findColumnRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const lines = text.split('\n');
  const OPEN_RE = /^ {0,3}:::\s*\{([^}]*)\}\s*$/;
  const CLOSE_RE = /^ {0,3}:::\s*$/;
  const COL_RE = /\.col-([1-5])/;

  let i = 0;
  while (i < lines.length) {
    const open = OPEN_RE.exec(lines[i]);
    const colMatch = open ? COL_RE.exec(open[1]) : null;
    if (open && colMatch) {
      let from = 0;
      for (let j = 0; j < i; j++) {
        from += lines[j].length + 1;
      }

      let j = i + 1;
      let depth = 1;
      while (j < lines.length) {
        if (OPEN_RE.test(lines[j])) depth += 1;
        else if (CLOSE_RE.test(lines[j])) {
          depth -= 1;
          if (depth === 0) break;
        }
        j++;
      }

      if (j < lines.length) {
        let to = from;
        for (let k = i; k <= j; k++) {
          to += lines[k].length;
          if (k < j) to += 1;
        }
        ranges.push([from, to]);
        i = j + 1;
      } else {
        i++;
      }
    } else {
      i++;
    }
  }

  return ranges;
}

/**
 * Finds mermaid block ranges (```mermaid ... ```).
 * Returns array of [from, to] offsets.
 */
function findMermaidRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const lines = text.split('\n');
  const FENCE_OPEN_RE = /^( {0,3})(`{3,}|~{3,})[ \t]*([^\n]*)$/;
  const FENCE_CLOSE_RE = /^( {0,3})(`{3,}|~{3,})[ \t]*$/;

  let i = 0;
  while (i < lines.length) {
    const open = FENCE_OPEN_RE.exec(lines[i]);
    const language = open ? open[3].trim().split(/\s+/)[0] : '';
    if (open && language === 'mermaid') {
      let from = 0;
      for (let j = 0; j < i; j++) {
        from += lines[j].length + 1;
      }

      const fenceChar = open[2][0];
      const fenceLen = open[2].length;

      let close = -1;
      for (let j = i + 1; j < lines.length; j++) {
        const candidate = FENCE_CLOSE_RE.exec(lines[j]);
        if (candidate && candidate[2][0] === fenceChar && candidate[2].length >= fenceLen) {
          close = j;
          break;
        }
      }

      if (close !== -1) {
        let to = from;
        for (let k = i; k <= close; k++) {
          to += lines[k].length;
          if (k < close) to += 1;
        }
        ranges.push([from, to]);
        i = close + 1;
      } else {
        // Unclosed fence - treat rest as mermaid
        let to = from;
        for (let k = i; k < lines.length; k++) {
          to += lines[k].length;
          if (k < lines.length - 1) to += 1;
        }
        ranges.push([from, to]);
        break;
      }
    } else {
      i++;
    }
  }

  return ranges;
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

  // Find all ranges to exclude (code fences, callouts, tables, columns, mermaid)
  const fencedRanges = findFencedRanges(text);
  const calloutRanges = findCalloutRanges(text);
  const tableRanges = findTableRanges(text);
  const columnRanges = findColumnRanges(text);
  const mermaidRanges = findMermaidRanges(text);
  const allExcludedRanges = [
    ...fencedRanges,
    ...calloutRanges,
    ...tableRanges,
    ...columnRanges,
    ...mermaidRanges,
  ];

  linkRegex.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(text)) !== null) {
    const matchStart = match.index;

    // Skip links inside excluded ranges
    if (isInsideRange(matchStart, allExcludedRanges)) continue;

    const linkText = match[1];
    const from = matchStart;
    const to = matchStart + match[0].length;

    // Find the positions of the parts: [text](url)
    // match[0] = [text](url)
    // match[1] = text
    // match[2] = url
    const openBracketLen = 1; // '['

    const textStart = from + openBracketLen;
    const textEnd = from + openBracketLen + linkText.length;

    const isActive = activeFrom >= 0 && from >= activeFrom && to <= activeTo;

    if (isActive) {
      // Active block: show raw source, but still style the link text
      decorations.push(
        Decoration.mark({ class: `${LINK_CLASS} cm-block-active` }).range(textStart, textEnd),
      );
    } else {
      // Inactive block: hide the opening '[' and the '](url)' including trailing ')',
      // style only the link text
      decorations.push(Decoration.replace({}).range(from, textStart)); // hides '['
      decorations.push(Decoration.replace({}).range(textEnd, to)); // hides '](url)'
      decorations.push(
        Decoration.mark({ class: LINK_CLASS }).range(textStart, textEnd),
      );
    }
  }

  return decorations;
}