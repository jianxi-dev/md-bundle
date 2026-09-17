/**
 * AIProposal — the data structure representing a single AI rewrite proposal.
 *
 * A proposal captures the original text range, the proposed replacement,
 * and its review status. It is the unit the diff renderer and privacy
 * ledger operate on.
 */
import type { EditorView } from '@codemirror/view';
import { Transaction } from '@codemirror/state';

/** Status of an AI proposal in the review workflow. */
export type AIProposalStatus = 'pending' | 'accepted' | 'rejected';

/** A single AI rewrite proposal. */
export interface AIProposal {
  /** Document range of the original selection (from/to offsets). */
  readonly range: {
    readonly from: number;
    readonly to: number;
  };
  /** The original selected text. */
  readonly original: string;
  /** The AI-proposed replacement. */
  readonly proposed: string;
  /** Short human-readable rationale (shown in the diff tooltip). */
  readonly rationale: string;
  /** Current review status. */
  status: AIProposalStatus;
}

/**
 * Create a proposal from a selection + AI output.
 *
 * @param from - Start offset of the selected text.
 * @param to - End offset of the selected text.
 * @param original - The selected text itself.
 * @param proposed - The AI-generated replacement.
 * @param rationale - Short explanation of what changed.
 */
export function createAIProposal(
  from: number,
  to: number,
  original: string,
  proposed: string,
  rationale = '',
): AIProposal {
  return {
    range: { from, to },
    original,
    proposed,
    rationale,
    status: 'pending',
  };
}

/**
 * Apply a proposal to the editor — replaces the original range with the
 * proposed text and marks the proposal as 'accepted'.
 *
 * Returns a CM6 Transaction that the caller dispatches (or null if the
 * proposal is not pending).
 */
export function applyProposal(
  view: EditorView,
  proposal: AIProposal,
): Transaction | null {
  if (proposal.status !== 'pending') return null;
  proposal.status = 'accepted';
  return view.state.update({
    changes: {
      from: proposal.range.from,
      to: proposal.range.to,
      insert: proposal.proposed,
    },
    scrollIntoView: true,
  });
}

/**
 * Reject a proposal — leaves the document unchanged and marks the proposal
 * as 'rejected'.
 */
export function rejectProposal(proposal: AIProposal): void {
  proposal.status = 'rejected';
}
