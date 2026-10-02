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
import { toggleStructureLinter } from './structure-linter-extension';
import { computeBlockTurnInto, computeMinimalChange, type BlockTurnIntoTarget } from './block-handle-ops';

// --- Wrapping helpers (toggle-aware) ----------------------------------------

/**
 * Toggle-wrap a selection with `before`/`after` markers.
 *
 * Toggle semantics (ticket #260): clicking a format on already-formatted
 * text removes the markers instead of re-wrapping.
 *
 * Detection (lightweight string match, no HTML parser):
 * 1. The selection itself starts with `before` and ends with `after`
 *    (markers are inside the selection range) → strip them.
 * 2. The selection is immediately surrounded by `before`…`after` (markers
 *    sit just outside the selection range — the common case when the user
 *    double-clicks the visible content of a decorated region) → remove them.
 * 3. Otherwise → wrap, and leave the inner content selected so a second
 *    click toggles the format off.
 *
 * Empty selection → insert `before + after` and place the caret between
 * them (no toggle on an empty range).
 */
function toggleWrap(
  view: EditorView,
  before: string,
  after: string,
): boolean {
  const { state } = view;
  const { main } = state.selection;
  const { from, to } = main;

  if (!main.empty) {
    const selected = state.doc.sliceString(from, to);

    // Case 1: markers are inside the selection (`**text**` selected whole).
    if (
      selected.length >= before.length + after.length &&
      selected.startsWith(before) &&
      selected.endsWith(after)
    ) {
      const inner = selected.slice(before.length, selected.length - after.length);
      view.dispatch({
        changes: { from, to, insert: inner },
        selection: { anchor: from, head: from + inner.length },
      });
      return true;
    }

    // Case 2: markers sit just outside the selection (visible content selected).
    const prefix = from >= before.length ? state.doc.sliceString(from - before.length, from) : '';
    const suffix = state.doc.sliceString(to, to + after.length);
    if (prefix === before && suffix === after) {
      view.dispatch({
        changes: [
          { from: from - before.length, to: from, insert: '' },
          { from: to, to: to + after.length, insert: '' },
        ],
        selection: { anchor: from - before.length, head: to - before.length },
      });
      return true;
    }

    // Case 3: wrap. Keep the inner content selected so a second click toggles off.
    view.dispatch({
      changes: [
        { from, insert: before },
        { from: to, insert: after },
      ],
      selection: { anchor: from + before.length, head: from + before.length + selected.length },
    });
    return true;
  }

  // Empty selection — insert pair with caret inside.
  view.dispatch({
    changes: { from, insert: `${before}${after}` },
    selection: { anchor: from + before.length },
  });
  return true;
}

/**
 * Toggle alignment of the block containing the selection by wrapping it in a
 * Pandoc fenced div `::: {.align-left|center|right}`.
 *
 * Toggle semantics:
 * - If the block is already wrapped with the SAME alignment class → remove the wrapper.
 * - If the block is wrapped with a DIFFERENT alignment class → replace the class.
 * - If the block has no alignment wrapper → insert the new wrapper.
 *
 * Uses a single `dispatch` for undo atomicity.
 */
export function toggleBlockAlignment(
  view: EditorView,
  alignment: 'left' | 'center' | 'right',
): boolean {
  const { state } = view;
  const { main } = state.selection;
  // Use main.from for non-empty selection (guaranteed inside the block);
  // main.head can land on the exclusive end of a half-open block range.
  const pos = main.empty ? main.head : main.from;
  const blocks = getBlocks(state);
  const block = getBlockAt(pos, blocks);

  if (!block) return false;

  const blockText = state.doc.sliceString(block.from, block.to);

  // Check if block is already wrapped with an alignment fenced div
  const existingAlignMatch = blockText.match(/^:::\s*\{\.align-(left|center|right)\}\s*\n/);
  const hasCloseMarker = blockText.trimEnd().endsWith(':::');

  if (existingAlignMatch && hasCloseMarker) {
    const existingAlignment = existingAlignMatch[1];

    if (existingAlignment === alignment) {
      // Same alignment → remove wrapper (toggle off)
      const openLineEnd = blockText.indexOf('\n');
      const innerStart = openLineEnd + 1;
      const innerEnd = blockText.lastIndexOf('\n:::');
      const innerContent = blockText.slice(innerStart, innerEnd);

      view.dispatch({
        changes: { from: block.from, to: block.to, insert: innerContent },
        selection: { anchor: block.from, head: block.from + innerContent.length },
      });
      return true;
    } else {
      // Different alignment → replace the class
      const openLineEnd = blockText.indexOf('\n');
      const newOpenLine = `::: {.align-${alignment}}`;
      const innerStart = openLineEnd + 1;
      const innerEnd = blockText.lastIndexOf('\n:::');
      const innerContent = blockText.slice(innerStart, innerEnd);

      view.dispatch({
        changes: { from: block.from, to: block.to, insert: `${newOpenLine}\n${innerContent}\n:::` },
        selection: { anchor: block.from, head: block.from + newOpenLine.length + 1 + innerContent.length },
      });
      return true;
    }
  }

  // No existing alignment wrapper → wrap the block
  const wrapped = `::: {.align-${alignment}}\n${blockText}\n:::`;
  const openLineLen = `::: {.align-${alignment}}`.length + 1; // +1 for newline
  view.dispatch({
    changes: { from: block.from, to: block.to, insert: wrapped },
    // Keep inner content selected so a second click toggles off (mirrors toggleWrap Case 3)
    selection: { anchor: block.from + openLineLen, head: block.from + openLineLen + blockText.length },
  });
  return true;
}

/**
 * Remove any alignment fenced div wrapper from the block containing the selection.
 */
export function clearBlockAlignment(view: EditorView): boolean {
  const { state } = view;
  const { main } = state.selection;
  // Use main.from for non-empty selection (guaranteed inside the block);
  // main.head can land on the exclusive end of a half-open block range.
  const pos = main.empty ? main.head : main.from;
  const blocks = getBlocks(state);
  const block = getBlockAt(pos, blocks);

  if (!block) return false;

  const blockText = state.doc.sliceString(block.from, block.to);
  const existingAlignMatch = blockText.match(/^:::\s*\{\.align-(left|center|right)\}\s*\n/);
  const hasCloseMarker = blockText.trimEnd().endsWith(':::');

  if (existingAlignMatch && hasCloseMarker) {
    const openLineEnd = blockText.indexOf('\n');
    const innerStart = openLineEnd + 1;
    const innerEnd = blockText.lastIndexOf('\n:::');
    const innerContent = blockText.slice(innerStart, innerEnd);

    view.dispatch({
      changes: { from: block.from, to: block.to, insert: innerContent },
      selection: { anchor: block.from, head: block.from + innerContent.length },
    });
    return true;
  }

  return false;
}

/**
 * Toggle column layout of the block containing the selection by wrapping it in a
 * Pandoc fenced div `::: {.col-2|col-3}`.
 *
 * Toggle semantics (mirrors toggleBlockAlignment):
 * - If the block is already wrapped with the SAME column class → remove the wrapper.
 * - If the block is wrapped with a DIFFERENT column class → replace the class.
 * - If the block has no column wrapper → insert the new wrapper.
 *
 * Uses a single `dispatch` for undo atomicity.
 */
export function toggleBlockColumns(
  view: EditorView,
  columns: 'col-2' | 'col-3',
): boolean {
  const { state } = view;
  const { main } = state.selection;
  // Use main.from for non-empty selection (guaranteed inside the block);
  // main.head can land on the exclusive end of a half-open block range.
  const pos = main.empty ? main.head : main.from;
  const blocks = getBlocks(state);
  const block = getBlockAt(pos, blocks);

  if (!block) return false;

  const blockText = state.doc.sliceString(block.from, block.to);

  // Check if block is already wrapped with a column fenced div
  const existingColMatch = blockText.match(/^:::\s*\{\.(col-2|col-3)\}\s*\n/);
  const hasCloseMarker = blockText.trimEnd().endsWith(':::');

  if (existingColMatch && hasCloseMarker) {
    const existingColumns = existingColMatch[1];

    if (existingColumns === columns) {
      // Same columns → remove wrapper (toggle off)
      const openLineEnd = blockText.indexOf('\n');
      const innerStart = openLineEnd + 1;
      const innerEnd = blockText.lastIndexOf('\n:::');
      const innerContent = blockText.slice(innerStart, innerEnd);

      view.dispatch({
        changes: { from: block.from, to: block.to, insert: innerContent },
        selection: { anchor: block.from, head: block.from + innerContent.length },
      });
      return true;
    } else {
      // Different columns → replace the class
      const openLineEnd = blockText.indexOf('\n');
      const newOpenLine = `::: {.${columns}}`;
      const innerStart = openLineEnd + 1;
      const innerEnd = blockText.lastIndexOf('\n:::');
      const innerContent = blockText.slice(innerStart, innerEnd);

      view.dispatch({
        changes: { from: block.from, to: block.to, insert: `${newOpenLine}\n${innerContent}\n:::` },
        selection: { anchor: block.from, head: block.from + newOpenLine.length + 1 + innerContent.length },
      });
      return true;
    }
  }

  // No existing column wrapper → wrap the block
  const wrapped = `::: {.${columns}}\n${blockText}\n:::`;
  const openLineLen = `::: {.${columns}}`.length + 1; // +1 for newline
  view.dispatch({
    changes: { from: block.from, to: block.to, insert: wrapped },
    // Keep inner content selected so a second click toggles off (mirrors toggleWrap Case 3)
    selection: { anchor: block.from + openLineLen, head: block.from + openLineLen + blockText.length },
  });
  return true;
}

/**
 * Remove any column fenced div wrapper from the block containing the selection.
 */
export function clearBlockColumns(view: EditorView): boolean {
  const { state } = view;
  const { main } = state.selection;
  // Use main.from for non-empty selection (guaranteed inside the block);
  // main.head can land on the exclusive end of a half-open block range.
  const pos = main.empty ? main.head : main.from;
  const blocks = getBlocks(state);
  const block = getBlockAt(pos, blocks);

  if (!block) return false;

  const blockText = state.doc.sliceString(block.from, block.to);
  const existingColMatch = blockText.match(/^:::\s*\{\.(col-2|col-3)\}\s*\n/);
  const hasCloseMarker = blockText.trimEnd().endsWith(':::');

  if (existingColMatch && hasCloseMarker) {
    const openLineEnd = blockText.indexOf('\n');
    const innerStart = openLineEnd + 1;
    const innerEnd = blockText.lastIndexOf('\n:::');
    const innerContent = blockText.slice(innerStart, innerEnd);

    view.dispatch({
      changes: { from: block.from, to: block.to, insert: innerContent },
      selection: { anchor: block.from, head: block.from + innerContent.length },
    });
    return true;
  }

  return false;
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
      toggleWrap(view, '**', '**');
    },
  });

  commandRegistry.register({
    id: 'toggle-italic',
    label: '斜体',
    icon: 'I',
    group: '格式',
    keyBinding: 'Mod-i',
    execute: (view) => {
      toggleWrap(view, '*', '*');
    },
  });

  commandRegistry.register({
    id: 'toggle-strikethrough',
    label: '删除线',
    icon: 'S',
    group: '格式',
    keyBinding: 'Mod-Shift-x',
    execute: (view) => {
      toggleWrap(view, '~~', '~~');
    },
  });

  commandRegistry.register({
    id: 'toggle-underline',
    label: '下划线',
    icon: 'U',
    group: '格式',
    execute: (view) => {
      toggleWrap(view, '<u>', '</u>');
    },
  });

  commandRegistry.register({
    id: 'toggle-code',
    label: '行内代码',
    icon: '`',
    group: '格式',
    keyBinding: 'Mod-e',
    execute: (view) => {
      toggleWrap(view, '`', '`');
    },
  });

  commandRegistry.register({
    id: 'toggle-link',
    label: '插入链接',
    icon: '🔗',
    group: '插入',
    keyBinding: 'Mod-l',
    execute: (view) => {
      // Reuse toggleWrap for the bracket pair so a second click removes the
      // link wrapper. `](url)` is the literal closing marker — toggling it off
      // restores the bare text. (url) defaults to "url" as the placeholder.
      toggleWrap(view, '[', '](url)');
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
      // Issue #206: inline diagnostics are opt-in, so this command is the
      // real switch — the always-on surface is the left-rail panel.
      toggleStructureLinter(view);
    },
  });

  /**
   * Toggle-wrap a selection with a class-based span.
   *
   * Toggle semantics (mirrors toggleWrap's 3 cases):
   * 1. Selection starts with `<span class="mdb-font-...">` and ends with `</span>`
   *    (markers inside selection) → strip them.
   * 2. Selection is immediately surrounded by `<span class="mdb-font-...">`…`</span>`
   *    (markers just outside selection — common when double-clicking decorated content)
   *    → remove them.
   * 3. Otherwise → wrap with the new class, replacing any existing mdb-font-* span.
   *
   * Empty selection → insert empty span pair with caret inside (no toggle on empty range).
   */
  function toggleFontClass(
    view: EditorView,
    className: 'mdb-font-serif' | 'mdb-font-mono' | 'mdb-font-sans',
  ): boolean {
    const { state } = view;
    const { main } = state.selection;
    const { from, to } = main;

    const openTag = `<span class="${className}">`;
    const closeTag = '</span>';

    if (!main.empty) {
      const selected = state.doc.sliceString(from, to);

      if (
        selected.length >= openTag.length + closeTag.length &&
        selected.startsWith(openTag) &&
        selected.endsWith(closeTag)
      ) {
        const inner = selected.slice(openTag.length, selected.length - closeTag.length);
        view.dispatch({
          changes: { from, to, insert: inner },
          selection: { anchor: from, head: from + inner.length },
        });
        return true;
      }

      const prefix = from >= openTag.length ? state.doc.sliceString(from - openTag.length, from) : '';
      const suffix = state.doc.sliceString(to, to + closeTag.length);
      if (prefix === openTag && suffix === closeTag) {
        view.dispatch({
          changes: [
            { from: from - openTag.length, to: from, insert: '' },
            { from: to, to: to + closeTag.length, insert: '' },
          ],
          selection: { anchor: from - openTag.length, head: to - openTag.length },
        });
        return true;
      }

      const contextBefore = from >= 60 ? state.doc.sliceString(from - 60, from) : state.doc.sliceString(0, from);
      const contextAfter = state.doc.sliceString(to, to + 20);

      const existingOpenMatch = contextBefore.match(/<span class="(mdb-font-\w+)">/);
      const existingCloseMatch = contextAfter.match(/^<\/span>/);

      if (existingOpenMatch && existingCloseMatch) {
        const existingClass = existingOpenMatch[1];
        const existingOpenTag = `<span class="${existingClass}">`;
        const openTagPos = contextBefore.lastIndexOf(existingOpenTag);
        const absoluteOpenPos = from - contextBefore.length + openTagPos;
        view.dispatch({
          changes: [
            { from: absoluteOpenPos, to: absoluteOpenPos + existingOpenTag.length, insert: openTag },
            { from: to, to: to + closeTag.length, insert: closeTag },
          ],
          selection: { anchor: absoluteOpenPos + openTag.length, head: absoluteOpenPos + openTag.length + selected.length },
        });
        return true;
      }

      view.dispatch({
        changes: [
          { from, insert: openTag },
          { from: to, insert: closeTag },
        ],
        selection: { anchor: from + openTag.length, head: from + openTag.length + selected.length },
      });
      return true;
    }

    view.dispatch({
      changes: { from, insert: `${openTag}${closeTag}` },
      selection: { anchor: from + openTag.length },
    });
    return true;
  }

  /**
   * Toggle-wrap a selection with a color class-based span.
   * Same 3-case toggle semantics as toggleFontClass.
   */
  function toggleColorClass(
    view: EditorView,
    className: 'mdb-color-red' | 'mdb-color-blue' | 'mdb-color-green' | 'mdb-color-orange' | 'mdb-color-purple',
  ): boolean {
    const { state } = view;
    const { main } = state.selection;
    const { from, to } = main;

    const openTag = `<span class="${className}">`;
    const closeTag = '</span>';

    if (!main.empty) {
      const selected = state.doc.sliceString(from, to);

      if (
        selected.length >= openTag.length + closeTag.length &&
        selected.startsWith(openTag) &&
        selected.endsWith(closeTag)
      ) {
        const inner = selected.slice(openTag.length, selected.length - closeTag.length);
        view.dispatch({
          changes: { from, to, insert: inner },
          selection: { anchor: from, head: from + inner.length },
        });
        return true;
      }

      const prefix = from >= openTag.length ? state.doc.sliceString(from - openTag.length, from) : '';
      const suffix = state.doc.sliceString(to, to + closeTag.length);
      if (prefix === openTag && suffix === closeTag) {
        view.dispatch({
          changes: [
            { from: from - openTag.length, to: from, insert: '' },
            { from: to, to: to + closeTag.length, insert: '' },
          ],
          selection: { anchor: from - openTag.length, head: to - openTag.length },
        });
        return true;
      }

      const contextBefore = from >= 60 ? state.doc.sliceString(from - 60, from) : state.doc.sliceString(0, from);
      const contextAfter = state.doc.sliceString(to, to + 20);

      const existingOpenMatch = contextBefore.match(/<span class="(mdb-color-\w+)">/);
      const existingCloseMatch = contextAfter.match(/^<\/span>/);

      if (existingOpenMatch && existingCloseMatch) {
        const existingClass = existingOpenMatch[1];
        const existingOpenTag = `<span class="${existingClass}">`;
        const openTagPos = contextBefore.lastIndexOf(existingOpenTag);
        const absoluteOpenPos = from - contextBefore.length + openTagPos;
        view.dispatch({
          changes: [
            { from: absoluteOpenPos, to: absoluteOpenPos + existingOpenTag.length, insert: openTag },
            { from: to, to: to + closeTag.length, insert: closeTag },
          ],
          selection: { anchor: absoluteOpenPos + openTag.length, head: absoluteOpenPos + openTag.length + selected.length },
        });
        return true;
      }

      view.dispatch({
        changes: [
          { from, insert: openTag },
          { from: to, insert: closeTag },
        ],
        selection: { anchor: from + openTag.length, head: from + openTag.length + selected.length },
      });
      return true;
    }

    view.dispatch({
      changes: { from, insert: `${openTag}${closeTag}` },
      selection: { anchor: from + openTag.length },
    });
    return true;
  }

  /**
   * Remove any mdb-font-* span around the selection.
   */
  function clearFontClass(view: EditorView): boolean {
    const { state } = view;
    const { main } = state.selection;
    const { from, to } = main;

    if (!main.empty) {
      const contextBefore = from >= 60 ? state.doc.sliceString(from - 60, from) : state.doc.sliceString(0, from);
      const contextAfter = state.doc.sliceString(to, to + 20);

      const existingOpenMatch = contextBefore.match(/<span class="(mdb-font-\w+)">/);
      const existingCloseMatch = contextAfter.match(/^<\/span>/);

      if (existingOpenMatch && existingCloseMatch) {
        const existingClass = existingOpenMatch[1];
        const existingOpenTag = `<span class="${existingClass}">`;
        const openTagPos = contextBefore.lastIndexOf(existingOpenTag);
        const absoluteOpenPos = from - contextBefore.length + openTagPos;
        const closeTag = '</span>';
        view.dispatch({
          changes: [
            { from: absoluteOpenPos, to: absoluteOpenPos + existingOpenTag.length, insert: '' },
            { from: to, to: to + closeTag.length, insert: '' },
          ],
          selection: { anchor: absoluteOpenPos, head: to - existingOpenTag.length },
        });
        return true;
      }
    }
    return false;
  }

  /**
   * Remove any mdb-color-* span around the selection.
   */
  function clearColorClass(view: EditorView): boolean {
    const { state } = view;
    const { main } = state.selection;
    const { from, to } = main;

    if (!main.empty) {
      const contextBefore = from >= 60 ? state.doc.sliceString(from - 60, from) : state.doc.sliceString(0, from);
      const contextAfter = state.doc.sliceString(to, to + 20);

      const existingOpenMatch = contextBefore.match(/<span class="(mdb-color-\w+)">/);
      const existingCloseMatch = contextAfter.match(/^<\/span>/);

      if (existingOpenMatch && existingCloseMatch) {
        const existingClass = existingOpenMatch[1];
        const existingOpenTag = `<span class="${existingClass}">`;
        const openTagPos = contextBefore.lastIndexOf(existingOpenTag);
        const absoluteOpenPos = from - contextBefore.length + openTagPos;
        const closeTag = '</span>';
        view.dispatch({
          changes: [
            { from: absoluteOpenPos, to: absoluteOpenPos + existingOpenTag.length, insert: '' },
            { from: to, to: to + closeTag.length, insert: '' },
          ],
          selection: { anchor: absoluteOpenPos, head: to - existingOpenTag.length },
        });
        return true;
      }
    }
    return false;
  }

  commandRegistry.register({
    id: 'font-serif',
    label: '衬线',
    group: '格式',
    execute: (view) => {
      toggleFontClass(view, 'mdb-font-serif');
    },
  });

  commandRegistry.register({
    id: 'font-mono',
    label: '等宽',
    group: '格式',
    execute: (view) => {
      toggleFontClass(view, 'mdb-font-mono');
    },
  });

  commandRegistry.register({
    id: 'font-sans',
    label: '无衬线',
    group: '格式',
    execute: (view) => {
      toggleFontClass(view, 'mdb-font-sans');
    },
  });

  commandRegistry.register({
    id: 'font-clear',
    label: '清除字体',
    group: '格式',
    execute: (view) => {
      clearFontClass(view);
    },
  });

  commandRegistry.register({
    id: 'color-red',
    label: '红色',
    group: '格式',
    execute: (view) => {
      toggleColorClass(view, 'mdb-color-red');
    },
  });

  commandRegistry.register({
    id: 'color-blue',
    label: '蓝色',
    group: '格式',
    execute: (view) => {
      toggleColorClass(view, 'mdb-color-blue');
    },
  });

  commandRegistry.register({
    id: 'color-green',
    label: '绿色',
    group: '格式',
    execute: (view) => {
      toggleColorClass(view, 'mdb-color-green');
    },
  });

  commandRegistry.register({
    id: 'color-orange',
    label: '橙色',
    group: '格式',
    execute: (view) => {
      toggleColorClass(view, 'mdb-color-orange');
    },
  });

  commandRegistry.register({
    id: 'color-purple',
    label: '紫色',
    group: '格式',
    execute: (view) => {
      toggleColorClass(view, 'mdb-color-purple');
    },
  });

  commandRegistry.register({
    id: 'color-clear',
    label: '清除颜色',
    group: '格式',
    execute: (view) => {
      clearColorClass(view);
    },
  });

  commandRegistry.register({
    id: 'align-left',
    label: '左对齐',
    group: '块',
    execute: (view) => {
      toggleBlockAlignment(view, 'left');
    },
  });

  commandRegistry.register({
    id: 'align-center',
    label: '居中',
    group: '块',
    execute: (view) => {
      toggleBlockAlignment(view, 'center');
    },
  });

  commandRegistry.register({
    id: 'align-right',
    label: '右对齐',
    group: '块',
    execute: (view) => {
      toggleBlockAlignment(view, 'right');
    },
  });

  commandRegistry.register({
    id: 'align-clear',
    label: '清除对齐',
    group: '块',
    execute: (view) => {
      clearBlockAlignment(view);
    },
  });

  commandRegistry.register({
    id: 'col-2',
    label: '2 栏',
    group: '块',
    execute: (view) => {
      toggleBlockColumns(view, 'col-2');
    },
  });

  commandRegistry.register({
    id: 'col-3',
    label: '3 栏',
    group: '块',
    execute: (view) => {
      toggleBlockColumns(view, 'col-3');
    },
  });

  commandRegistry.register({
    id: 'col-clear',
    label: '清除分栏',
    group: '块',
    execute: (view) => {
      clearBlockColumns(view);
    },
  });

  // --- Turn-into commands (ticket #277 task 3.1) ------------------------------

  /**
   * Execute a turn-into command on the block(s) spanned by the selection.
   * Expands partial selection to the whole block, unions multi-block selections,
   * and applies computeBlockTurnInto with minimal change dispatch.
   */
  function executeTurnInto(view: EditorView, target: BlockTurnIntoTarget): boolean {
    const { state } = view;
    const { main } = state.selection;

    // Empty selection → no-op (guard)
    if (main.empty) return false;

    // Use main.from for non-empty selection (guaranteed inside the block);
    // main.head can land on the exclusive end of a half-open block range.
    const pos = main.from;
    const blocks = getBlocks(state);
    const firstBlock = getBlockAt(pos, blocks);

    if (!firstBlock) return false;

    // Find all blocks that intersect the selection range [main.from, main.to)
    const selectedBlocks = blocks.filter(
      (b) => b.to > main.from && b.from < main.to,
    );

    // Union the block range: from first block's from to last block's to
    const unionFrom = selectedBlocks[0].from;
    const unionTo = selectedBlocks[selectedBlocks.length - 1].to;

    const docText = state.doc.toString();
    const nextText = computeBlockTurnInto(docText, unionFrom, unionTo, target);

    // No change → no-op
    if (nextText === docText) return false;

    const change = computeMinimalChange(docText, nextText);
    view.dispatch({
      changes: { from: change.from, to: change.to, insert: change.insert },
      // Keep selection anchored at the start of the changed range
      selection: { anchor: change.from, head: change.from + change.insert.length },
    });
    return true;
  }

  const TURN_INTO_TARGETS: readonly { id: string; label: string; target: BlockTurnIntoTarget }[] = [
    { id: 'turn-into-h1', label: '一级标题', target: 'h1' },
    { id: 'turn-into-h2', label: '二级标题', target: 'h2' },
    { id: 'turn-into-h3', label: '三级标题', target: 'h3' },
    { id: 'turn-into-h4', label: '四级标题', target: 'h4' },
    { id: 'turn-into-h5', label: '五级标题', target: 'h5' },
    { id: 'turn-into-h6', label: '六级标题', target: 'h6' },
    { id: 'turn-into-paragraph', label: '正文', target: 'paragraph' },
    { id: 'turn-into-list', label: '列表', target: 'list' },
    { id: 'turn-into-task', label: '任务', target: 'task' },
    { id: 'turn-into-quote', label: '引用', target: 'quote' },
    { id: 'turn-into-code', label: '代码', target: 'code' },
    { id: 'turn-into-callout', label: '高亮', target: 'callout' },
    { id: 'turn-into-table', label: '表格', target: 'table' },
  ];

  for (const { id, label, target } of TURN_INTO_TARGETS) {
    commandRegistry.register({
      id,
      label,
      group: '块',
      execute: (view) => {
        executeTurnInto(view, target);
      },
    });
  }
}

// Auto-register on module load.
registerEditorCommands();
