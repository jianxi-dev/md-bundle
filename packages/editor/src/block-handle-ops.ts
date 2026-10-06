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
import type { EditorView } from '@codemirror/view'
import type { EditorState } from '@codemirror/state'
import { getBlocks, getBlockAt, type Block } from './block-model'

// Minimal Lezer SyntaxNode shape for tree traversal (avoids @lezer/common dep).
interface LezerNode {
  readonly name: string
  readonly parent: LezerNode | null
}

/**
 * GFM table line detection — reused from decorations/table.ts.
 * A table line is either a pipe row (header/body) or a separator row.
 */
const TABLE_ROW_RE = /^\s*\|.*\|\s*$/
const TABLE_SEP_RE = /^\s*\|(\s*:?-+:?\s*\|)+\s*$/

/** Check if a line's text is a GFM table row (header, separator, or body). */
export function isTableLine(text: string): boolean {
  return TABLE_ROW_RE.test(text) || TABLE_SEP_RE.test(text)
}

/**
 * True when a block's source is a GFM pipe table: a header row immediately
 * followed by a separator row.
 *
 * The editor's markdown language is CommonMark (no GFM table extension), so the
 * Lezer tree never emits a `Table` node — a table reaches the block model as a
 * `paragraph` (#392). Table-aware UI must therefore key off the source text, not
 * `block.type`; `blockHandleIcon` already does the same via `isTableLine`.
 */
export function isTableBlock(blockText: string): boolean {
  const lines = blockText.split('\n')
  return lines.length >= 2 && TABLE_ROW_RE.test(lines[0]) && TABLE_SEP_RE.test(lines[1])
}

/**
 * Shared gutter-x helper: returns the left position (relative to editor root)
 * for the handle / empty-line "+" column. Both affordances use this so their
 * x coordinates align within ≤2px (F-06).
 */
export function computeGutterLeft(view: EditorView): number {
  const contentDOM = view.contentDOM
  const contentRect = contentDOM.getBoundingClientRect()
  const paddingLeft = parseFloat(getComputedStyle(contentDOM).paddingLeft) || 0
  const contentLeft = contentRect.left + paddingLeft
  const r = view.dom.getBoundingClientRect()
  // Handle is 42px wide; its right edge sits at contentLeft - 2px gap.
  // So handle left = contentLeft - 2 - 42 = contentLeft - 44.
  return contentLeft - r.left - 44
}

/** Target of the 转换为 menu group (legacy, first-line only). */
export type BlockConvertTarget =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'paragraph'
  | 'ordered'
  | 'bullet'
  | 'todo'
  | 'code'
  | 'quote'
  | 'callout'

/** Target of the 转换 dropdown (whole-block, per-line). */
export type BlockTurnIntoTarget =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'paragraph'
  | 'ordered'
  | 'bullet'
  | 'list'
  | 'task'
  | 'todo'
  | 'quote'
  | 'code'
  | 'callout'
  | 'table'

const HEADING_LEVEL: Record<'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6', number> = {
  h1: 1,
  h2: 2,
  h3: 3,
  h4: 4,
  h5: 5,
  h6: 6,
}

/**
 * Return the top-level block containing `pos`, or null when there is none.
 * Thin composition of the block model so callers can stay on one import.
 */
export function findBlockAt(state: EditorState, pos: number): Block | null {
  return getBlockAt(pos, getBlocks(state))
}

/**
 * Check if a block still exists in the given state by comparing from/to/type.
 * Pure helper for update() re-anchor logic.
 */
export function blockStillExists(state: EditorState, block: Block): boolean {
  const blocks = getBlocks(state)
  return blocks.some((b) => b.from === block.from && b.to === block.to && b.type === block.type)
}

/**
 * Check if a block is currently visible within the scroll viewport.
 * Uses coordsAtPos for precise viewport overlap; returns false if coords unavailable.
 */
export function isBlockInViewport(
  view: {
    coordsAtPos: (pos: number) => { top: number; bottom: number } | null
    scrollDOM: { getBoundingClientRect: () => { top: number; bottom: number } }
  },
  block: Block,
): boolean {
  const topCoords = view.coordsAtPos(block.from)
  const bottomCoords = view.coordsAtPos(block.to)
  if (!topCoords || !bottomCoords) return false

  const scrollRect = view.scrollDOM.getBoundingClientRect()
  const blockTop = topCoords.top
  const blockBottom = bottomCoords.bottom

  return blockBottom > scrollRect.top && blockTop < scrollRect.bottom
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

  // The 10-item convert grid includes whole-block targets (ordered/bullet/todo/
  // code/quote/callout); only the heading + paragraph targets convert first-line.
  if (target !== 'paragraph' && !(target in HEADING_LEVEL)) {
    return computeBlockTurnInto(docText, blockFrom, blockTo, target as BlockTurnIntoTarget)
  }

  const newline = blockText.indexOf('\n')
  const firstLine = newline === -1 ? blockText : blockText.slice(0, newline)
  const remainder = newline === -1 ? '' : blockText.slice(newline)
  const stripped = firstLine.replace(/^\s*#{1,6}\s+/, '').replace(/^\s*#{1,6}\s*$/, '')
  const headingTarget = target as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  const prefix = target === 'paragraph' ? '' : `${'#'.repeat(HEADING_LEVEL[headingTarget])} `
  return docText.slice(0, blockFrom) + prefix + stripped + remainder + docText.slice(blockTo)
}

/**
 * Strip common block-level markers from a line.
 * Handles: ATX headings (#...), callouts/quotes (> [!TYPE]? / >), task items (- [ ] ),
 * bullet lists (- * +), ordered lists (1. ).
 * Does NOT strip inline markdown markers (**, *, __, _, ~~, `) — those are preserved.
 */
function stripBlockMarkers(line: string): string {
  return line
    .replace(/^\s*#{1,6}\s+/, '') // ATX heading
    .replace(/^\s*#{1,6}\s*$/, '') // ATX heading only
    .replace(/^\s*>\s*\[![\w-]+\]\s*/, '') // Callout marker > [!NOTE]
    .replace(/^\s*>\s*/, '') // Blockquote marker >
    .replace(/^\s*-\s*\[\s*[xX]?\s*\]\s*/, '') // Task item - [ ] / - [x]
    .replace(/^\s*[-*+]\s+/, '') // Bullet list - * +
    .replace(/^\s*\d+\.\s+/, '') // Ordered list 1. 2.
}

/**
 * Convert a whole block (all non-blank lines) to the target type.
 * Unlike computeBlockConvert, this rewrites EVERY non-blank line in the block.
 * Existing block markers are stripped before applying new ones.
 *
 * @param docText - Full document text.
 * @param blockFrom - Start offset of the block (inclusive).
 * @param blockTo - End offset of the block (exclusive).
 * @param target - Target block type.
 * @returns New document text with the block converted.
 */
export function computeBlockTurnInto(
  docText: string,
  blockFrom: number,
  blockTo: number,
  target: BlockTurnIntoTarget,
): string {
  const blockText = docText.slice(blockFrom, blockTo)
  if (blockText.length === 0) return docText

  const lines = blockText.split('\n')
  const processedLines: string[] = []

  if (target === 'code') {
    // Wrap entire block in fenced code block
    const content = lines.join('\n')
    const wrapped = '```\n' + content + '\n```'
    return docText.slice(0, blockFrom) + wrapped + docText.slice(blockTo)
  }

  if (target === 'table') {
    // Construct GFM table from non-blank lines: single column, each line = one row
    const nonBlankLines = lines.filter((l) => l.trim().length > 0)
    if (nonBlankLines.length === 0) return docText
    const headerRow = '| ' + nonBlankLines[0].trim() + ' |'
    const separatorRow = '| --- |'
    const dataRows = nonBlankLines
      .slice(1)
      .map((line) => '| ' + line.trim() + ' |')
    const tableLines = [headerRow, separatorRow, ...dataRows]
    const tableText = tableLines.join('\n')
    return docText.slice(0, blockFrom) + tableText + docText.slice(blockTo)
  }

  // For all other targets, process each line
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.length === 0) {
      // Preserve blank lines as-is
      processedLines.push('')
      continue
    }
    const stripped = stripBlockMarkers(line)
    let prefix = ''
    switch (target) {
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        prefix = '#'.repeat(HEADING_LEVEL[target]) + ' '
        break
      case 'paragraph':
        prefix = ''
        break
      case 'ordered':
        prefix = '1. '
        break
      case 'bullet':
      case 'list':
        prefix = '- '
        break
      case 'task':
      case 'todo':
        prefix = '- [ ] '
        break
      case 'quote':
        prefix = '> '
        break
      case 'callout':
        // First non-blank line gets > [!NOTE], rest get >
        if (processedLines.length === 0 || processedLines.every((l) => l.trim().length === 0)) {
          prefix = '> [!NOTE] '
        } else {
          prefix = '> '
        }
        break
    }
    processedLines.push(prefix + stripped)
  }

  const newBlockText = processedLines.join('\n')
  return docText.slice(0, blockFrom) + newBlockText + docText.slice(blockTo)
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

/** A single CM6 change replacing one range with `insert`. */
export interface MinimalChange {
  from: number
  to: number
  insert: string
}

/**
 * Minimal change turning `oldText` into `next`, trimming the common prefix and
 * suffix. Dispatching only the changed range keeps the viewport and selection
 * stable, instead of replacing the whole document on every block edit (#239).
 */
export function computeMinimalChange(oldText: string, next: string): MinimalChange {
  let from = 0
  const maxPrefix = Math.min(oldText.length, next.length)
  while (from < maxPrefix && oldText[from] === next[from]) from++

  let oldEnd = oldText.length
  let newEnd = next.length
  while (oldEnd > from && newEnd > from && oldText[oldEnd - 1] === next[newEnd - 1]) {
    oldEnd--
    newEnd--
  }
  return { from, to: oldEnd, insert: next.slice(from, newEnd) }
}

/**
 * Resolve the `data-icon` name for a block handle. Pure and total over
 * BlockType — adding a new BlockType causes a type error here. The returned
 * name is consumed by `renderIcon` (icons.ts) and asserted via `data-icon`
 * (ticket #322: contract changed from a text glyph to a data-icon name).
 */
export function blockHandleIcon(block: Block, blockText?: string, lineText?: string): string {
  // If the block is a paragraph, check if it's inside a table cell/row.
  // Traverse up the syntax tree to find a Table/TableRow/TableCell ancestor.
  if (block.type === 'paragraph' && block.node) {
    let node: LezerNode | null = block.node as LezerNode
    while (node) {
      if (node.name === 'Table' || node.name === 'TableRow' || node.name === 'TableCell') {
        return 'DataSheetOutlined'
      }
      node = node.parent
    }
  }

  // If the current line at handle position is a table line (header, separator, or body),
  // force DataSheetOutlined regardless of block type (handles parser limitation).
  if (lineText && isTableLine(lineText)) {
    return 'DataSheetOutlined'
  }

  switch (block.type) {
    case 'heading':
      return block.level !== undefined && block.level >= 1 && block.level <= 6
        ? `H${block.level}Outlined`
        : 'HOutlined'
    case 'task':
      return 'TodoOutlined'
    case 'blockquote':
      // Callout blocks (blockquote starting with > [!TYPE]) get CalloutOutlined,
      // regular blockquotes get ReferenceOutlined.
      if (blockText && isCalloutBlock(blockText)) {
        return 'CalloutOutlined'
      }
      return 'ReferenceOutlined'
    case 'fencedCode':
    case 'codeBlock':
      return 'CodeblockOutlined'
    case 'list':
      // Distinguish ordered vs unordered by checking the first non-blank line.
      if (blockText) {
        const firstNonBlank = blockText.split('\n').find((l) => l.trim().length > 0)
        if (firstNonBlank && /^\s*\d+\.\s/.test(firstNonBlank)) {
          return 'OrderListOutlined'
        }
      }
      return 'DisorderListOutlined'
    case 'table':
      return 'DataSheetOutlined'
    case 'thematicBreak':
      return 'DividerOutlined'
    case 'image':
      return 'ImageOutlined'
    case 'htmlBlock':
      return 'CodeOffOutlined'
    case 'paragraph':
    case 'yamlFrontMatter':
    default:
      return 'TextOutlined'
  }
}

/** True when a block's text is a callout (a blockquote opening with `[!TYPE]`). */
export function isCalloutBlock(blockText: string): boolean {
  return /^[ \t]*>[ \t]*\[![A-Za-z]+\]/.test(blockText)
}

/** Rewrite a callout block's `[!TYPE]` marker to `type` (e.g. 'NOTE'). */
export function computeCalloutType(blockText: string, type: string): string {
  return blockText.replace(/\[![A-Za-z]+\]/, `[!${type}]`)
}

/**
 * Add or remove a deterministic two-space indent on every non-empty line of a
 * block range, returning the full next document. `increase` prepends two
 * spaces; `decrease` strips up to two leading spaces. Empty lines are left
 * alone so blank separators stay blank (ticket #330).
 */
export function computeBlockIndent(
  docText: string,
  from: number,
  to: number,
  delta: 'increase' | 'decrease',
): string {
  const blockText = docText.slice(from, to)
  const next = blockText
    .split('\n')
    .map((line) => {
      if (line.length === 0) return line
      if (delta === 'increase') return `  ${line}`
      const leading = line.match(/^ {1,2}/)
      return leading ? line.slice(leading[0].length) : line
    })
    .join('\n')
  return docText.slice(0, from) + next + docText.slice(to)
}