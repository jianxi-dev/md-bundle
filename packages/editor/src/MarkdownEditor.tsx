import { useEffect, useRef } from 'react';
import { createMarkdownEditor } from './editor';
import type { MarkdownEditorHandle, MarkdownEditorOptions } from './editor';

export interface MarkdownEditorComponentProps
  extends Omit<MarkdownEditorOptions, 'value' | 'onChange'> {
  /** Controlled document content. Pushed into the editor whenever it diverges. */
  value?: string;
  /** Fired on every user edit with the full new value. */
  onChange?: (value: string) => void;
  /**
   * Test seam: called once with the underlying `MarkdownEditorHandle` right
   * after mount. Lets tests drive `setValue`/`setTheme` and read `getValue`
   * without reaching into the DOM.
   */
  onMount?: (handle: MarkdownEditorHandle) => void;
}

/**
 * React wrapper around `createMarkdownEditor` — a CodeMirror 6 source editor
 * with markdown support and the #165DFF theme.
 *
 * Controlled component semantics:
 * - `value` prop is pushed into the editor whenever it differs from the
 *   current doc. When they are equal the editor is left untouched, so the
 *   cursor survives round-trips through React state.
 * - `onChange` fires on user edits (never on the mount-time initial value).
 * - `theme` reconfigures the theme compartment in place.
 * - `extensions` are forwarded to the underlying editor at construction time
 *   (the seam hosts slash commands etc. in later waves).
 */
export function MarkdownEditor({
  value,
  onChange,
  theme = 'dark',
  extensions,
  onMount,
}: MarkdownEditorComponentProps): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<MarkdownEditorHandle | null>(null);
  const onChangeRef = useRef(onChange);

  // Latest-callback ref: prop identity changes never remount the editor.
  onChangeRef.current = onChange;

  // Mount once — create the editor on the host div, destroy on unmount.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const handle = createMarkdownEditor(host, {
      value,
      theme,
      extensions,
      onChange: (next) => onChangeRef.current?.(next),
    });
    handleRef.current = handle;
    onMount?.(handle);

    return () => {
      handleRef.current = null;
      handle.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  // Sync external `value` changes into the editor (setValue already no-ops on
  // identical docs, preserving the cursor across controlled re-renders).
  useEffect(() => {
    const handle = handleRef.current;
    if (handle && typeof value === 'string' && handle.getValue() !== value) {
      handle.setValue(value);
    }
  }, [value]);

  // Reconfigure the theme compartment when the theme prop changes.
  useEffect(() => {
    handleRef.current?.setTheme(theme);
  }, [theme]);

  return <div ref={hostRef} />;
}
