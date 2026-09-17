/**
 * Privacy Ledger — records every AI call for user transparency.
 *
 * The ledger captures:
 *   - What was sent (character range, NOT the full document)
 *   - Where it went (provider name)
 *   - When it happened (timestamp)
 *
 * Entries are stored in memory only — they do not survive page reload.
 * This is intentional: the ledger is a session-level transparency tool,
 * not an audit log. The user can clear it at any time.
 */
import type { AIProvider } from './provider';

/** A single Privacy Ledger entry. */
export interface PrivacyLedgerEntry {
  /** Timestamp (ms since epoch) of the call. */
  readonly timestamp: number;
  /** Provider name the request was sent to. */
  readonly providerName: string;
  /** Character range in the document that was sent (from/to offsets). */
  readonly range: {
    readonly from: number;
    readonly to: number;
  };
  /** Number of characters sent (for quick scanning). */
  readonly charCount: number;
  /** The prompt/instruction that was sent. */
  readonly prompt: string;
}

/** Privacy Ledger interface — the host interacts with. */
export interface PrivacyLedger {
  /** Record a new AI call. */
  record(provider: AIProvider, from: number, to: number, prompt: string): void;
  /** Return all entries, newest first. */
  entries(): PrivacyLedgerEntry[];
  /** Clear all entries. */
  clear(): void;
  /** Number of entries in the ledger. */
  size(): number;
}

/**
 * Create a Privacy Ledger instance.
 *
 * Entries are stored in memory only — no persistence to localStorage,
 * sessionStorage, or any other durable medium.
 */
export function createPrivacyLedger(): PrivacyLedger {
  const entries: PrivacyLedgerEntry[] = [];

  return {
    record(provider, from, to, prompt) {
      entries.push({
        timestamp: Date.now(),
        providerName: provider.name,
        range: { from, to },
        charCount: to - from,
        prompt,
      });
    },

    entries(): PrivacyLedgerEntry[] {
      // Return a copy, newest first.
      return [...entries].sort((a, b) => b.timestamp - a.timestamp);
    },

    clear(): void {
      entries.length = 0;
    },

    size(): number {
      return entries.length;
    },
  };
}
