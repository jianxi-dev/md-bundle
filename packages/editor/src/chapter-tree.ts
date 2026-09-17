/**
 * Chapter tree — pure data model for document heading hierarchy.
 *
 * Builds a tree from the block model (getBlocks) that represents the
 * document's heading structure. Supports:
 * - Tree visualization (nested headings with indentation)
 * - Section boundaries (a heading + all content until the next same-or-higher-level heading)
 * - Move section (cut + paste at target position)
 * - Extract subtree (heading + content as standalone document)
 *
 * All functions are pure — they take blocks + doc text and return new data
 * structures. No editor state mutation happens here.
 */
import { getBlocks } from './block-model';

// --- Heading node name → level -----------------------------------------------

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
 * Get the Lezer SyntaxNode name.
 */
function nodeName(node: unknown): string {
  return (node as { name: string }).name;
}

// --- HeadingEntry ------------------------------------------------------------

/**
 * A heading entry extracted from the block model.
 * `level` is 1-6, `from`/`to` are document offsets of the heading line,
 * `text` is the heading text content (without # markers).
 */
export interface HeadingEntry {
  readonly level: number;
  readonly from: number;
  readonly to: number;
  readonly text: string;
}

/**
 * Extract heading entries from the block model.
 * Uses getBlocks() for AST-based traversal — O(headings), not O(document).
 *
 * @param state - The current EditorState.
 * @returns Array of HeadingEntry, sorted by document position.
 */
export function getHeadings(state: import('@codemirror/state').EditorState): HeadingEntry[] {
  const blocks = getBlocks(state);
  const docText = state.doc.toString();
  const headings: HeadingEntry[] = [];

  for (const block of blocks) {
    if (block.type !== 'heading') continue;
    const level = headingLevel(nodeName(block.node));
    if (level === null) continue;

    const raw = docText.slice(block.from, block.to);
    const text = raw.replace(/^#+\s*/, '').replace(/\s*#+\s*$/, '').trim();
    headings.push({ level, from: block.from, to: block.to, text });
  }

  return headings;
}

// --- TreeNode ----------------------------------------------------------------

/**
 * A node in the chapter tree.
 * Each node represents a heading and its children (sub-headings).
 * `children` is empty for leaf headings.
 */
export interface TreeNode {
  readonly heading: HeadingEntry;
  readonly children: readonly TreeNode[];
}

/**
 * Build a chapter tree from heading entries.
 *
 * The tree reflects the heading hierarchy: an H2 becomes a child of the
 * preceding H1, an H3 becomes a child of the preceding H2, etc.
 *
 * Headings at a deeper level than their predecessor (e.g. H1 → H3) are
 * attached to the nearest ancestor with a lower level.
 *
 * Uses a stack of children arrays to build the tree in a single pass
 * without mutating already-placed nodes.
 *
 * @param headings - Sorted array of HeadingEntry (from getHeadings).
 * @returns Root-level TreeNode array (the forest).
 */
export function buildTree(headings: HeadingEntry[]): TreeNode[] {
  if (headings.length === 0) return [];

  // Stack frames hold the level and the children array being built at that level.
  // The sentinel frame (level 0) holds the roots array — it is never popped
  // because all heading levels are >= 1.
  // We use a mutable internal type during construction, then the returned
  // TreeNode[] is treated as readonly by consumers.
  const roots: TreeNode[] = [];
  const stack: { level: number; children: TreeNode[] }[] = [
    { level: 0, children: roots },
  ];

  for (const heading of headings) {
    // Pop stack until the top frame has a strictly lower level.
    while (stack.length > 1 && stack[stack.length - 1].level >= heading.level) {
      stack.pop();
    }

    const parent = stack[stack.length - 1];
    const children: TreeNode[] = [];
    const node: TreeNode = { heading, children };
    parent.children.push(node);
    stack.push({ level: heading.level, children });
  }

  return roots;
}

// --- Section boundaries ------------------------------------------------------

/**
 * A section is a heading plus all content until the next heading of the
 * same or higher level (or end of document).
 *
 * `from` is the start of the heading line.
 * `to` is the end of the last block in the section (exclusive).
 */
export interface Section {
  readonly heading: HeadingEntry;
  readonly from: number;
  readonly to: number;
}

/**
 * Compute section boundaries from heading entries and document length.
 *
 * A section starts at a heading and ends just before the next heading
 * with level ≤ the section's heading level, or at the end of the document.
 *
 * @param headings - Sorted array of HeadingEntry.
 * @param docLength - Total document length (for the last section's end).
 * @returns Array of Section descriptors.
 */
export function computeSections(headings: HeadingEntry[], docLength: number): Section[] {
  if (headings.length === 0) return [];

  const sections: Section[] = [];

  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];
    // Find the next heading with level ≤ this heading's level.
    let endPos = docLength;
    for (let j = i + 1; j < headings.length; j++) {
      if (headings[j].level <= heading.level) {
        // The section ends at the start of that heading's line.
        endPos = headings[j].from;
        break;
      }
    }

    sections.push({
      heading,
      from: heading.from,
      to: endPos,
    });
  }

  return sections;
}

// --- Move section ------------------------------------------------------------

/**
 * Result of a moveSection operation.
 * `newText` is the full document text after the move.
 */
export interface MoveResult {
  readonly newText: string;
}

/**
 * Move a section from one position to another in the document.
 *
 * Cuts the source section (heading + content) out of the document,
 * then inserts it at the target position. The target is expressed as
 * the index of the heading where the section should be inserted *before*.
 * If `targetIndex` equals the number of headings, the section is appended
 * at the end.
 *
 * Ensures proper newline separation between the moved section and
 * surrounding content.
 *
 * @param docText - The full document text.
 * @param sections - Section boundaries (from computeSections).
 * @param sourceIndex - Index of the section to move.
 * @param targetIndex - Index of the heading to insert before (0-based over headings).
 * @returns MoveResult with the new document text.
 */
export function moveSection(
  docText: string,
  sections: Section[],
  sourceIndex: number,
  targetIndex: number,
): MoveResult {
  if (sourceIndex < 0 || sourceIndex >= sections.length) {
    return { newText: docText };
  }

  // No-op: moving a section to its own position.
  if (targetIndex === sourceIndex) {
    return { newText: docText };
  }

  const source = sections[sourceIndex];
  const movedText = docText.slice(source.from, source.to);

  // Remove the source section.
  const afterCut =
    docText.slice(0, source.from) + docText.slice(source.to);

  // Compute the insertion point in the cut document.
  let insertPos: number;

  if (targetIndex >= sections.length) {
    // Append at end.
    insertPos = afterCut.length;
  } else if (targetIndex < 0) {
    insertPos = 0;
  } else {
    const targetHeading = sections[targetIndex].heading;
    // Find the target heading's position in the cut document.
    // If the target was after the source, its position shifted by the cut length.
    const shift = targetHeading.from > source.from ? -(source.to - source.from) : 0;
    insertPos = targetHeading.from + shift;
  }

  // Build the new document with proper newline handling.
  // Sections in the source doc are separated by exactly one blank line (\n\n).
  // When we move a section, we must preserve this convention.
  const before = afterCut.slice(0, insertPos);
  const after = afterCut.slice(insertPos);

  // Normalize: strip surrounding newlines from before/after so we can join
  // with exactly \n\n separators. The moved text is also trimmed of trailing newlines.
  const beforeTrimmed = before.replace(/\n+$/, '');
  const afterTrimmed = after.replace(/^\n+/, '').replace(/\n+$/, '');
  const movedTrimmed = movedText.replace(/\n+$/, '');

  const parts: string[] = [];
  if (beforeTrimmed.length > 0) parts.push(beforeTrimmed);
  parts.push(movedTrimmed);
  if (afterTrimmed.length > 0) parts.push(afterTrimmed);

  const newText = parts.join('\n\n');

  return { newText };
}

// --- Extract subtree ---------------------------------------------------------

/**
 * Extract a section (heading + all content) as a standalone document.
 *
 * The extracted text includes the heading and everything until the next
 * same-level heading. Child headings are demoted by `demoteBy` levels
 * (default 0 = keep original levels). Use demoteBy=1 to make an H2 section
 * start with H1 in the extracted document.
 *
 * @param docText - The full document text.
 * @param section - The section to extract.
 * @param demoteBy - Number of levels to demote headings (0 = no change).
 * @returns The extracted document text.
 */
export function extractSubtree(docText: string, section: Section, demoteBy = 0): string {
  const raw = docText.slice(section.from, section.to);
  if (demoteBy <= 0) return raw;

  // Demote headings: replace leading # with fewer #s.
  // We only modify heading lines that start with #.
  const lines = raw.split('\n');
  const result: string[] = [];

  for (const line of lines) {
    const match = line.match(/^(#{1,6})(\s+.*)$/);
    if (match) {
      const level = match[1].length;
      const rest = match[2];
      const newLevel = Math.min(level + demoteBy, 6);
      result.push('#'.repeat(newLevel) + rest);
    } else {
      result.push(line);
    }
  }

  return result.join('\n');
}

// --- Flatten tree to list (for rendering) ------------------------------------

/**
 * Flatten a chapter tree to a list suitable for rendering.
 * Each entry includes the depth level for indentation.
 */
export interface FlatNode {
  readonly node: TreeNode;
  readonly depth: number;
}

/**
 * Flatten a chapter tree to a depth-first ordered list.
 *
 * @param roots - Root nodes of the chapter tree.
 * @returns Flattened list with depth information.
 */
export function flattenTree(roots: TreeNode[]): FlatNode[] {
  const result: FlatNode[] = [];

  function walk(node: TreeNode, depth: number): void {
    result.push({ node, depth });
    for (const child of node.children) {
      walk(child, depth + 1);
    }
  }

  for (const root of roots) {
    walk(root, 0);
  }

  return result;
}
