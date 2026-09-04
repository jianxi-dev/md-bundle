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
}

export interface MarkdownEditorHandle {
  /** The underlying CodeMirror 6 view. */
  view: EditorView;
  getValue(): string;
  setValue(value: string): void;
  /** Reconfigure the theme compartment in place. */
  setTheme(theme: ThemeName): void;
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
  const { value, theme = 'dark', extensions = [], onChange } = options;
  const themeCompartment = new Compartment();

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
    destroy(): void {
      view.destroy();
    },
  };
}
