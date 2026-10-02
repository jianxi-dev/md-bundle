/**
 * Block model — Lezer AST-based block traversal.
 *
 * Replaces the O(n) regex-scan decoration pipeline with targeted
 * AST walks. The Lezer syntax tree (already parsed by CM6's markdown
 * language) is the single source of truth for block boundaries.
 *
 * `getBlocks()` walks the top-level children of the document tree and
 * returns an array of `Block` descriptors. `getBlockAt()` performs a
 * binary search over that array for position-based lookup.
 *
 * Re-parse strategy: after an edit, call `getBlocks()` on the new
 * state — CM6's incremental parser already re-parses only the changed
 * region, so this is O(changed blocks), not O(document).
 */
import type { EditorState } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';

// --- Block type union --------------------------------------------------------

/**
 * Discriminant for the kind of block a `Block` represents.
 * Maps 1:1 to Lezer node names from @lezer/markdown.
 */
export type BlockType =
  | 'paragraph'
  | 'heading'
  | 'blockquote'
  | 'list'
  | 'task'
  | 'fencedCode'
  | 'codeBlock'
  | 'table'
  | 'thematicBreak'
  | 'image'
  | 'htmlBlock'
  | 'yamlFrontMatter';

// --- Block interface --------------------------------------------------------

/**
 * A top-level block in the document.
 *
 * `from`/`to` are document offsets (0-based, `to` exclusive).
 * `type` is the block discriminant.
 * `node` is the Lezer SyntaxNode for targeted decoration.
 * The node type is inferred from syntaxTree() — we use `unknown` to
 * avoid importing @lezer/common directly (not a direct dependency).
 * `level` is present only when `type === 'heading'` (1-6 for H1-H6).
 * `checked` is present only when `type === 'task'` (true if all items checked).
 */
export interface Block {
  readonly from: number;
  readonly to: number;
  readonly type: BlockType;
  readonly node: unknown;
  readonly level?: number;
  readonly checked?: boolean;
}

// --- Lezer node name → BlockType mapping ------------------------------------

/**
 * Maps Lezer markdown node names to our BlockType discriminant.
 * Only top-level block nodes appear here; inline nodes (Emphasis, …)
 * are not blocks.
 */
const BLOCK_TYPE_MAP: Record<string, BlockType> = {
  Paragraph: 'paragraph',
  ATXHeading1: 'heading',
  ATXHeading2: 'heading',
  ATXHeading3: 'heading',
  ATXHeading4: 'heading',
  ATXHeading5: 'heading',
  ATXHeading6: 'heading',
  SetextHeading1: 'heading',
  SetextHeading2: 'heading',
  Blockquote: 'blockquote',
  BulletList: 'list',
  OrderedList: 'list',
  FencedCode: 'fencedCode',
  CodeBlock: 'codeBlock',
  Table: 'table',
  HorizontalRule: 'thematicBreak',
  HTMLBlock: 'htmlBlock',
  Image: 'image',
};

/**
 * Resolve a Lezer SyntaxNode to a BlockType.
 * Returns null for non-block nodes (Document, inline nodes, etc.).
 */
function resolveBlockType(node: { name: string }): BlockType | null {
  return BLOCK_TYPE_MAP[node.name] ?? null;
}

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
 * Check if a list item's text starts with a task marker.
 * Matches bullet task markers: `^\s*[-*+] \[[ xX]\] `
 * Matches ordered task markers: `^\s*\d+\. \[[ xX]\] `
 */
function isTaskItem(text: string): boolean {
  return /^\s*[-*+] \[[ xX]\] /.test(text) || /^\s*\d+\. \[[ xX]\] /.test(text);
}

/**
 * Check if a task item's text indicates a checked state.
 * Matches `[x]`, `[X]`, `[ ]` (unchecked).
 */
function isTaskChecked(text: string): boolean {
  return /^\s*(?:[-*+]|\d+\.) \[[xX]\] /.test(text);
}

// --- getBlocks ---------------------------------------------------------------

/**
 * Walk the Lezer syntax tree and return all top-level blocks.
 *
 * Uses `Tree.cursor()` for efficient iteration — enters only the
 * top-level children of the Document node, not inline content.
 *
 * For heading blocks, extracts the heading level (1-6).
 * For list blocks, checks if all top-level items are task items.
 * If so, classifies as `task` with `checked` = true only if all items checked.
 *
 * @param state - The current EditorState (provides the syntax tree).
 * @returns Array of Block descriptors, sorted by `from` ascending.
 */
export function getBlocks(state: EditorState): Block[] {
  const blocks: Block[] = [];
  const tree = syntaxTree(state);

  // TreeCursor at the document root — iterate top-level children only.
  const cursor = tree.cursor();
  if (!cursor.firstChild()) return blocks;

  do {
    const node = cursor.node;
    const type = resolveBlockType(node);
    if (type !== null) {
      let level: number | undefined;
      let checked: boolean | undefined;
      let finalType = type;

      if (type === 'heading') {
        const lvl = headingLevel(node.name);
        if (lvl !== null) level = lvl;
      } else if (type === 'list') {
        // Walk into the list to inspect top-level ListItem children.
        // Classify as 'task' only if EVERY top-level item is a task item.
        // checked = true only if ALL items are checked.
        const listCursor = node.cursor();
        if (listCursor.firstChild()) {
          let allTask = true;
          let allChecked = true;
          let hasItems = false;

          do {
            const child = listCursor.node;
            if (child.name === 'ListItem') {
              hasItems = true;
              const itemText = state.doc.sliceString(child.from, child.to);
              if (!isTaskItem(itemText)) {
                allTask = false;
              } else if (!isTaskChecked(itemText)) {
                allChecked = false;
              }
            }
          } while (listCursor.nextSibling());

          if (hasItems && allTask) {
            finalType = 'task';
            checked = allChecked;
          }
        }
      }

      blocks.push({ from: node.from, to: node.to, type: finalType, node, level, checked });
    }
  } while (cursor.nextSibling());

  return blocks;
}

// --- getBlockAt --------------------------------------------------------------

/**
 * Binary search for the block containing position `pos`.
 *
 * Returns the block whose `[from, to)` range contains `pos`,
 * or null if no block matches (e.g. empty document).
 *
 * @param pos - Document offset to look up.
 * @param blocks - Sorted array of blocks (from `getBlocks`).
 * @returns The matching Block, or null.
 */
export function getBlockAt(pos: number, blocks: Block[]): Block | null {
  let lo = 0;
  let hi = blocks.length - 1;

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const block = blocks[mid];

    if (pos < block.from) {
      hi = mid - 1;
    } else if (pos >= block.to) {
      lo = mid + 1;
    } else {
      return block;
    }
  }

  return null;
}
