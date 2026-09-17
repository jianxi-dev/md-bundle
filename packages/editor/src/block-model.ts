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
 */
export interface Block {
  readonly from: number;
  readonly to: number;
  readonly type: BlockType;
  readonly node: unknown;
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

// --- getBlocks ---------------------------------------------------------------

/**
 * Walk the Lezer syntax tree and return all top-level blocks.
 *
 * Uses `Tree.cursor()` for efficient iteration — enters only the
 * top-level children of the Document node, not inline content.
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
      blocks.push({ from: node.from, to: node.to, type, node });
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
