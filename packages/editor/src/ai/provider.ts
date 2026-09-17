/**
 * AI Provider interface — the contract every AI backend implements.
 *
 * The editor does not ship a built-in LLM. It exposes a narrow streaming
 * interface that local (WebGPU/WASM) and BYO-key providers plug into.
 * The product is 100% functional without any provider configured — the AI
 * commands simply remain unavailable.
 *
 * Privacy: providers receive only the selected text range and a prompt,
 * never the full document. The Privacy Ledger (privacy-ledger.ts) records
 * what was sent.
 */

/** Capabilities an AI provider can declare. */
export type AICapability =
  | 'rewrite'
  | 'shorten'
  | 'translate'
  | 'structure'
  | 'explain';

/** Parameters for a single streaming request. */
export interface StreamParams {
  /** The instruction to the model (e.g. "Rewrite more concisely"). */
  prompt: string;
  /** The selected text the prompt applies to. */
  context: string;
  /** Optional system-level prompt override. */
  systemPrompt?: string;
  /** Abort signal for cancellation. */
  signal?: AbortSignal;
}

/** The AI provider contract. */
export interface AIProvider {
  /** Human-readable provider name (for Privacy Ledger + settings UI). */
  readonly name: string;
  /** Capabilities this provider supports. */
  readonly capabilities: readonly AICapability[];
  /**
   * Stream tokens back as they arrive. The consumer (diff renderer) appends
   * them to build the proposed replacement.
   */
  stream(params: StreamParams): AsyncIterable<string>;
}

/** Sentinel: no provider configured. AI commands are unavailable. */
export interface AIResolution {
  /** The resolved provider, or null when AI is disabled. */
  provider: AIProvider | null;
}

/**
 * Resolve the active AI provider from an in-memory configuration.
 * Returns null when AI is disabled — the caller hides AI affordances.
 *
 * API keys are NEVER persisted to localStorage; they live only in the
 * caller's memory and are passed in via `config`.
 */
export interface AIProviderConfig {
  /** Provider selector: 'disabled' | 'local' | 'byo'. */
  mode: 'disabled' | 'local' | 'byo';
  /** API key for BYO mode — stored in memory only, never on disk. */
  apiKey?: string;
  /** Optional endpoint override for BYO mode. */
  endpoint?: string;
}

/**
 * Construct an AIProvider from config. Pure function — no global state.
 * The caller owns the API key memory lifecycle.
 */
export function resolveProvider(config: AIProviderConfig): AIProvider | null {
  switch (config.mode) {
    case 'disabled':
      return null;
    case 'local':
      return createLocalProvider();
    case 'byo':
      if (!config.apiKey) return null;
      return createBYOKeyProvider(config.apiKey, config.endpoint);
  }
}

// --- Factory imports (lazy to avoid circular deps) --------------------------

import { createLocalProvider } from './local-provider';
import { createBYOKeyProvider } from './byo-provider';
