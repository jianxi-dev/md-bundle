import type { Range } from '@codemirror/state';
import { Decoration, WidgetType } from '@codemirror/view';

const headingRegex = /^(#{1,6})\s+(.*)$/gm;

class HeadingWidget extends WidgetType {
  constructor(
    readonly level: string,
    readonly active: boolean,
  ) {
    super();
  }

  eq(other: HeadingWidget): boolean {
    return other.level === this.level && other.active === this.active;
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'cm-heading-marker';
    span.textContent = `[H${this.level.length}]`;
    // Active blocks get the semantic-reveal class for low-opacity prefix.
    if (this.active) {
      span.classList.add('cm-heading-marker-active');
    }
    return span;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

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
    // Replace only the "# " prefix, preserving the heading text
    const from = match.index;
    const to = from + level.length + 1; // "#" + space
    const content = match[2];

    // Determine if this heading is in the active block.
    const isActive = activeFrom >= 0 && from >= activeFrom && to <= activeTo;

    decorations.push(
      Decoration.replace({
        widget: new HeadingWidget(level, isActive),
        inclusive: false,
      }).range(from, to),
    );

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
