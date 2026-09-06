import { EditorView, keymap } from '@codemirror/view';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands';
import { Compartment, EditorState, type Extension } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { getThemeColor, type ThemeName } from './theme';

export interface MarkdownEditorOptions {
  /** Initial document content. `undefined` renders an empty editor. */
  value?: string;
  /** Theme name for the editor chrome. Defaults to `'dark'`. */
  theme?: ThemeName;
  /** Extra CodeMirror 6 extensions (hosts slash commands etc. later). */
  extensions?: Extension[];
  /** Fired whenever the document changes, with the full new value. */
  onChange?: (value: string) => void;
  /** Decoration extension managed via a Compartment. Reconfigure with setDecorationsEnabled. */
  decorations?: Extension;
  /** Initial state of the decorations compartment. Defaults to `true`. */
  decorationsEnabled?: boolean;
}

export interface MarkdownEditorHandle {
  /** The underlying CodeMirror 6 view. */
  view: EditorView;
  getValue(): string;
  setValue(value: string): void;
  /** Reconfigure the theme compartment in place. */
  setTheme(theme: ThemeName): void;
  /** Toggle the decorations compartment on/off without remounting. */
  setDecorationsEnabled(enabled: boolean): void;
  destroy(): void;
}

function createTheme(theme: ThemeName): Extension {
  return EditorView.theme(
    {
      '&': {
        backgroundColor: getThemeColor(theme, 'bg'),
        color: getThemeColor(theme, 'text'),
      },
      '.cm-content': {
        caretColor: getThemeColor(theme, 'primary'),
      },
      '&.cm-focused': {
        outlineColor: getThemeColor(theme, 'primary'),
      },
    },
    { dark: theme === 'dark' },
  );
}

export function createMarkdownEditor(
  parent: HTMLElement,
  options: MarkdownEditorOptions = {},
): MarkdownEditorHandle {
  const {
    value,
    theme = 'dark',
    extensions = [],
    onChange,
    decorations,
    decorationsEnabled = true,
  } = options;
  const themeCompartment = new Compartment();
  const decorationsCompartment = new Compartment();

  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: value ?? '',
      extensions: [
        EditorView.lineWrapping,
        history(),
        markdown(),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        themeCompartment.of(createTheme(theme)),
        decorationsCompartment.of(decorationsEnabled && decorations ? decorations : []),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChange?.(update.state.doc.toString());
        }),
        ...extensions,
      ],
    }),
  });

  return {
    view,
    getValue(): string {
      return view.state.doc.toString();
    },
    setValue(next: string): void {
      if (view.state.doc.toString() !== next) {
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: next },
        });
      }
    },
    setTheme(next: ThemeName): void {
      view.dispatch({
        effects: themeCompartment.reconfigure(createTheme(next)),
      });
    },
    setDecorationsEnabled(enabled: boolean): void {
      view.dispatch({
        effects: decorationsCompartment.reconfigure(
          enabled && decorations ? decorations : [],
        ),
      });
    },
    destroy(): void {
      view.destroy();
    },
  };
}
