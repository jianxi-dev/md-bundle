/**
 * Structure linter — AST-based document diagnosis rules.
 *
 * Analyzes document structure using Lezer AST rules (NO LLM, completely offline).
 * Walks the block model to detect structural issues and returns diagnostics
 * that can be displayed as inline decorations in the editor.
 *
 * All rules are pure functions over the block model + document text — no
 * network calls, no external services, deterministic output.
 */
import type { EditorState } from '@codemirror/state';
import { getBlocks, type Block } from './block-model';

// --- Diagnostic interface ----------------------------------------------------

/**
 * A single diagnostic finding from the structure linter.
 *
 * `from`/`to` are document offsets (0-based, `to` exclusive) so the editor
 * can place inline decorations at the exact location.
 * `rule` is the stable rule identifier for filtering / documentation.
 */
export interface Diagnostic {
  severity: 'error' | 'warning' | 'info';
  message: string;
  from: number;
  to: number;
  rule: string;
}

/**
 * Result of a structure lint run — a list of diagnostics.
 */
export interface LintResult {
  diagnostics: Diagnostic[];
}

// --- Heading level helpers ----------------------------------------------------

/**
 * Extract the heading level from a Lezer heading node name.
 * Returns 1-6 for ATXHeading1-6 / SetextHeading1-2, or null for non-heading nodes.
 */
function headingLevel(nodeName: string): number | null {
  if (nodeName.startsWith('ATXHeading')) {
    const level = Number(nodeName.slice('ATXHeading'.length));
    if (level >= 1 && level <= 6) return level;
  }
  if (nodeName.startsWith('SetextHeading')) {
    const level = Number(nodeName.slice('SetextHeading'.length));
    if (level >= 1 && level <= 2) return level;
  }
  return null;
}

/**
 * Get the Lezer SyntaxNode name. Uses the node's `name` property which
 * is the standard Lezer interface.
 */
function nodeName(node: unknown): string {
  return (node as { name: string }).name;
}

// --- Rule 1: 论点无证据 -------------------------------------------------------

/**
 * Conclusion words that signal a claim is being made.
 * If a paragraph contains these but the next 2 paragraphs have no
 * list/quote/table evidence, emit a warning.
 */
const CONCLUSION_WORDS = /因此|所以|综上|由此可见|总而言之|换句话说|也就是说/;

/**
 * Check if a paragraph contains conclusion words and whether the next
 * `count` blocks contain supporting evidence (list/quote/table).
 */
function checkEvidence(blocks: Block[], index: number, docText: string): Diagnostic | null {
  const block = blocks[index];
  if (block.type !== 'paragraph') return null;

  const text = docText.slice(block.from, block.to);
  if (!CONCLUSION_WORDS.test(text)) return null;

  // Look at the next 2 blocks for evidence (list/quote/table).
  let hasEvidence = false;
  for (let i = index + 1; i <= index + 2 && i < blocks.length; i++) {
    const t = blocks[i].type;
    if (t === 'list' || t === 'blockquote' || t === 'table') {
      hasEvidence = true;
      break;
    }
  }

  if (!hasEvidence) {
    return {
      severity: 'warning',
      message: '结论性段落缺少支撑证据（列表/引用/表格）',
      from: block.from,
      to: block.to,
      rule: 'missing-evidence',
    };
  }
  return null;
}

// --- Rule 2: 章节无结论 -------------------------------------------------------

/**
 * An H2/H3 section with > 3 paragraphs but no concluding paragraph
 * (a paragraph ending with conclusion words) emits an info diagnostic.
 */
function checkSectionConclusion(blocks: Block[], docText: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.type !== 'heading') continue;

    const level = headingLevel(nodeName(block.node));
    if (level === null || level > 3) continue; // Only H2/H3

    // Collect paragraphs in this section (until next heading or end).
    let paragraphCount = 0;
    let hasConclusion = false;
    for (let j = i + 1; j < blocks.length; j++) {
      const next = blocks[j];
      if (next.type === 'heading') break;
      if (next.type === 'paragraph') {
        paragraphCount++;
        const text = docText.slice(next.from, next.to);
        if (CONCLUSION_WORDS.test(text)) {
          hasConclusion = true;
        }
      }
    }

    if (paragraphCount > 3 && !hasConclusion) {
      diagnostics.push({
        severity: 'info',
        message: `H${level} 章节有 ${paragraphCount} 段但缺少总结性段落`,
        from: block.from,
        to: block.to,
        rule: 'section-no-conclusion',
      });
    }
  }

  return diagnostics;
}

// --- Rule 3: 重复论点 ---------------------------------------------------------

/**
 * Jaccard similarity between two sets of characters.
 * Used to detect sections with overly similar title keywords.
 */
function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(''));
  const setB = new Set(b.toLowerCase().split(''));

  if (setA.size === 0 && setB.size === 0) return 0;

  let intersection = 0;
  for (const char of setA) {
    if (setB.has(char)) intersection++;
  }

  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Extract heading text content from a heading block.
 */
function headingText(block: Block, docText: string): string {
  const raw = docText.slice(block.from, block.to);
  // Strip leading # characters and whitespace.
  return raw.replace(/^#+\s*/, '').replace(/\s*#+\s*$/, '').trim();
}

/**
 * Check for sections with title keywords that have Jaccard similarity > 0.6.
 */
function checkDuplicateArguments(blocks: Block[], docText: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const headings = blocks.filter((b) => b.type === 'heading');

  for (let i = 0; i < headings.length; i++) {
    for (let j = i + 1; j < headings.length; j++) {
      const textA = headingText(headings[i], docText);
      const textB = headingText(headings[j], docText);

      if (textA.length < 2 || textB.length < 2) continue;

      const similarity = jaccardSimilarity(textA, textB);
      if (similarity > 0.6) {
        diagnostics.push({
          severity: 'warning',
          message: `标题相似度较高（${(similarity * 100).toFixed(0)}%）："${textA}" vs "${textB}"`,
          from: headings[j].from,
          to: headings[j].to,
          rule: 'duplicate-argument',
        });
      }
    }
  }

  return diagnostics;
}

// --- Rule 4: 标题层级跳跃 -----------------------------------------------------

/**
 * Detect heading level jumps > 1 (e.g., H1 → H3).
 */
function checkHeadingJumps(blocks: Block[]): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  let lastLevel = 0;

  for (const block of blocks) {
    if (block.type !== 'heading') continue;

    const level = headingLevel(nodeName(block.node));
    if (level === null) continue;

    if (lastLevel > 0 && level - lastLevel > 1) {
      diagnostics.push({
        severity: 'error',
        message: `标题层级跳跃：H${lastLevel} → H${level}（跳过 H${lastLevel + 1}）`,
        from: block.from,
        to: block.to,
        rule: 'heading-skip',
      });
    }

    lastLevel = level;
  }

  return diagnostics;
}

// --- Rule 5: 超长段落 ---------------------------------------------------------

/**
 * Detect paragraphs exceeding 300 characters.
 */
function checkLongParagraphs(blocks: Block[], docText: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const MAX_LENGTH = 300;

  for (const block of blocks) {
    if (block.type !== 'paragraph') continue;

    const text = docText.slice(block.from, block.to);
    if (text.length > MAX_LENGTH) {
      diagnostics.push({
        severity: 'info',
        message: `段落过长（${text.length} 字，建议 ≤ ${MAX_LENGTH} 字）`,
        from: block.from,
        to: block.to,
        rule: 'long-paragraph',
      });
    }
  }

  return diagnostics;
}

// --- Rule 6: 列表项长度失衡 ---------------------------------------------------

/**
 * Detect lists where the longest item is > 5x the shortest.
 * Walks into the Lezer tree to find ListItem children and measure their text length.
 */
function checkListBalance(blocks: Block[], state: EditorState): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const block of blocks) {
    if (block.type !== 'list') continue;

    // Walk into the list node to find ListItem children.
    const node = block.node as { from: number; to: number; cursor: () => TreeCursorLike };
    const cursor = node.cursor();
    if (!cursor.firstChild()) continue;

    const itemLengths: number[] = [];
    do {
      const child = cursor.node;
      if (nodeName(child) === 'ListItem') {
        const text = state.doc.sliceString(child.from, child.to);
        itemLengths.push(text.length);
      }
    } while (cursor.nextSibling());

    if (itemLengths.length < 2) continue;

    const min = Math.min(...itemLengths);
    const max = Math.max(...itemLengths);

    if (min > 0 && max > min * 5) {
      diagnostics.push({
        severity: 'info',
        message: `列表项长度失衡（最长 ${max} 字 / 最短 ${min} 字 > 5x）`,
        from: block.from,
        to: block.to,
        rule: 'list-imbalance',
      });
    }
  }

  return diagnostics;
}

// --- Rule 7: 空标题 -----------------------------------------------------------

/**
 * Detect heading nodes immediately followed by another heading node
 * (no content between them).
 */
function checkEmptyHeadings(blocks: Block[]): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (let i = 0; i < blocks.length - 1; i++) {
    const current = blocks[i];
    const next = blocks[i + 1];

    if (current.type === 'heading' && next.type === 'heading') {
      diagnostics.push({
        severity: 'warning',
        message: '空标题：连续标题之间缺少内容',
        from: current.from,
        to: current.to,
        rule: 'empty-heading',
      });
    }
  }

  return diagnostics;
}

// --- Rule 8: 孤立的图片 -------------------------------------------------------

/**
 * Detect images with no surrounding text within 2 blocks.
 *
 * In Lezer's markdown parser, standalone images are wrapped in a Paragraph
 * node at the top level. We detect image blocks by checking if a paragraph
 * contains an Image child node. An image is "orphaned" if there are no
 * paragraph blocks with text content within ±2 positions.
 */
function checkOrphanedImages(blocks: Block[], state: EditorState): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.type !== 'paragraph') continue;

    // Check if this paragraph contains an Image node.
    const node = block.node as { cursor: () => TreeCursorLike };
    const cursor = node.cursor();
    if (!cursor.firstChild()) continue;

    let hasImage = false;
    do {
      if (nodeName(cursor.node) === 'Image') {
        hasImage = true;
        break;
      }
    } while (cursor.nextSibling());

    if (!hasImage) continue;

    // Check surrounding blocks (±2) for text content.
    let hasNearbyText = false;
    for (let j = Math.max(0, i - 2); j <= Math.min(blocks.length - 1, i + 2); j++) {
      if (j === i) continue;
      const neighbor = blocks[j];
      if (neighbor.type === 'paragraph') {
        const text = state.doc.sliceString(neighbor.from, neighbor.to).trim();
        if (text.length > 0) {
          hasNearbyText = true;
          break;
        }
      }
    }

    if (!hasNearbyText) {
      diagnostics.push({
        severity: 'info',
        message: '孤立的图片：图片周围缺少文字说明',
        from: block.from,
        to: block.to,
        rule: 'orphaned-image',
      });
    }
  }

  return diagnostics;
}

// --- TreeCursorLike interface -------------------------------------------------

/**
 * Minimal interface for Lezer TreeCursor — only the methods we use.
 * This avoids importing @lezer/common directly.
 */
interface TreeCursorLike {
  node: { from: number; to: number; name: string };
  firstChild(): boolean;
  nextSibling(): boolean;
}

// --- Main lint function -------------------------------------------------------

/**
 * Run the structure linter on the given editor state.
 *
 * Walks the Lezer syntax tree via the block model and applies all
 * diagnostic rules. Returns a LintResult with all findings.
 *
 * Pure function — no side effects, no network calls, deterministic.
 *
 * @param state - The current EditorState (provides syntax tree + document).
 * @returns LintResult with all diagnostics found.
 */
export function lintStructure(state: EditorState): LintResult {
  const blocks = getBlocks(state);
  const docText = state.doc.toString();
  const diagnostics: Diagnostic[] = [];

  // Rule 4: heading level jumps (doesn't need docText).
  diagnostics.push(...checkHeadingJumps(blocks));

  // Rule 7: empty headings (consecutive headings).
  diagnostics.push(...checkEmptyHeadings(blocks));

  // Rule 2: section without conclusion.
  diagnostics.push(...checkSectionConclusion(blocks, docText));

  // Rule 3: duplicate arguments (similar titles).
  diagnostics.push(...checkDuplicateArguments(blocks, docText));

  // Rule 5: long paragraphs.
  diagnostics.push(...checkLongParagraphs(blocks, docText));

  // Rule 6: list item length imbalance (needs state for tree access).
  diagnostics.push(...checkListBalance(blocks, state));

  // Rule 8: orphaned images (needs state to walk into paragraph children).
  diagnostics.push(...checkOrphanedImages(blocks, state));

  // Rule 1: missing evidence (per-paragraph check).
  for (let i = 0; i < blocks.length; i++) {
    const finding = checkEvidence(blocks, i, docText);
    if (finding) diagnostics.push(finding);
  }

  // Sort by document position for consistent display.
  diagnostics.sort((a, b) => a.from - b.from);

  return { diagnostics };
}

// --- Editor integration: decoration extension ---------------------------------

/**
 * CM6 extension that runs the structure linter and can display diagnostics
 * as inline decorations.
 *
 * Inline rendering is OFF by default (issue #206) and opt-in via the
 * "结构体检" command; `lintStructure` above remains the always-available
 * source for the left-rail panel.
 *
 * Usage:
 * ```ts
 * import { structureLinter } from '@md-bundle/editor';
 * createMarkdownEditor(parent, { extensions: [structureLinter()] });
 * ```
 */
export { structureLinterExtension } from './structure-linter-extension';
