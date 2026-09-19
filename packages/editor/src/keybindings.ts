/* MD-Bundle editor keybindings — real CM6 keymap for implemented commands.
 *
 * Binds only commands that actually exist in the registry. Each `run`
 * returns false when the command cannot apply so default CM6 behavior
 * survives. Mod-k is intentionally NOT bound (reserved for the command
 * palette); Mod-1/2/3 are not bound either.
 *
 * No custom `scope` — CM6's default keydown handler only runs the "editor"
 * scope; a custom scope would make these bindings unreachable.
 */

import { keymap, type EditorView } from '@codemirror/view';
import { Prec, type Extension } from '@codemirror/state';
import { commandRegistry } from './commands';

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
  { id: 'toggle-strikethrough', chord: 'Mod-Shift-x' },
  { id: 'toggle-code', chord: 'Mod-e' },
  { id: 'toggle-link', chord: 'Mod-l' },
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
