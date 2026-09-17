/**
 * Command registry — unified command surface for slash menu + toolbar.
 *
 * The `Command` interface is the single descriptor for any editor action
 * (insert template, toggle formatting, run macro). `CommandRegistry` holds
 * the commands and provides lookup by id, availability filtering, and
 * key-binding resolution.
 *
 * Existing slash commands (slash.ts) and toolbar actions are migrated to
 * register their commands here; the slash menu and toolbar render from
 * `getAvailable()` so they always show the same set.
 */
import type { EditorView } from '@codemirror/view';

// --- Command interface ------------------------------------------------------

/**
 * A single editor command.
 *
 * - `id` is the stable identifier (used for key binding lookup).
 * - `label` is the human-readable name (slash menu, toolbar tooltip).
 * - `icon` is an optional short string / glyph for the slash menu.
 * - `execute` performs the command against the live EditorView.
 * - `available` optionally gates the command on the current state
 *   (e.g. "only inside a list"). When omitted, the command is always available.
 * - `keyBinding` is an optional CM6 key chord (e.g. "Mod-b") for the command palette.
 */
export interface Command {
  readonly id: string;
  readonly label: string;
  readonly icon?: string;
  readonly execute: (view: EditorView) => void;
  readonly available?: (view: EditorView) => boolean;
  readonly keyBinding?: string;
}

// --- CommandRegistry class --------------------------------------------------

/**
 * Registry of editor commands.
 *
 * Register commands at module load time (or lazily), then query them
 * from the slash menu, toolbar, or key-binding layer.
 */
export class CommandRegistry {
  private readonly _commands = new Map<string, Command>();

  /**
   * Register a command. If a command with the same `id` is already
   * registered, it is overwritten (last-write-wins).
   */
  register(cmd: Command): void {
    this._commands.set(cmd.id, cmd);
  }

  /**
   * Return all commands whose `available()` returns true (or has no
   * availability guard). Order is insertion order.
   */
  getAvailable(view: EditorView): Command[] {
    const result: Command[] = [];
    for (const cmd of this._commands.values()) {
      if (cmd.available === undefined || cmd.available(view)) {
        result.push(cmd);
      }
    }
    return result;
  }

  /**
   * Execute the command with the given `id`. No-op if not found.
   */
  execute(id: string, view: EditorView): void {
    const cmd = this._commands.get(id);
    if (cmd) cmd.execute(view);
  }

  /**
   * Return the key binding for the command with the given `id`,
   * or null if not found / has no binding.
   */
  getKeyBinding(id: string): string | null {
    const cmd = this._commands.get(id);
    return cmd?.keyBinding ?? null;
  }

  /**
   * Return all registered commands (regardless of availability).
   * Useful for debugging / serialization.
   */
  all(): Command[] {
    return [...this._commands.values()];
  }
}

// --- Global registry instance -----------------------------------------------

/**
 * The process-wide command registry. Slash commands and toolbar actions
 * register here at module load.
 */
export const commandRegistry = new CommandRegistry();
