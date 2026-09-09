import type { Range } from '@codemirror/state';
import { Decoration } from '@codemirror/view';

const quoteRegex = /^>\s?/m;

const QUOTE_CLASS = 'cm-quote';

export function createQuoteDecorations(text: string): Range<Decoration>[] {
  const decorations: Range<Decoration>[] = [];
  const lines = text.split('\n');

  let pos = 0;
  for (const line of lines) {
    const match = line.match(quoteRegex);
    if (match) {
      // Apply line-level styling (left border, gray bg)
      decorations.push(Decoration.line({ class: QUOTE_CLASS }).range(pos));
      // Hide the "> " prefix
      const markerLen = match[0].length;
      decorations.push(Decoration.replace({}).range(pos, pos + markerLen));
    }
    pos += line.length + 1;
  }

  return decorations;
}
