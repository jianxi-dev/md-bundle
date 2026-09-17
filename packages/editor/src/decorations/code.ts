import type { Range } from '@codemirror/state';
import { Decoration } from '@codemirror/view';

const inlineCodeRegex = /(`+)(.+?)\1/g;

const INLINE_CODE_CLASS = 'cm-inline-code';

/**
 * Create inline code decorations for the document.
 *
 * Non-active blocks: backticks hidden, code styled with background.
 * Active blocks: background + faint backticks shown at low opacity.
 *
 * @param text - Full document text.
 * @param activeFrom - Start offset of the active block (or -1 if none).
 * @param activeTo - End offset of the active block (or -1 if none).
 */
export function createCodeDecorations(
  text: string,
  activeFrom: number = -1,
  activeTo: number = -1,
): Range<Decoration>[] {
  const decorations: Range<Decoration>[] = [];
  inlineCodeRegex.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = inlineCodeRegex.exec(text)) !== null) {
    const from = match.index;
    const to = from + match[0].length;
    const backtickLen = match[1].length;
    const isActive = activeFrom >= 0 && from >= activeFrom && to <= activeTo;

    if (isActive) {
      // Active: show faint backticks + styled content.
      decorations.push(
        Decoration.mark({ class: 'cm-code-marker-active' }).range(from, from + backtickLen),
      );
      decorations.push(
        Decoration.mark({ class: `${INLINE_CODE_CLASS} cm-block-active` }).range(from + backtickLen, to - backtickLen),
      );
      decorations.push(
        Decoration.mark({ class: 'cm-code-marker-active' }).range(to - backtickLen, to),
      );
    } else {
      // Inactive: hide backticks, style content.
      decorations.push(Decoration.replace({}).range(from, from + backtickLen));
      decorations.push(
        Decoration.mark({ class: INLINE_CODE_CLASS }).range(from + backtickLen, to - backtickLen),
      );
      decorations.push(Decoration.replace({}).range(to - backtickLen, to));
    }
  }

  return decorations;
}
