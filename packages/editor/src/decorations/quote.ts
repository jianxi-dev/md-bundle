import type { Range } from '@codemirror/state';
import { Decoration } from '@codemirror/view';

const quoteRegex = /^>\s?/m;

const QUOTE_CLASS = 'cm-quote';

/**
 * Create blockquote decorations for the document.
 *
 * Non-active blocks: `> ` hidden, rendered with left border.
 * Active blocks: left border + faint `>` prefix shown at low opacity.
 *
 * @param text - Full document text.
 * @param activeFrom - Start offset of the active block (or -1 if none).
 * @param activeTo - End offset of the active block (or -1 if none).
 */
export function createQuoteDecorations(
  text: string,
  activeFrom: number = -1,
  activeTo: number = -1,
): Range<Decoration>[] {
  const decorations: Range<Decoration>[] = [];
  const lines = text.split('\n');

  let pos = 0;
  for (const line of lines) {
    const match = line.match(quoteRegex);
    if (match) {
      const lineStart = pos;
      const lineEnd = pos + line.length;
      const isActive = activeFrom >= 0 && lineStart >= activeFrom && lineEnd <= activeTo;

      // Apply line-level styling (left border, gray bg)
      const lineClass = `${QUOTE_CLASS} ${isActive ? 'cm-block-active' : 'cm-block-inactive'}`;
      decorations.push(Decoration.line({ class: lineClass }).range(pos));

      // In active blocks, show the "> " prefix at low opacity.
      const markerLen = match[0].length;
      if (isActive) {
        decorations.push(
          Decoration.mark({ class: 'cm-quote-marker-active' }).range(pos, pos + markerLen),
        );
      } else {
        decorations.push(Decoration.replace({}).range(pos, pos + markerLen));
      }
    }
    pos += line.length + 1;
  }

  return decorations;
}
