/**
 * Block handle pure helpers — issue #189.
 *
 * No editor or DOM access lives here, so every function is unit-testable
 * without jsdom layout. `block-handle.ts` re-exports these as the single
 * import surface for the block handle; consumers never import this file
 * directly.
 *
 * Block boundaries come from `block-model.ts` (Lezer AST) — never a regex
 * re-parse of the Markdown source.
 */
import type { EditorState } from '@codemirror/state'
import { getBlocks, getBlockAt, type Block } from './block-model'

/** Target of the 转换为 menu group. */
export type BlockConvertTarget = 'h1' | 'h2' | 'h3' | 'paragraph'

const HEADING_LEVEL: Record<'h1' | 'h2' | 'h3', number> = { h1: 1, h2: 2, h3: 3 }

/**
 * Return the top-level block containing `pos`, or null when there is none.
 * Thin composition of the block model so callers can stay on one import.
 */
export function findBlockAt(state: EditorState, pos: number): Block | null {
  return getBlockAt(pos, getBlocks(state))
}

/**
 * Resolve a 1-based line number to its starting offset.
 * Line numbers at or beyond the end clamp to the document length (append);
 * line 1 (or lower) resolves to the document start.
 */
function offsetOfLine(docText: string, line: number): number {
  if (line <= 1) return 0
  let offset = 0
  for (let current = 1; current < line; current++) {
    const next = docText.indexOf('\n', offset)
    if (next === -1) return docText.length
    offset = next + 1
  }
  return offset
}

/** Strip leading/trailing newlines so blocks rejoin with a single blank line. */
function trimNewlines(text: string): string {
  return text.replace(/^\n+/, '').replace(/\n+$/, '')
}

/**
 * Move a top-level block to `targetLine` (a 1-based line number in `docText`),
 * inserting it before that line. Dropping inside the block itself is a no-op.
 * Blocks rejoin with exactly one blank line, matching the document convention.
 *
 * @param docText - Full document text.
 * @param blockFrom - Start offset of the block to move.
 * @param blockTo - End offset (exclusive) of the block to move.
 * @param targetLine - 1-based line number to insert before.
 * @returns The new document text.
 */
export function computeBlockMove(
  docText: string,
  blockFrom: number,
  blockTo: number,
  targetLine: number,
): string {
  if (blockTo <= blockFrom) return docText
  const targetPos = offsetOfLine(docText, targetLine)
  // Dropping inside the dragged block keeps the document unchanged.
  if (targetPos >= blockFrom && targetPos < blockTo) return docText

  const blockText = docText.slice(blockFrom, blockTo)
  if (blockText.length === 0) return docText

  const rest = docText.slice(0, blockFrom) + docText.slice(blockTo)
  // When the target sat after the source, its offset shifted left by the cut.
  const shifted = targetPos > blockFrom ? targetPos - (blockTo - blockFrom) : targetPos
  const insertPos = Math.max(0, Math.min(shifted, rest.length))

  const before = trimNewlines(rest.slice(0, insertPos))
  const after = trimNewlines(rest.slice(insertPos))
  const moved = trimNewlines(blockText)

  const parts: string[] = []
  if (before.length > 0) parts.push(before)
  parts.push(moved)
  if (after.length > 0) parts.push(after)
  return parts.join('\n\n')
}

/**
 * Convert the first line of a block to a heading level or a paragraph.
 * Existing ATX markers are stripped first, so h1 -> h3 does not nest `#`.
 * Only the first line changes; the rest of the block stays body text.
 */
export function computeBlockConvert(
  docText: string,
  blockFrom: number,
  blockTo: number,
  target: BlockConvertTarget,
): string {
  const blockText = docText.slice(blockFrom, blockTo)
  if (blockText.length === 0) return docText

  const newline = blockText.indexOf('\n')
  const firstLine = newline === -1 ? blockText : blockText.slice(0, newline)
  const remainder = newline === -1 ? '' : blockText.slice(newline)
  const stripped = firstLine.replace(/^\s*#{1,6}\s+/, '').replace(/^\s*#{1,6}\s*$/, '')
  const prefix = target === 'paragraph' ? '' : `${'#'.repeat(HEADING_LEVEL[target])} `
  return docText.slice(0, blockFrom) + prefix + stripped + remainder + docText.slice(blockTo)
}

/** Insert a copy of the block immediately after it, separated by a blank line. */
export function computeBlockDuplicate(docText: string, blockFrom: number, blockTo: number): string {
  const blockText = docText.slice(blockFrom, blockTo)
  if (blockText.length === 0) return docText
  return docText.slice(0, blockTo) + '\n\n' + blockText + docText.slice(blockTo)
}

/**
 * Remove a block and normalize blank lines only at the deletion seam.
 * Bytes outside the removed block's neighbourhood are never touched, and a
 * document that ended in a newline still ends in one afterwards.
 */
export function computeBlockDelete(docText: string, blockFrom: number, blockTo: number): string {
  if (blockTo <= blockFrom) return docText
  const before = trimNewlines(docText.slice(0, blockFrom))
  const after = trimNewlines(docText.slice(blockTo))
  const parts: string[] = []
  if (before.length > 0) parts.push(before)
  if (after.length > 0) parts.push(after)
  const joined = parts.join('\n\n')
  if (joined.length === 0) return ''
  return docText.endsWith('\n') ? `${joined}\n` : joined
}
