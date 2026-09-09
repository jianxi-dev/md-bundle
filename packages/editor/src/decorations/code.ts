import type { Range } from '@codemirror/state';
import { Decoration } from '@codemirror/view';

const inlineCodeRegex = /(`+)(.+?)\1/g;

const INLINE_CODE_CLASS = 'cm-inline-code';

export function createCodeDecorations(text: string): Range<Decoration>[] {
  const decorations: Range<Decoration>[] = [];
  inlineCodeRegex.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = inlineCodeRegex.exec(text)) !== null) {
    const from = match.index;
    const to = from + match[0].length;
    const backtickLen = match[1].length;

    // Hide opening backticks
    decorations.push(Decoration.replace({}).range(from, from + backtickLen));
    // Style content
    decorations.push(
      Decoration.mark({ class: INLINE_CODE_CLASS }).range(from + backtickLen, to - backtickLen),
    );
    // Hide closing backticks
    decorations.push(Decoration.replace({}).range(to - backtickLen, to));
  }

  return decorations;
}
