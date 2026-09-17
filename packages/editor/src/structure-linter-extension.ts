/**
 * Structure linter CM6 extension — displays diagnostics as inline decorations.
 *
 * Creates a StateField that holds lint diagnostics and a DecorationSet that
 * renders them as underlines in the editor. On every document change, the
 * linter re-runs and decorations update automatically.
 *
 * The extension also registers a "Structure Check" command that toggles
 * the linter on/off via the command registry.
 */
import type { Extension } from '@codemirror/state';
import { StateField } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view';
import { lintStructure, type Diagnostic } from './structure-linter';
import { commandRegistry } from './commands';

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
 * StateField that holds the current diagnostics and produces a DecorationSet.
 */
function createLintField(): StateField<DecorationSet> {
  return StateField.define<DecorationSet>({
    create(state) {
      return buildDecorations(state);
    },
    update(_decos, tr) {
      if (!tr.docChanged) return _decos;
      return buildDecorations(tr.state);
    },
    provide: (f) => EditorView.decorations.from(f),
  });
}

/**
 * Build a DecorationSet from the current editor state by running the linter.
 */
function buildDecorations(state: import('@codemirror/state').EditorState): DecorationSet {
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

// --- Theme ---------------------------------------------------------------------

/**
 * Base theme for lint decorations — underline style per severity.
 */
const lintTheme = EditorView.baseTheme({
  '.cm-lint-mark.cm-lint-error': {
    textDecoration: 'underline wavy #f85149',
    textUnderlineOffset: '2px',
  },
  '.cm-lint-mark.cm-lint-warning': {
    textDecoration: 'underline wavy #d29922',
    textUnderlineOffset: '2px',
  },
  '.cm-lint-mark.cm-lint-info': {
    textDecoration: 'underline dotted #58a6ff',
    textUnderlineOffset: '2px',
  },
});

// --- Extension -----------------------------------------------------------------

/**
 * CM6 extension that runs the structure linter and displays diagnostics
 * as inline decorations.
 *
 * @returns CM6 Extension for use with createMarkdownEditor.
 */
export function structureLinterExtension(): Extension {
  return [createLintField(), lintTheme];
}

// --- Command registration ------------------------------------------------------

/**
 * Toggle command that enables/disables the structure linter.
 * The linter is always active when the extension is mounted; this command
 * is a placeholder for future toggle behavior.
 */
commandRegistry.register({
  id: 'structure-check',
  label: 'Structure Check',
  icon: '✓',
  execute(view) {
    // The linter runs automatically via the extension.
    // This command is a no-op placeholder for the command palette.
    void view;
  },
});
