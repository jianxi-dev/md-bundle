import type { Range } from '@codemirror/state';
import { Decoration } from '@codemirror/view';

const headingRegex = /^(#{1,6})\s+(.*)$/gm;

/**
 * Create heading decorations for the document.
 *
 * @param text - Full document text.
 * @param activeFrom - Start offset of the active block (or -1 if none).
 * @param activeTo - End offset of the active block (or -1 if none).
 */
export function createHeadingDecorations(
  text: string,
  activeFrom: number = -1,
  activeTo: number = -1,
): Range<Decoration>[] {
  const decorations: Range<Decoration>[] = [];
  headingRegex.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(text)) !== null) {
    const level = match[1];
    // The marker range is only the "# " prefix; the heading text follows.
    const from = match.index;
    const to = from + level.length + 1; // "#" + space
    const content = match[2];

    // Determine if this heading is in the active block.
    const isActive = activeFrom >= 0 && from >= activeFrom && to <= activeTo;

    // A mark (not replace) keeps the raw "# " in the DOM so it stays editable —
    // the level can be retyped or Backspaced. The theme reveals it only in the
    // active block; inactive blocks render it at opacity 0 (#253).
    const markerClass = isActive
      ? 'cm-heading-marker cm-heading-marker-active'
      : 'cm-heading-marker';
    decorations.push(Decoration.mark({ class: markerClass }).range(from, to));

    // Mark the content so the decorations theme can scale h1..h6.
    // Add block-semantic class for transition targeting.
    if (content.length > 0) {
      const markClass = isActive
        ? `cm-heading cm-h${level.length} cm-block-active`
        : `cm-heading cm-h${level.length} cm-block-inactive`;
      decorations.push(
        Decoration.mark({
          class: markClass,
        }).range(to, to + content.length),
      );
    }
  }

  return decorations;
}
