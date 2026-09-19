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
import type { EditorState } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { getBlockAt, getBlocks } from './block-model';

// --- Wrapping helpers -------------------------------------------------------

/**
 * Wrap a non-empty selection with `before`/`after`. When the selection is
 * empty, insert `before + after` and place the caret between them so the
 * user can type the content. Returns true if a change was dispatched.
 */
function wrapSelection(
  view: EditorView,
  before: string,
  after: string,
): boolean {
  const { state } = view;
  const { main } = state.selection;
  if (!main.empty) {
    const text = state.doc.sliceString(main.from, main.to);
    view.dispatch({
      changes: [
        { from: main.from, insert: before },
        { from: main.to, insert: after },
      ],
      selection: { anchor: main.from + before.length + text.length + after.length },
    });
    return true;
  }
  // Empty selection — insert pair with caret inside.
  view.dispatch({
    changes: { from: main.from, insert: `${before}${after}` },
    selection: { anchor: main.from + before.length },
  });
  return true;
}

/**
 * Source text of the block containing `pos`. Used by code-copy to grab the
 * whole fenced block when the selection is empty. Returns '' if no block
 * matches (e.g. empty document).
 */
function blockTextAt(state: EditorState, pos: number): string {
  const block = getBlockAt(pos, getBlocks(state));
  return block ? state.doc.sliceString(block.from, block.to) : '';
}

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
  readonly group?: '格式' | '块' | '视图' | '插入' | '体检';
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
   * Whether a command with the given `id` is registered. Key-binding `run`
   * handlers use this to return false (letting CM6's default keymap win)
   * instead of swallowing a chord for a command that no longer exists.
   */
  has(id: string): boolean {
    return this._commands.has(id);
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

// --- Core command registrations ---------------------------------------------

/**
 * Register all core editor commands with Chinese labels and groups.
 * Called once at module load. Slash commands and toolbar actions reference
 * these by id; the keybindings layer binds chords to them.
 */
export function registerEditorCommands(): void {
  commandRegistry.register({
    id: 'toggle-bold',
    label: '加粗',
    icon: 'B',
    group: '格式',
    keyBinding: 'Mod-b',
    execute: (view) => {
      wrapSelection(view, '**', '**');
    },
  });

  commandRegistry.register({
    id: 'toggle-italic',
    label: '斜体',
    icon: 'I',
    group: '格式',
    keyBinding: 'Mod-i',
    execute: (view) => {
      wrapSelection(view, '*', '*');
    },
  });

  commandRegistry.register({
    id: 'toggle-strikethrough',
    label: '删除线',
    icon: 'S',
    group: '格式',
    keyBinding: 'Mod-Shift-x',
    execute: (view) => {
      wrapSelection(view, '~~', '~~');
    },
  });

  commandRegistry.register({
    id: 'toggle-code',
    label: '行内代码',
    icon: '`',
    group: '格式',
    keyBinding: 'Mod-e',
    execute: (view) => {
      wrapSelection(view, '`', '`');
    },
  });

  commandRegistry.register({
    id: 'toggle-link',
    label: '插入链接',
    icon: '🔗',
    group: '插入',
    keyBinding: 'Mod-l',
    execute: (view) => {
      const { state } = view;
      const { main } = state.selection;
      if (!main.empty) {
        const text = state.doc.sliceString(main.from, main.to);
        view.dispatch({
          changes: [
            { from: main.from, insert: '[' },
            { from: main.to, insert: '](url)' },
          ],
          selection: { anchor: main.from + text.length + 5 },
        });
      } else {
        view.dispatch({
          changes: { from: main.from, insert: '[](url)' },
          selection: { anchor: main.from + 1 },
        });
      }
    },
  });

  commandRegistry.register({
    id: 'insert-unordered-list',
    label: '无序列表',
    icon: '•',
    group: '块',
    execute: (view) => {
      const { main } = view.state.selection;
      view.dispatch({
        changes: { from: main.from, insert: '- ' },
        selection: { anchor: main.from + 2 },
      });
    },
  });

  commandRegistry.register({
    id: 'insert-ordered-list',
    label: '有序列表',
    icon: '1.',
    group: '块',
    execute: (view) => {
      const { main } = view.state.selection;
      view.dispatch({
        changes: { from: main.from, insert: '1. ' },
        selection: { anchor: main.from + 3 },
      });
    },
  });

  commandRegistry.register({
    id: 'insert-task-list',
    label: '任务列表',
    icon: '☑',
    group: '块',
    execute: (view) => {
      const { main } = view.state.selection;
      view.dispatch({
        changes: { from: main.from, insert: '- [ ] ' },
        selection: { anchor: main.from + 6 },
      });
    },
  });

  commandRegistry.register({
    id: 'insert-quote',
    label: '引用块',
    icon: '❝',
    group: '块',
    execute: (view) => {
      const { main } = view.state.selection;
      view.dispatch({
        changes: { from: main.from, insert: '> ' },
        selection: { anchor: main.from + 2 },
      });
    },
  });

  commandRegistry.register({
    id: 'insert-code-block',
    label: '代码块',
    icon: '{ }',
    group: '块',
    execute: (view) => {
      const { main } = view.state.selection;
      view.dispatch({
        changes: { from: main.from, insert: '```\n\n```' },
        selection: { anchor: main.from + 4 },
      });
    },
  });

  commandRegistry.register({
    id: 'insert-table',
    label: '插入表格',
    icon: '⊞',
    group: '插入',
    execute: (view) => {
      const { main } = view.state.selection;
      view.dispatch({
        changes: { from: main.from, insert: '| A | B |\n| --- | --- |\n| 1 | 2 |' },
        selection: { anchor: main.from + 3 },
      });
    },
  });

  commandRegistry.register({
    id: 'insert-callout',
    label: '插入标注',
    icon: '❝',
    group: '插入',
    execute: (view) => {
      const { main } = view.state.selection;
      const template = '> [!NOTE]\n> ';
      view.dispatch({
        changes: { from: main.from, insert: template },
        selection: { anchor: main.from + template.length },
      });
    },
  });

  commandRegistry.register({
    id: 'insert-html',
    label: '插入 HTML',
    icon: '</>',
    group: '插入',
    execute: (view) => {
      const { main } = view.state.selection;
      const text = '<div align="center">\n\n</div>';
      const blankLineOffset = text.indexOf('\n') + 1;
      view.dispatch({
        changes: { from: main.from, insert: text },
        selection: { anchor: main.from + blankLineOffset },
      });
    },
  });

  commandRegistry.register({
    id: 'insert-css',
    label: '插入 CSS',
    icon: '#',
    group: '插入',
    execute: (view) => {
      const { main } = view.state.selection;
      view.dispatch({
        changes: { from: main.from, insert: '<style>\n\n</style>' },
        selection: { anchor: main.from + 8 },
      });
    },
  });

  commandRegistry.register({
    id: 'code-copy',
    label: '复制代码',
    icon: '📋',
    group: '格式',
    execute: (view) => {
      const { state } = view;
      const { main } = state.selection;
      const text = main.empty
        ? blockTextAt(state, main.head)
        : state.doc.sliceString(main.from, main.to);
      // Fire-and-forget: a denied clipboard must never throw out of execute().
      void navigator.clipboard?.writeText(text).catch(() => {});
    },
  });

  commandRegistry.register({
    id: 'heading-1',
    label: '一级标题',
    icon: 'H1',
    group: '块',
    execute: (view) => {
      const { main } = view.state.selection;
      view.dispatch({
        changes: { from: main.from, insert: '# ' },
        selection: { anchor: main.from + 2 },
      });
    },
  });

  commandRegistry.register({
    id: 'heading-2',
    label: '二级标题',
    icon: 'H2',
    group: '块',
    execute: (view) => {
      const { main } = view.state.selection;
      view.dispatch({
        changes: { from: main.from, insert: '## ' },
        selection: { anchor: main.from + 3 },
      });
    },
  });

  commandRegistry.register({
    id: 'heading-3',
    label: '三级标题',
    icon: 'H3',
    group: '块',
    execute: (view) => {
      const { main } = view.state.selection;
      view.dispatch({
        changes: { from: main.from, insert: '### ' },
        selection: { anchor: main.from + 4 },
      });
    },
  });

  commandRegistry.register({
    id: 'structure-check',
    label: '结构体检',
    icon: '✓',
    group: '体检',
    execute: (view) => {
      // The linter runs automatically via the extension; this entry exists so
      // the command palette can surface "结构体检" as a command row.
      void view;
    },
  });
}

// Auto-register on module load.
registerEditorCommands();
