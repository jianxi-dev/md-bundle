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
 *
 * Smart sorting: getAvailableSorted() returns commands ordered by:
 * 1. Recently used (most recent first)
 * 2. Contextually relevant (commands whose available() returns true)
 * 3. Alphabetical (by label)
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
 * - `contextRelevant` optionally marks a command as contextually relevant
 *   for smart sorting (e.g. "bold" is relevant when cursor is in bold text).
 */
export interface Command {
  readonly id: string;
  readonly label: string;
  readonly icon?: string;
  readonly execute: (view: EditorView) => void;
  readonly available?: (view: EditorView) => boolean;
  readonly keyBinding?: string;
  readonly contextRelevant?: (view: EditorView) => boolean;
}

// --- CommandRegistry class --------------------------------------------------

/**
 * Registry of editor commands.
 *
 * Register commands at module load time (or lazily), then query them
 * from the slash menu, toolbar, or key-binding layer.
 *
 * Tracks recently used command IDs for smart sorting in the command palette.
 */
export class CommandRegistry {
  private readonly _commands = new Map<string, Command>();
  private readonly _recentIds: string[] = [];
  private readonly _maxRecent = 10;

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
   * Return available commands sorted by:
   * 1. Recently used (most recent first)
   * 2. Contextually relevant (contextRelevant() returns true)
   * 3. Alphabetical (by label)
   *
   * This powers the command palette smart sorting (issue #146).
   */
  getAvailableSorted(view: EditorView): Command[] {
    const available = this.getAvailable(view);

    // Score each command: lower = higher priority
    const scored = available.map((cmd) => {
      const recentIndex = this._recentIds.indexOf(cmd.id);
      const isRecent = recentIndex !== -1;
      const isContextRelevant = cmd.contextRelevant?.(view) ?? false;

      // Sort key: [recentRank, contextRank, label]
      // recentRank: 0 for most recent, _maxRecent for not recent
      const recentRank = isRecent ? recentIndex : this._maxRecent;
      // contextRank: 0 for context-relevant, 1 for not
      const contextRank = isContextRelevant ? 0 : 1;

      return { cmd, recentRank, contextRank };
    });

    scored.sort((a, b) => {
      if (a.recentRank !== b.recentRank) return a.recentRank - b.recentRank;
      if (a.contextRank !== b.contextRank) return a.contextRank - b.contextRank;
      return a.cmd.label.localeCompare(b.cmd.label);
    });

    return scored.map((s) => s.cmd);
  }

  /**
   * Execute the command with the given `id`. No-op if not found.
   * Records the command as recently used for smart sorting.
   */
  execute(id: string, view: EditorView): void {
    const cmd = this._commands.get(id);
    if (cmd) {
      this._recordRecent(id);
      cmd.execute(view);
    }
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

  /**
   * Record a command ID as recently used. Moves it to the front of
   * the recent list. Caps the list at _maxRecent entries.
   */
  private _recordRecent(id: string): void {
    const existing = this._recentIds.indexOf(id);
    if (existing !== -1) {
      this._recentIds.splice(existing, 1);
    }
    this._recentIds.unshift(id);
    if (this._recentIds.length > this._maxRecent) {
      this._recentIds.length = this._maxRecent;
    }
  }
}

// --- Global registry instance -----------------------------------------------

/**
 * The process-wide command registry. Slash commands and toolbar actions
 * register here at module load.
 */
export const commandRegistry = new CommandRegistry();

/**
 * Wrap the current selection (or word at cursor) with the given prefix/suffix.
 */
function wrapSelection(view: EditorView, prefix: string, suffix: string): void {
  const { state } = view;
  const { main } = state.selection;

  if (!main.empty) {
    const selectedText = state.doc.sliceString(main.from, main.to);
    view.dispatch({
      changes: [
        { from: main.from, insert: prefix },
        { from: main.to, insert: suffix },
      ],
      selection: { anchor: main.from + prefix.length + selectedText.length + suffix.length },
      scrollIntoView: true,
    });
  } else {
    const insert = prefix + suffix;
    view.dispatch({
      changes: { from: main.head, insert },
      selection: { anchor: main.head + prefix.length },
      scrollIntoView: true,
    });
  }
}

function toggleWrap(view: EditorView, marker: string): void {
  const { state } = view;
  const { main } = state.selection;

  if (!main.empty) {
    const selectedText = state.doc.sliceString(main.from, main.to);
    if (selectedText.startsWith(marker) && selectedText.endsWith(marker)) {
      const unwrapped = selectedText.slice(marker.length, -marker.length);
      view.dispatch({
        changes: { from: main.from, to: main.to, insert: unwrapped },
        selection: { anchor: main.from, head: main.from + unwrapped.length },
        scrollIntoView: true,
      });
    } else {
      view.dispatch({
        changes: [
          { from: main.from, insert: marker },
          { from: main.to, insert: marker },
        ],
        selection: { anchor: main.from, head: main.to + marker.length * 2 },
        scrollIntoView: true,
      });
    }
  } else {
    const insert = marker + marker;
    view.dispatch({
      changes: { from: main.head, insert },
      selection: { anchor: main.head + marker.length },
      scrollIntoView: true,
    });
  }
}

commandRegistry.register({
  id: 'toggle-bold',
  label: 'Bold',
  icon: 'B',
  keyBinding: 'Mod-b',
  execute(view) {
    toggleWrap(view, '**');
  },
});

commandRegistry.register({
  id: 'toggle-italic',
  label: 'Italic',
  icon: 'I',
  keyBinding: 'Mod-i',
  execute(view) {
    toggleWrap(view, '*');
  },
});

commandRegistry.register({
  id: 'toggle-strikethrough',
  label: 'Strikethrough',
  icon: 'S',
  execute(view) {
    toggleWrap(view, '~~');
  },
});

commandRegistry.register({
  id: 'toggle-code',
  label: 'Code',
  icon: '`',
  keyBinding: 'Mod-e',
  execute(view) {
    toggleWrap(view, '`');
  },
});

commandRegistry.register({
  id: 'toggle-link',
  label: 'Link',
  icon: '🔗',
  keyBinding: 'Mod-k',
  execute(view) {
    wrapSelection(view, '[', '](url)');
  },
});

commandRegistry.register({
  id: 'highlight-text',
  label: 'Highlight',
  icon: '🎨',
  execute(_view) {
    // Placeholder — color picker would be implemented at the app level
  },
});

commandRegistry.register({
  id: 'ai-enhance',
  label: 'AI Enhance',
  icon: '✨',
  execute(_view) {
    // Placeholder — AI integration would be implemented at the app level
  },
});

commandRegistry.register({
  id: 'table-add-row',
  label: 'Add Row',
  icon: '➕行',
  execute(_view) {
    // Placeholder — table manipulation would require AST-aware editing
  },
});

commandRegistry.register({
  id: 'table-add-col',
  label: 'Add Column',
  icon: '➕列',
  execute(_view) {
    // Placeholder
  },
});

commandRegistry.register({
  id: 'table-align',
  label: 'Align',
  icon: '↔',
  execute(_view) {
    // Placeholder
  },
});

commandRegistry.register({
  id: 'image-replace',
  label: 'Replace Image',
  icon: '🔄',
  execute(_view) {
    // Placeholder — image replacement requires file picker integration
  },
});

commandRegistry.register({
  id: 'image-edit-alt',
  label: 'Edit Alt Text',
  icon: '✏️',
  execute(_view) {
    // Placeholder
  },
});

commandRegistry.register({
  id: 'image-resize',
  label: 'Resize Image',
  icon: '📐',
  execute(_view) {
    // Placeholder
  },
});

commandRegistry.register({
  id: 'link-edit',
  label: 'Edit Link',
  icon: '✏️',
  execute(_view) {
    // Placeholder
  },
});

commandRegistry.register({
  id: 'link-open',
  label: 'Open Link',
  icon: '🔗',
  execute(_view) {
    // Placeholder — would open link in new tab
  },
});

commandRegistry.register({
  id: 'link-remove',
  label: 'Remove Link',
  icon: '❌',
  execute(view) {
    const { state } = view;
    const { main } = state.selection;
    const doc = state.doc.toString();

    const beforeCursor = doc.slice(0, main.head);

    const openBracket = beforeCursor.lastIndexOf('[');
    if (openBracket === -1) return;

    const parenOpen = doc.indexOf('](', openBracket);
    if (parenOpen === -1) return;

    const parenClose = doc.indexOf(')', parenOpen + 2);
    if (parenClose === -1) return;

    const linkText = doc.slice(openBracket + 1, parenOpen);
    view.dispatch({
      changes: { from: openBracket, to: parenClose + 1, insert: linkText },
      selection: { anchor: openBracket + linkText.length },
      scrollIntoView: true,
    });
  },
});

commandRegistry.register({
  id: 'code-copy',
  label: 'Copy Code',
  icon: '📋',
  execute(_view) {
    // Placeholder — would copy code block content to clipboard
  },
});

commandRegistry.register({
  id: 'code-set-language',
  label: 'Set Language',
  icon: '🎨',
  execute(_view) {
    // Placeholder
  },
});

commandRegistry.register({
  id: 'code-explain',
  label: 'Explain Code',
  icon: '✨',
  execute(_view) {
    // Placeholder — AI integration
  },
});
