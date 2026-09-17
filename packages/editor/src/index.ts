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
  resolveProvider,
  createLocalProvider,
  createBYOKeyProvider,
  createAIProposal,
  applyProposal,
  rejectProposal,
  createAIDiffViewPlugin,
  aiDiffAcceptHunk,
  aiDiffRejectHunk,
  aiDiffAcceptAll,
  createPrivacyLedger,
  type AIProvider,
  type AIProviderConfig,
  type AIResolution,
  type AICapability,
  type StreamParams,
  type AIProposal,
  type AIDiffViewPlugin,
  type AIDiffState,
  type PrivacyLedger,
  type PrivacyLedgerEntry,
} from './ai';
