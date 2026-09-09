import type { Range } from '@codemirror/state';
import { Decoration, WidgetType } from '@codemirror/view';

const headingRegex = /^(#{1,6})\s+(.*)$/gm;

class HeadingWidget extends WidgetType {
  constructor(readonly level: string) {
    super();
  }

  eq(other: HeadingWidget): boolean {
    return other.level === this.level;
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'cm-heading-marker';
    span.textContent = `[H${this.level.length}]`;
    return span;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

export function createHeadingDecorations(text: string): Range<Decoration>[] {
  const decorations: Range<Decoration>[] = [];
  headingRegex.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(text)) !== null) {
    const level = match[1];
    // Replace only the "# " prefix, preserving the heading text
    const from = match.index;
    const to = from + level.length + 1; // "#" + space
    const content = match[2];

    decorations.push(
      Decoration.replace({
        widget: new HeadingWidget(level),
        inclusive: false,
      }).range(from, to),
    );

    // Mark the content so the decorations theme can scale h1..h6.
    if (content.length > 0) {
      decorations.push(
        Decoration.mark({
          class: `cm-heading cm-h${level.length}`,
        }).range(to, to + content.length),
      );
    }
  }

  return decorations;
}
