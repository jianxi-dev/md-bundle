/**
 * AI module barrel — public entry for the diff-native AI feature.
 *
 * Exports the provider interface, factory, proposal types, diff rendering,
 * and privacy ledger. Consumed by the editor host (apps/web) to wire the
 * floating-toolbar "AI" action.
 */
export {
  resolveProvider,
  type AIProvider,
  type AIProviderConfig,
  type AIResolution,
  type AICapability,
  type StreamParams,
} from './provider';
export { createLocalProvider } from './local-provider';
export { createBYOKeyProvider } from './byo-provider';
export {
  createAIProposal,
  applyProposal,
  rejectProposal,
  type AIProposal,
} from './proposal';
export {
  createAIDiffViewPlugin,
  type AIDiffViewPlugin,
  type AIDiffState,
  aiDiffAcceptHunk,
  aiDiffRejectHunk,
  aiDiffAcceptAll,
} from './diff';
export {
  createPrivacyLedger,
  type PrivacyLedger,
  type PrivacyLedgerEntry,
} from './privacy-ledger';
