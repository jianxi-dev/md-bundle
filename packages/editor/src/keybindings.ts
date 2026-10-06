/* MD-Bundle editor keybindings — real CM6 keymap for implemented commands.
 *
 * Binds only commands that actually exist in the registry. Each `run`
 * returns false when the command cannot apply so default CM6 behavior
 * survives. Mod-k is intentionally NOT bound (reserved for the command
 * palette); Mod-m is intentionally NOT bound (no assignment; macOS keeps it
 * for the system "minimize" role).
 *
 * No custom `scope` — CM6's default keydown handler only runs the "editor"
 * scope; a custom scope would make these bindings unreachable.
 */

import { keymap, type EditorView } from '@codemirror/view';
import { Prec, type Extension } from '@codemirror/state';
import { commandRegistry } from './commands';

/**
 * Detect whether the current platform is macOS.
 *
 * Guards against non-browser environments (jsdom, Node) where
 * `navigator.platform` may be empty or undefined. In those cases
 * we default to non-mac so formatting is deterministic in tests.
 */
export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  const platform = navigator.platform ?? '';
  const userAgent = navigator.userAgent ?? '';
  return /Mac|iPhone|iPad|iPod/.test(platform) || /Mac OS X/.test(userAgent);
}

/**
 * Format a CM6 key chord for display.
 *
 * Rules:
 * - Tokens split on `-`.
 * - `Mod` → mac `⌘` / non-mac `Ctrl`
 * - `Shift` → mac `⇧` / non-mac `Shift`
 * - `Alt` → mac `⌥` / non-mac `Alt`
 * - Letter/number tokens → uppercased.
 * - mac joins with NO separator: `⌘B`, `⌘⇧X`, `⌘⌥1`
 * - non-mac joins with `+`: `Ctrl+B`, `Ctrl+Shift+X`, `Ctrl+Alt+1`
 * - Empty/unknown tokens handled without throwing.
 *
 * The `isMac` parameter allows deterministic testing; when omitted,
 * `isMacPlatform()` is used.
 */
export function formatKeyChord(chord: string, isMac?: boolean): string {
  if (!chord) return '';
  const mac = isMac ?? isMacPlatform();
  const tokens = chord.split('-');
  const formatted = tokens.map((token) => {
    const t = token.trim();
    if (!t) return '';
    const lower = t.toLowerCase();
    if (lower === 'mod') return mac ? '⌘' : 'Ctrl';
    if (lower === 'shift') return mac ? '⇧' : 'Shift';
    if (lower === 'alt') return mac ? '⌥' : 'Alt';
    // Letter/number tokens: uppercase (e.g., 'b' → 'B', '1' → '1')
    return t.toUpperCase();
  });
  const filtered = formatted.filter((t) => t !== '');
  return mac ? filtered.join('') : filtered.join('+');
}

/**
 * Build a keymap `run` handler for a registry command id.
 *
 * Returns false when the id is not registered so the chord falls through to
 * CM6's default keymap instead of being swallowed by a no-op execute().
 */
export function runCommandById(id: string): (view: EditorView) => boolean {
  return (view) => {
    if (!commandRegistry.has(id)) return false;
    commandRegistry.execute(id, view);
    return true;
  };
}

/**
 * A single chord → registry-command binding.
 */
export interface EditorKeybinding {
  readonly id: string;
  readonly chord: string;
}

/**
 * Single source of truth for editor chords: `editorKeybindings()` builds the
 * CM6 keymap from this array, and the drift tests compare it against the
 * registry so the two can never diverge.
 */
export const EDITOR_KEYBINDINGS: ReadonlyArray<EditorKeybinding> = [
  { id: 'toggle-bold', chord: 'Mod-b' },
  { id: 'toggle-italic', chord: 'Mod-i' },
  { id: 'toggle-underline', chord: 'Mod-u' },
  // editor-shortcuts spec: bold/italic/underline/⇧S → B/I/U/⇧S.
  { id: 'toggle-strikethrough', chord: 'Mod-Shift-s' },
  { id: 'toggle-code', chord: 'Mod-e' },
  // editor-shortcuts spec: link uses ⇧L; Mod-l is NOT the link chord.
  { id: 'toggle-link', chord: 'Mod-Shift-l' },
  // Paragraph + heading levels (spec: Mod-Alt-0 and Mod-Alt-1…6). These work
  // with a collapsed caret (unlike turn-into-hN which needs a non-empty selection).
  { id: 'paragraph', chord: 'Mod-Alt-0' },
  { id: 'heading-1', chord: 'Mod-Alt-1' },
  { id: 'heading-2', chord: 'Mod-Alt-2' },
  { id: 'heading-3', chord: 'Mod-Alt-3' },
  { id: 'heading-4', chord: 'Mod-Alt-4' },
  { id: 'heading-5', chord: 'Mod-Alt-5' },
  { id: 'heading-6', chord: 'Mod-Alt-6' },
  // List shortcuts follow the Doubao/Google-Docs convention the spec lists as
  // ordered/bullet/task: ⇧7 ordered, ⇧8 bullet, ⇧9 task.
  { id: 'insert-ordered-list', chord: 'Mod-Shift-7' },
  { id: 'insert-unordered-list', chord: 'Mod-Shift-8' },
  { id: 'insert-task-list', chord: 'Mod-Shift-9' },
  // editor-shortcuts spec: ⇧. quote, ⇧C code block.
  { id: 'insert-quote', chord: 'Mod-Shift-.' },
  { id: 'insert-code-block', chord: 'Mod-Shift-c' },
  // NOT bound here (documented spec gaps, see the change notes):
  // - Mod-Shift-h "color panel": no registered command opens the color panel.
  // - Tab / Shift-Tab indent/outdent: owned by smart-input's headingTabKeymap.
  // Mod-k is intentionally NOT bound (reserved for the command palette).
  // Mod-m is intentionally NOT bound (no assignment).
];

/**
 * Keymap extension binding implemented commands to chords.
 * High precedence so these beat defaultKeymap when wired after it.
 */
export function editorKeybindings(): Extension {
  return Prec.high(
    keymap.of(
      EDITOR_KEYBINDINGS.map(({ id, chord }) => ({ key: chord, run: runCommandById(id) })),
    ),
  );
}
