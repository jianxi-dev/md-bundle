/**
 * Chapter reorganization — barrel export.
 *
 * Re-exports from chapter-tree.ts (pure data model) and
 * chapter-reorg-extension.ts (CM6 drag-and-drop extension).
 */
export {
  getHeadings,
  buildTree,
  computeSections,
  moveSection,
  extractSubtree,
  flattenTree,
  type HeadingEntry,
  type TreeNode,
  type Section,
  type MoveResult,
  type FlatNode,
} from './chapter-tree';
export { chapterReorgExtension, type DragState } from './chapter-reorg-extension';
