/**
 * Structure linter CM6 extension — opt-in inline diagnostics.
 *
 * Creates a StateField that holds lint diagnostics and a DecorationSet that
 * renders them as dotted underlines. Inline rendering is OFF by default
 * (issue #206): users read dotted underlines on ordinary prose and headings
 * as spelling/grammar errors, while the findings already have a dedicated
 * surface in the left-rail 🩺 panel (which calls `lintStructure` directly).
 * Inline marks are an overlay the user opts into via the "结构体检" command
 * (id `structure-check`, registered in commands.ts) — that command calls
 * `toggleStructureLinter` below.
 *
 * This file owns only the lint field, its toggle helpers, and its theme.
 */
import {
  StateEffect,
  StateField,
  type EditorState,
  type Extension,
} from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view';
import { lintStructure, type Diagnostic } from './structure-linter';

// --- Severity → decoration style ---------------------------------------------

/**
 * Map diagnostic severity to CSS class for styling.
 */
function severityClass(severity: Diagnostic['severity']): string {
  switch (severity) {
    case 'error':
      return 'cm-lint-error';
    case 'warning':
      return 'cm-lint-warning';
    case 'info':
      return 'cm-lint-info';
  }
}

// --- StateField ----------------------------------------------------------------

/**
 * Per-view linter state. `enabled` is the user opt-in flag; `decorations` is
 * always empty while disabled so no mark ever reaches the DOM.
 */
interface StructureLinterState {
  readonly enabled: boolean;
  readonly decorations: DecorationSet;
}

/** Carries the desired enabled flag into the StateField. */
const setEnabledEffect = StateEffect.define<boolean>();

/**
 * Module-level field instance (deliberately not per-call): the toggle helpers
 * below must address the same field in every view that mounted the extension.
 * A StateField is a stateless descriptor — per-view state lives in EditorState,
 * so sharing one instance across editors is safe.
 */
const lintField = StateField.define<StructureLinterState>({
  create() {
    // Issue #206: default OFF — the editor body stays clean until the user
    // explicitly runs 结构体检.
    return { enabled: false, decorations: Decoration.none };
  },
  update(value, tr) {
    let enabled = value.enabled;
    for (const effect of tr.effects) {
      if (effect.is(setEnabledEffect)) enabled = effect.value;
    }

    if (!enabled) {
      // Disabled: drop any stale decorations; keep object identity otherwise.
      return value.enabled ? { enabled: false, decorations: Decoration.none } : value;
    }
    if (!tr.docChanged && enabled === value.enabled) return value;
    return { enabled: true, decorations: buildDecorations(tr.state) };
  },
  provide: (f) => EditorView.decorations.from(f, (value) => value.decorations),
});

/**
 * Build a DecorationSet from the current editor state by running the linter.
 */
function buildDecorations(state: EditorState): DecorationSet {
  const { diagnostics } = lintStructure(state);
  const decorations = diagnostics.map((d) =>
    Decoration.mark({
      class: `cm-lint-mark ${severityClass(d.severity)}`,
      attributes: {
        title: d.message,
        'data-rule': d.rule,
      },
    }).range(d.from, d.to),
  );

  // Sort by from-position (required by CM6).
  decorations.sort((a, b) => a.from - b.from || a.value.startSide - b.value.startSide);
  return Decoration.set(decorations, true);
}

// --- Opt-in toggle -------------------------------------------------------------

/**
 * Enable/disable inline structure diagnostics in the given view. No-op when
 * the extension is not mounted (an effect no field handles is discarded).
 */
export function setStructureLinterEnabled(view: EditorView, enabled: boolean): void {
  view.dispatch({ effects: setEnabledEffect.of(enabled) });
}

/**
 * Flip inline structure diagnostics for the given view and return the new
 * flag. Driven by the "结构体检" command (commands.ts).
 */
export function toggleStructureLinter(view: EditorView): boolean {
  const next = !isStructureLinterEnabled(view.state);
  setStructureLinterEnabled(view, next);
  return next;
}

/** Whether inline structure diagnostics are currently enabled. */
export function isStructureLinterEnabled(state: EditorState): boolean {
  return state.field(lintField, false)?.enabled ?? false;
}

// --- Theme ---------------------------------------------------------------------

/**
 * Base theme for lint decorations — underline style per severity.
 */
const lintTheme = EditorView.baseTheme({
  '.cm-lint-mark.cm-lint-error': {
    textDecoration: 'underline dotted #f85149',
    textUnderlineOffset: '2px',
  },
  '.cm-lint-mark.cm-lint-warning': {
    textDecoration: 'underline dotted #d29922',
    textUnderlineOffset: '2px',
  },
  '.cm-lint-mark.cm-lint-info': {
    textDecoration: 'underline dotted #58a6ff',
    textUnderlineOffset: '2px',
  },
});

// --- Extension -----------------------------------------------------------------

/**
 * CM6 extension for the structure linter (issue #206: default off).
 *
 * Mounting it installs the disabled lint field plus the underline theme, so
 * the editor body stays clean. Inline diagnostics are opt-in: flip them with
 * `toggleStructureLinter` / `setStructureLinterEnabled`, both driven from the
 * "结构体检" command in commands.ts.
 *
 * @returns CM6 Extension for use with createMarkdownEditor.
 */
export function structureLinterExtension(): Extension {
  return [lintField, lintTheme];
}

// The "结构体检" command (id structure-check) is registered in commands.ts and
// calls toggleStructureLinter() — keep this file free of a commands.ts import
// to avoid a module cycle.
