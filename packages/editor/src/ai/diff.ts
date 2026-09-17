/**
 * Inline diff rendering — CM6 decoration-based diff view for AI proposals.
 *
 * When the user triggers an AI rewrite, the proposal is rendered as an
 * inline diff inside the editor:
 *   - Deleted text: red strikethrough (the part of the original being removed)
 *   - Added text: green background (the proposed replacement)
 *
 * Key bindings:
 *   - Tab: accept the current hunk (replace original with proposed)
 *   - Esc: reject the current hunk (remove the diff, keep original)
 *   - Mod-Enter: accept all remaining hunks at once
 *
 * The diff is rendered as a CM6 ViewPlugin that tracks the active proposal
 * and emits decorations. It does NOT modify the document until the user
 * accepts — the diff is purely visual until then.
 */
import type { Extension, EditorState } from '@codemirror/state';
import { StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, type DecorationSet, keymap } from '@codemirror/view';
import type { AIProposal } from './proposal';
import { applyProposal, rejectProposal } from './proposal';

/** CSS class for deleted text (red strikethrough). */
const DELETED_CLASS = 'cm-ai-diff-deleted';

/** CSS class for added text (green background). */
const ADDED_CLASS = 'cm-ai-diff-added';

/** StateEffect: set the active AI diff proposal. */
const setAIDiffProposal = StateEffect.define<AIProposal | null>();

/** StateEffect: accept the current hunk. */
const acceptHunk = StateEffect.define<void>();

/** StateEffect: reject the current hunk. */
const rejectHunk = StateEffect.define<void>();

/** StateEffect: accept all hunks. */
const acceptAll = StateEffect.define<void>();

/** Internal state of the AI diff view. */
export interface AIDiffState {
  proposal: AIProposal | null;
}

/** The AI diff view plugin — exposes accept/reject commands to the host. */
export interface AIDiffViewPlugin {
  /** Set a new proposal to display as a diff. */
  setProposal(proposal: AIProposal | null): void;
}

/** StateField holding the current AI diff state. */
const aiDiffField = StateField.define<AIDiffState>({
  create() {
    return { proposal: null };
  },
  update(state, tr) {
    let next = { ...state };
    for (const effect of tr.effects) {
      if (effect.is(setAIDiffProposal)) {
        next = { proposal: effect.value };
      }
    }
    return next;
  },
});

/** Build decorations from the current AI diff state. */
function buildDecorations(state: EditorState): DecorationSet {
  const diffState = state.field(aiDiffField);
  const proposal = diffState.proposal;
  if (!proposal) return Decoration.set([]);

  const { from, to } = proposal.range;
  const original = proposal.original;
  const proposed = proposal.proposed;

  // Simple whole-range diff: mark the original range as deleted,
  // then insert the proposed text as an after-decoration.
  const decos: Array<{ from: number; to: number; value: Decoration }> = [];

  // Mark original range as deleted (red strikethrough)
  if (from < to && original.length > 0) {
    decos.push({
      from,
      to,
      value: Decoration.mark({ class: DELETED_CLASS }),
    });
  }

  // Insert proposed text after the original range (green background)
  // We use a widget decoration placed at `to` so it appears inline.
  if (proposed.length > 0 && proposed !== original) {
    decos.push({
      from: to,
      to: to,
      value: Decoration.widget({
        widget: createAddedWidget(proposed),
        side: 1,
      }),
    });
  }

  decos.sort((a, b) => a.from - b.from || a.value.startSide - b.value.startSide);
  return Decoration.set(decos, true);
}

/** Widget for added text (green background). */
class AddedTextWidget {
  readonly text: string;
  constructor(text: string) {
    this.text = text;
  }
  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = ADDED_CLASS;
    span.textContent = this.text;
    return span;
  }
  eq(other: AddedTextWidget): boolean {
    return other.text === this.text;
  }
  updateDOM(): boolean {
    return false;
  }
  get estimatedHeight(): number {
    return -1;
  }
  get lineBreaks(): number {
    return 0;
  }
  coordsAt(): DOMRect | null {
    return null;
  }
  destroy(): void {}
  ignoreEvent(): boolean {
    return true;
  }
}

function createAddedWidget(text: string): AddedTextWidget {
  return new AddedTextWidget(text);
}

/** Decoration field that rebuilds on state changes. */
const aiDiffDecorations = StateField.define<DecorationSet>({
  create(state) {
    return buildDecorations(state);
  },
  update(decos, tr) {
    if (tr.effects.some((e) => e.is(setAIDiffProposal)) || tr.docChanged) {
      return buildDecorations(tr.state);
    }
    return decos;
  },
  provide: (f) => EditorView.decorations.from(f),
});

/**
 * ViewPlugin that wires accept/reject effects to document mutations.
 * Handles Tab/Esc/Mod-Enter by reading the current proposal from state
 * and dispatching the appropriate document changes.
 */
const aiDiffPlugin = ViewPlugin.define((view) => {
  function handleAcceptHunk(): boolean {
    const proposal = view.state.field(aiDiffField).proposal;
    if (!proposal) return false;
    const tr = applyProposal(view, proposal);
    if (!tr) return false;
    view.dispatch(tr);
    // Clear the diff after accept.
    view.dispatch({ effects: setAIDiffProposal.of(null) });
    return true;
  }

  function handleRejectHunk(): boolean {
    const proposal = view.state.field(aiDiffField).proposal;
    if (!proposal) return false;
    rejectProposal(proposal);
    view.dispatch({ effects: setAIDiffProposal.of(null) });
    return true;
  }

  function handleAcceptAll(): boolean {
    // For v1, "accept all" == accept the single hunk (one proposal at a time).
    return handleAcceptHunk();
  }

  return {
    update(u) {
      for (const tr of u.transactions) {
        for (const effect of tr.effects) {
          if (effect.is(acceptHunk)) handleAcceptHunk();
          else if (effect.is(rejectHunk)) handleRejectHunk();
          else if (effect.is(acceptAll)) handleAcceptAll();
        }
      }
    },
  };
});

/** Key bindings for the AI diff review workflow. */
const aiDiffKeymap = keymap.of([
  {
    key: 'Tab',
    run: (view) => {
      view.dispatch({ effects: acceptHunk.of(undefined) });
      return true;
    },
  },
  {
    key: 'Escape',
    run: (view) => {
      view.dispatch({ effects: rejectHunk.of(undefined) });
      return true;
    },
  },
  {
    key: 'Mod-Enter',
    run: (view) => {
      view.dispatch({ effects: acceptAll.of(undefined) });
      return true;
    },
  },
]);

/** Base theme for AI diff decorations. */
const aiDiffTheme = EditorView.baseTheme({
  '.cm-content .cm-ai-diff-deleted': {
    textDecoration: 'line-through',
    textDecorationColor: 'var(--mdb-danger, #f0616d)',
    color: 'var(--mdb-danger, #f0616d)',
    opacity: 0.7,
  },
  '.cm-content .cm-ai-diff-added': {
    backgroundColor: 'rgba(63, 185, 80, 0.18)',
    borderBottom: '2px solid var(--mdb-success, #3fb950)',
    borderRadius: '2px',
    padding: '0 1px',
  },
});

/**
 * Create the AI diff extension. Returns a CM6 Extension array that the
 * host adds to the editor's extension list.
 *
 * The returned object also exposes `setProposal` so the host can trigger
 * a diff from the floating toolbar.
 */
export function createAIDiffViewPlugin(): AIDiffViewPlugin & { extension: Extension } {
  const api: AIDiffViewPlugin = {
    setProposal(proposal) {
      // This will be set by the host via view.dispatch.
      // We store it for the extension to read.
      currentProposal = proposal;
    },
  };

  let currentProposal: AIProposal | null = null;

  return {
    ...api,
    extension: [
      aiDiffField,
      aiDiffDecorations,
      aiDiffPlugin,
      aiDiffKeymap,
      aiDiffTheme,
      // Provide a way to set the proposal from outside.
      ViewPlugin.define((view) => {
        if (currentProposal) {
          view.dispatch({ effects: setAIDiffProposal.of(currentProposal) });
        }
        return {};
      }),
    ],
  };
}

// --- Re-export effect creators for host dispatch ----------------------------

/** Dispatch effect to accept the current hunk. */
export function aiDiffAcceptHunk(view: EditorView): void {
  view.dispatch({ effects: acceptHunk.of(undefined) });
}

/** Dispatch effect to reject the current hunk. */
export function aiDiffRejectHunk(view: EditorView): void {
  view.dispatch({ effects: rejectHunk.of(undefined) });
}

/** Dispatch effect to accept all hunks. */
export function aiDiffAcceptAll(view: EditorView): void {
  view.dispatch({ effects: acceptAll.of(undefined) });
}
