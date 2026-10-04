import type { Range } from '@codemirror/state';
import { Decoration, WidgetType } from '@codemirror/view';

const inlineCodeRegex = /(`+)(.+?)\1/g;

const INLINE_CODE_CLASS = 'cm-inline-code';

/**
 * Fenced code block opening line: up to 3 spaces of indent, a run of 3+ backticks
 * or tildes, then an optional info string. Shares the CommonMark shape used by
 * `mermaid.ts` so both modules agree on which lines open a fence.
 */
const FENCE_OPEN_RE = /^( {0,3})(`{3,}|~{3,})[ \t]*([^\n]*)$/;

/**
 * Fenced code block closing line: the same fence character as the opener, at
 * least as long, with nothing but whitespace after it.
 */
const FENCE_CLOSE_RE = /^( {0,3})(`{3,}|~{3,})[ \t]*$/;

const FENCED_CODE_CLASS = 'cm-fenced-code';

/**
 * One closed fenced code block. All offsets are line-content ranges — the
 * trailing newline is deliberately excluded because `Decoration.replace` must
 * not span a line break.
 */
interface FencedBlock {
  openStart: number;
  openEnd: number;
  closeStart: number;
  closeEnd: number;
  language: string;
}

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
 * Find every closed fenced code block, pairing each opening fence with the
 * matching close (same character, at least as long). An unclosed opening fence
 * ends the scan: every following line is fence content, so there is no further
 * block to pair and no closing marker to hide.
 */
function parseFencedBlocks(text: string): FencedBlock[] {
  const lines = text.split('\n');
  const offsets: number[] = [];
  let acc = 0;
  for (const line of lines) {
    offsets.push(acc);
    acc += line.length + 1;
  }

  const blocks: FencedBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const open = FENCE_OPEN_RE.exec(lines[i]);
    if (!open) {
      i += 1;
      continue;
    }

    const fenceChar = open[2][0];
    const fenceLen = open[2].length;
    const language = open[3].trim().split(/\s+/)[0] ?? '';

    let close = -1;
    for (let j = i + 1; j < lines.length; j += 1) {
      const candidate = FENCE_CLOSE_RE.exec(lines[j]);
      if (candidate && candidate[2][0] === fenceChar && candidate[2].length >= fenceLen) {
        close = j;
        break;
      }
    }
    if (close === -1) break;

    blocks.push({
      openStart: offsets[i],
      openEnd: offsets[i] + lines[i].length,
      closeStart: offsets[close],
      closeEnd: offsets[close] + lines[close].length,
      language,
    });
    i = close + 1;
  }
  return blocks;
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
 * - Non-active blocks: both fence marker lines (opener + info string, closer)
 *   are replaced so no ``` / ~~~ survives in the rendered DOM.
 * - Active blocks: no fence replace — the raw source stays visible and editable.
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
  for (const block of parseFencedBlocks(text)) {
    // Mermaid blocks are replaced wholesale by the mermaid decoration; a fence
    // replace here would overlap that block replace, which CM6 rejects.
    if (block.language === 'mermaid') continue;

    // Overlap test (same shape as the mermaid decorator) so the active state
    // holds wherever the cursor sits inside the block.
    const isActive =
      activeFrom >= 0 && block.openStart < activeTo && block.closeEnd > activeFrom;

    // Label widget anchored just past the opening line's content.
    if (block.language.length > 0) {
      decorations.push(
        Decoration.widget({
          widget: new CodeLanguageLabel(block.language, isActive),
          side: 1,
        }).range(block.openEnd),
      );
    }

    // Mark the opening line so theme can style the block surface.
    decorations.push(
      Decoration.line({
        class: isActive
          ? `${FENCED_CODE_CLASS} cm-block-active`
          : `${FENCED_CODE_CLASS} cm-block-inactive`,
      }).range(block.openStart),
    );

    // Inactive: replace the opener (fence + info string) and the closer so the
    // block reads as clean code. Active: emit no replace, keeping the raw source
    // visible and editable. Only the two marker lines are replaced — body lines
    // stay untouched.
    if (!isActive) {
      decorations.push(Decoration.replace({}).range(block.openStart, block.openEnd));
      decorations.push(Decoration.replace({}).range(block.closeStart, block.closeEnd));
    }
  }

  return decorations;
}
