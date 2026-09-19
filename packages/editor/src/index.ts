export {
  createMarkdownEditor,
  type MarkdownEditorHandle,
  type MarkdownEditorOptions,
} from './editor';
export {
  MarkdownEditor,
  type MarkdownEditorComponentProps,
} from './MarkdownEditor';
export {
  getThemeColor,
  themeTokens,
  type ThemeName,
  type ThemeTokenNames,
} from './theme';
export {
  slashKeymap,
  insertSlashChar,
  slashMenuApply,
  slashMenuClose,
  slashMenuSelectNext,
  slashMenuSelectPrev,
  defaultCommands,
  type SlashCommand,
} from './slash';
export { editorDecorations, type EditorDecorationsOptions } from './decorations';
export type { ImageResolver, ImageCallbacks } from './decorations/image';
export { getBlocks, getBlockAt, type Block, type BlockType } from './block-model';
export { CommandRegistry, type Command } from './commands';
export {
  contextToolbar,
  updateToolbar,
  hideContextToolbar,
  detectContext,
  getButtonsForContext,
  type ToolbarContext,
  type ToolbarButton,
} from './toolbar';
export {
  smartInput,
  handleMarkdownShortcut,
  smartEnter,
  smartBackspace,
  handleAutoPair,
  handleChinesePair,
} from './smart-input';
export {
  getHeadings,
  buildTree,
  computeSections,
  moveSection,
  extractSubtree,
  flattenTree,
  chapterReorgExtension,
  type HeadingEntry,
  type TreeNode,
  type Section,
  type MoveResult,
  type FlatNode,
  type DragState,
} from './chapter-reorg';
export { lintStructure, type Diagnostic, type LintResult } from './structure-linter';
export { structureLinterExtension } from './structure-linter-extension';
export { commandPaletteKeymap, openCommandPalette, closeCommandPalette, paletteSelectNext, paletteSelectPrev, paletteApply, paletteClose } from './command-palette';
export { floatingToolbar, type FloatingToolbarOptions } from './floating-toolbar';
export { editorKeybindings } from './keybindings';
