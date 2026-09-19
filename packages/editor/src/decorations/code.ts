import type { Range } from '@codemirror/state';
import { Decoration, WidgetType } from '@codemirror/view';

const inlineCodeRegex = /(`+)(.+?)\1/g;

const INLINE_CODE_CLASS = 'cm-inline-code';

/**
 * Fenced code block opening line: ``` optionally followed by a language.
 * Captures the fence (``` or ~~~) and the language info string.
 */
const fencedCodeRegex = /^(```|~~~)[ \t]*([^\s]*).*$/gm;

const FENCED_CODE_CLASS = 'cm-fenced-code';

/**
 * Widget that renders the language label on a fenced code opening line.
 */
class CodeLanguageLabel extends WidgetType {
  constructor(
    readonly language: string,
    readonly active: boolean,
  ) {
    super();
  }

  eq(other: CodeLanguageLabel): boolean {
    return other.language === this.language && other.active === this.active;
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'cm-fenced-code-language';
    span.textContent = this.language;
    if (this.active) {
      span.classList.add('cm-fenced-code-language-active');
    }
    return span;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

/**
 * Create inline code AND fenced code block decorations for the document.
 *
 * Inline code:
 * - Non-active blocks: backticks hidden, code styled with background.
 * - Active blocks: background + faint backticks shown at low opacity.
 *
 * Fenced code blocks:
 * - Language label rendered as a widget at end of the opening fence line.
 * - No language → no label, no error.
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

  // --- Inline code decorations ---
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

  // --- Fenced code block decorations ---
  fencedCodeRegex.lastIndex = 0;

  let fenceMatch: RegExpExecArray | null;
  while ((fenceMatch = fencedCodeRegex.exec(text)) !== null) {
    const language = fenceMatch[2];
    if (language.length === 0) continue; // No language → no label.

    const lineStart = fenceMatch.index;
    // Find end of this line (or end of document).
    const lineEnd = text.indexOf('\n', lineStart);
    const lineStop = lineEnd === -1 ? text.length : lineEnd;

    const isActive = activeFrom >= 0 && lineStart >= activeFrom && lineStop <= activeTo;

    // Place the language label widget at the end of the fence opening line.
    decorations.push(
      Decoration.widget({
        widget: new CodeLanguageLabel(language, isActive),
        side: 1,
      }).range(lineStop),
    );

    // Mark the opening line so theme can style it.
    decorations.push(
      Decoration.line({
        class: isActive
          ? `${FENCED_CODE_CLASS} cm-block-active`
          : `${FENCED_CODE_CLASS} cm-block-inactive`,
      }).range(lineStart),
    );
  }

  return decorations;
}
