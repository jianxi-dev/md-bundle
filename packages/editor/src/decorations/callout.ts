/**
 * Callout card decorations — Task 3.3.
 *
 * Parses markdown blockquote callout syntax (> [!TYPE] title + subsequent
 * > lines) and renders them as styled callout card widgets. Card colors/labels
 * come from the renderer's calloutTypeMap (single source of truth).
 *
 * Invalid callout types ([!FOO]) fall back to regular blockquote display.
 * Decorations are view-only: doc value must never change.
 *
 * Uses Decoration.replace with block: true to replace the entire callout
 * block range with a styled card. The widget is suppressed by the
 * selection-reveal filter when the cursor is inside the callout range.
 */
import { Decoration, WidgetType } from '@codemirror/view';
import type { Range } from '@codemirror/state';
import { calloutTypeMap } from '@md-bundle/renderer';

// --- Callout widget --------------------------------------------------------

/**
 * Widget that renders a callout card with tone-colored border and label.
 * Content is rendered as plain text (no HTML injection).
 */
class CalloutWidget extends WidgetType {
  constructor(
    readonly type: string,
    readonly label: string,
    readonly tone: string,
    readonly title: string,
    readonly content: string,
  ) {
    super();
  }

  toDOM(): HTMLElement {
    const container = document.createElement('div');
    container.className = `cm-callout cm-callout-tone-${this.tone}`;
    
    // Label badge
    const badge = document.createElement('span');
    badge.className = 'cm-callout-badge';
    badge.textContent = this.label;
    container.appendChild(badge);
    
    // Title (if present)
    if (this.title) {
      const titleEl = document.createElement('span');
      titleEl.className = 'cm-callout-title';
      titleEl.textContent = this.title;
      container.appendChild(titleEl);
    }
    
    // Content lines
    if (this.content) {
      const contentEl = document.createElement('div');
      contentEl.className = 'cm-callout-content';
      contentEl.textContent = this.content;
      container.appendChild(contentEl);
    }
    
    return container;
  }

  eq(other: CalloutWidget): boolean {
    return (
      this.type === other.type &&
      this.label === other.label &&
      this.tone === other.tone &&
      this.title === other.title &&
      this.content === other.content
    );
  }

  get estimatedHeight(): number {
    return 60; // Reasonable default for callout cards
  }
}

// --- Callout parsing -------------------------------------------------------

/**
 * Regex to match callout opening line: > [!TYPE] optional title
 * Captures: (1) type (case-insensitive), (2) optional title
 */
const CALLOUT_OPEN_RE = /^>\s*\[!([A-Za-z]+)\]\s*(.*)$/;

/**
 * Regex to match continuation line: > optional content
 * Captures: (1) content (may be empty)
 */
const CALLOUT_LINE_RE = /^>\s?(.*)$/;

/**
 * Find all callout blocks in the document text.
 * Returns an array of callout ranges with their parsed data.
 */
interface CalloutBlock {
  from: number;
  to: number;
  type: string;
  title: string;
  content: string;
}

function findCalloutBlocks(docText: string): CalloutBlock[] {
  const blocks: CalloutBlock[] = [];
  const lines = docText.split('\n');
  
  let i = 0;
  while (i < lines.length) {
    const openMatch = CALLOUT_OPEN_RE.exec(lines[i]);
    if (openMatch) {
      const type = openMatch[1].toLowerCase();
      const title = openMatch[2].trim();
      
      // Check if type is valid
      const typeInfo = calloutTypeMap[type];
      if (!typeInfo) {
        // Invalid type — skip (will be treated as regular blockquote)
        i++;
        continue;
      }
      
      // Find the start position of this line
      let from = 0;
      for (let j = 0; j < i; j++) {
        from += lines[j].length + 1; // +1 for \n
      }
      
      // Collect continuation lines
      const contentLines: string[] = [];
      let j = i + 1;
      while (j < lines.length) {
        const lineMatch = CALLOUT_LINE_RE.exec(lines[j]);
        if (lineMatch) {
          // Check if this line starts with > (blockquote continuation)
          if (lines[j].startsWith('>')) {
            contentLines.push(lineMatch[1]);
            j++;
          } else {
            break;
          }
        } else {
          break;
        }
      }
      
      // Calculate to position: exclusive end of the last callout line.
      // For block widget replacement, we need to cover the entire block
      // including the line content but NOT the trailing \n after the block.
      let to = from;
      for (let k = i; k < j; k++) {
        to += lines[k].length;
        if (k < j - 1) to += 1; // +1 for \n between lines
      }
      
      blocks.push({
        from,
        to,
        type,
        title,
        content: contentLines.join('\n'),
      });
      
      i = j;
    } else {
      i++;
    }
  }
  
  return blocks;
}

// --- Public API ------------------------------------------------------------

/**
 * Create callout decorations for the given document text.
 * Returns an array of CM6 Range<Decoration> for callout widgets.
 *
 * @param docText - The full document text
 * @returns Array of CM6 Range<Decoration> for callout widgets
 */
export function createCalloutDecorations(docText: string): Range<Decoration>[] {
  const decorations: Range<Decoration>[] = [];
  const blocks = findCalloutBlocks(docText);
  
  for (const block of blocks) {
    const typeInfo = calloutTypeMap[block.type];
    if (!typeInfo) continue;
    
    // Use Decoration.replace to hide the raw markdown and show the card.
    // Non-zero range [from, to) ensures selection-reveal filter works:
    // cursor inside range suppresses the widget and shows raw source.
    decorations.push(
      Decoration.replace({
        widget: new CalloutWidget(
          block.type,
          typeInfo.label,
          typeInfo.tone,
          block.title || typeInfo.label,
          block.content,
        ),
        inclusive: false,
      }).range(block.from, block.to),
    );
  }
  
  return decorations;
}
