/* MD-Bundle Smart Input System.
 *
 * Provides intelligent text editing behaviors:
 * 1. Markdown shortcuts: `# ` → H1, `- ` → list, `1. ` → ordered list, etc.
 * 2. Smart Enter: continue list on empty item, exit list on double Enter,
 *    continue blockquote, keep indent in code block.
 * 3. Smart Backspace: cancel list at start, cancel blockquote at start.
 * 4. Auto-pairing: `**`, `` ` ``, `$`, `[`, `![` wrap selection or create pair.
 * 5. Chinese punctuation: `「` → `「」`, `（` → `（）`.
 *
 * Markdown shortcuts, smart Enter/Backspace, and heading Tab use CM6 keymap.
 * Auto-pairing uses EditorView.inputHandler (keymap cannot express multi-char
 * triggers like `**` or context-dependent triggers like `[` after `!`).
 */

import { EditorView, keymap, ViewPlugin } from '@codemirror/view';
import { type EditorState, type Extension } from '@codemirror/state';

// --- IME composition guard ---------------------------------------------------

/**
 * Module-level composing flag. Set by the compositionGuardPlugin's
 * eventHandlers, read by the auto-pair inputHandler.
 *
 * Safe for multi-editor instances: IME composition is browser-singleton.
 */
let composing = false;

// --- Markdown shortcuts -----------------------------------------------------

/**
 * Handle markdown shortcut expansion.
 * Returns true if a shortcut was matched and applied.
 */
export function handleMarkdownShortcut(view: EditorView): boolean {
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  const textBeforeCursor = line.text.slice(0, view.state.selection.main.head - line.from);

  // Task list shortcuts — MUST be checked before plain bullet `- `.
  const taskMatch = textBeforeCursor.match(/^(- \[[ xX]\] )/);
  if (taskMatch) {
    const from = line.from;
    const to = view.state.selection.main.head;
    view.dispatch({
      changes: { from, to, insert: '' },
      selection: { anchor: from },
      scrollIntoView: true,
    });
    return true;
  }

  // Heading shortcuts: `# ` through `###### ` — strip the marker, leave caret
  // at line start so the user can keep typing the heading text.
  const headingMatch = textBeforeCursor.match(/^(#{1,6} )/);
  if (headingMatch) {
    const marker = headingMatch[1];
    const from = line.from;
    const to = view.state.selection.main.head;
    view.dispatch({
      changes: { from, to, insert: '' },
      selection: { anchor: from },
      scrollIntoView: true,
    });
    const level = marker.trim().length;
    setHeadingLevel(view, level);
    return true;
  }

  // List shortcuts (-, *, +, 1.) — CM6 markdown handles these natively.
  if (/^[-*+] $/.test(textBeforeCursor) || /^\d+\. $/.test(textBeforeCursor)) {
    return true;
  }

  // Blockquote: `>` followed by space — already valid markdown.
  if (textBeforeCursor === '> ') {
    return true;
  }

  // Callout folding: `> [!tip]-` or `> [!tip]+` or `> [!NOTE]-` etc.
  const calloutFoldMatch = textBeforeCursor.match(/^> \[!([a-zA-Z]+)\]([+-]) $/);
  if (calloutFoldMatch) {
    const type = calloutFoldMatch[1];
    const foldState = calloutFoldMatch[2];
    const from = line.from;
    const to = view.state.selection.main.head;
    const replacement = `> [!${type}]${foldState}\n> `;
    view.dispatch({
      changes: { from, to, insert: replacement },
      selection: { anchor: from + replacement.length },
      scrollIntoView: true,
    });
    return true;
  }

  // Code fence: ``` followed by space — expand to fenced block.
  if (textBeforeCursor === '``` ') {
    const from = line.from;
    const to = view.state.selection.main.head;
    view.dispatch({
      changes: { from, to, insert: '```\n\n```' },
      selection: { anchor: from + 3 },
      scrollIntoView: true,
    });
    return true;
  }

  return false;
}

// --- Heading level tracking --------------------------------------------------

const headingLevels = new WeakMap<EditorView, number>();

function setHeadingLevel(view: EditorView, level: number): void {
  headingLevels.set(view, level);
}

function getHeadingLevel(view: EditorView): number | undefined {
  return headingLevels.get(view);
}

// --- Heading promote/demote (Tab / Shift+Tab) -------------------------------

/**
 * Handle Tab on a heading line: demote (H1→H2, etc.), clamped to H6.
 */
export function demoteHeading(view: EditorView): boolean {
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  const currentLevel = getHeadingLevel(view);

  if (currentLevel === undefined) return false;
  if (currentLevel >= 6) return false;

  const newLevel = currentLevel + 1;
  const newMarker = '#'.repeat(newLevel) + ' ';
  const from = line.from;
  const to = from + currentLevel + 1;

  view.dispatch({
    changes: { from, to, insert: newMarker },
    selection: { anchor: view.state.selection.main.head },
    scrollIntoView: true,
  });
  headingLevels.set(view, newLevel);
  return true;
}

/**
 * Handle Shift+Tab on a heading line: promote (H2→H1, etc.), clamped to H1.
 */
export function promoteHeading(view: EditorView): boolean {
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  const currentLevel = getHeadingLevel(view);

  if (currentLevel === undefined) return false;
  if (currentLevel <= 1) return false;

  const newLevel = currentLevel - 1;
  const newMarker = '#'.repeat(newLevel) + ' ';
  const from = line.from;
  const to = from + currentLevel + 1;

  view.dispatch({
    changes: { from, to, insert: newMarker },
    selection: { anchor: view.state.selection.main.head },
    scrollIntoView: true,
  });
  headingLevels.set(view, newLevel);
  return true;
}

// --- Smart Enter ------------------------------------------------------------

/**
 * Handle smart Enter behavior:
 * - In a list: continue the list marker, or exit on empty item
 * - In a blockquote: continue the quote marker
 * - In a code block: preserve indentation
 * - Otherwise: default behavior
 */
export function smartEnter(view: EditorView): boolean {
  const { selection } = view.state;
  const { main } = selection;
  const line = view.state.doc.lineAt(main.head);
  const lineText = line.text;
  const cursorInLine = main.head - line.from;

  if (main.head !== line.to && cursorInLine < lineText.length) {
    return false;
  }

  const listMatch = lineText.match(/^(\s*)([-*+]|\d+\.)\s*(.*)/);
  if (listMatch) {
    const [, indent, marker, content] = listMatch;

    if (content.trim() === '') {
      view.dispatch({
        changes: [
          { from: line.from, to: line.to, insert: '' },
        ],
        selection: { anchor: line.from + indent.length },
        scrollIntoView: true,
      });
      return true;
    }

    const newMarker = /^\d+\./.test(marker) ? `${parseInt(marker) + 1}. ` : `${marker} `;
    const insert = `\n${indent}${newMarker}`;
    view.dispatch({
      changes: { from: main.head, insert },
      selection: { anchor: main.head + insert.length },
      scrollIntoView: true,
    });
    return true;
  }

  const quoteMatch = lineText.match(/^(\s*)(>+)\s?(.*)/);
  if (quoteMatch) {
    const [, indent, markers, content] = quoteMatch;

    if (content.trim() === '') {
      view.dispatch({
        changes: [{ from: line.from, to: line.to, insert: '' }],
        selection: { anchor: line.from + indent.length },
        scrollIntoView: true,
      });
      return true;
    }

    const insert = `\n${indent}${markers} `;
    view.dispatch({
      changes: { from: main.head, insert },
      selection: { anchor: main.head + insert.length },
      scrollIntoView: true,
    });
    return true;
  }

  const codeMatch = lineText.match(/^(\s+)(.*)/);
  if (codeMatch && isInsideCodeBlock(view.state, main.head)) {
    const [, indent] = codeMatch;
    const insert = `\n${indent}`;
    view.dispatch({
      changes: { from: main.head, insert },
      selection: { anchor: main.head + insert.length },
      scrollIntoView: true,
    });
    return true;
  }

  return false;
}

function isInsideCodeBlock(state: EditorState, pos: number): boolean {
  const line = state.doc.lineAt(pos);
  const lineNum = line.number;
  let fenceCount = 0;
  for (let i = 1; i < lineNum; i++) {
    const prevLine = state.doc.line(i);
    if (prevLine.text.trim().startsWith('```')) {
      fenceCount++;
    }
  }
  return fenceCount % 2 === 1;
}

// --- Smart Backspace -------------------------------------------------------

/**
 * Handle smart Backspace behavior:
 * - At the start of a list item: remove the list marker
 * - At the start of a blockquote: remove the quote marker
 * - Otherwise: default behavior
 */
export function smartBackspace(view: EditorView): boolean {
  const { selection } = view.state;
  const { main } = selection;

  if (!main.empty) return false;

  const line = view.state.doc.lineAt(main.head);
  const lineText = line.text;
  const cursorInLine = main.head - line.from;

  const listMatch = lineText.match(/^(\s*)([-*+]|\d+\.)\s$/);
  if (listMatch && cursorInLine === lineText.length) {
    const [, indent] = listMatch;
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: indent },
      selection: { anchor: line.from + indent.length },
      scrollIntoView: true,
    });
    return true;
  }

  const quoteMatch = lineText.match(/^(\s*)>\s?$/);
  if (quoteMatch && cursorInLine === lineText.length) {
    const [, indent] = quoteMatch;
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: indent },
      selection: { anchor: line.from + indent.length },
      scrollIntoView: true,
    });
    return true;
  }

  return false;
}

// --- Auto-pairing via inputHandler ------------------------------------------
//
// Auto-pairing is an input concern (depends on the typed character AND the
// character before the caret), so it uses EditorView.inputHandler rather than
// keymap. Keymap bindings like `key: '**'` are silently discarded by CM6 —
// only single characters or known key names are valid.

/**
 * Characters that trigger auto-pairing (legacy API, kept for public export).
 * The actual pairing logic lives in autoPairInputHandler below.
 */
const PAIR_MAP: Record<string, string> = {
  '**': '**',
  '`': '`',
  '$': '$',
  '[': ']',
  '![': '](',
};

/**
 * Handle auto-pairing for the typed character.
 * Legacy export — the live pairing logic is in autoPairInputHandler.
 * Kept for API compatibility (public-api.test.ts pins this export).
 */
export function handleAutoPair(view: EditorView, char: string): boolean {
  const pair = PAIR_MAP[char];
  if (!pair) return false;

  const { selection } = view.state;
  const { main } = selection;

  if (!main.empty) {
    const selectedText = view.state.doc.sliceString(main.from, main.to);
    const isImage = char === '![';
    const open = isImage ? '![' : char;
    const close = isImage ? '](url)' : pair;

    view.dispatch({
      changes: [
        { from: main.from, insert: open },
        { from: main.to, insert: close },
      ],
      selection: { anchor: main.from + open.length + selectedText.length + close.length },
      scrollIntoView: true,
    });
    return true;
  }

  const insert = char + pair;
  view.dispatch({
    changes: { from: main.head, insert },
    selection: { anchor: main.head + char.length },
    scrollIntoView: true,
  });
  return true;
}

/**
 * Chinese punctuation auto-pairing (legacy API, kept for public export).
 * The actual pairing logic lives in autoPairInputHandler below.
 */
const CHINESE_PAIRS: Record<string, string> = {
  '「': '」',
  '『': '』',
  '（': '）',
  '【': '】',
  '《': '》',
  '〈': '〉',
  '“': '”',
  '‘': '’',
};

/**
 * Handle Chinese punctuation auto-pairing.
 * Legacy export — the live pairing logic is in autoPairInputHandler.
 * Kept for API compatibility (public-api.test.ts pins this export).
 */
export function handleChinesePair(view: EditorView, char: string): boolean {
  const close = CHINESE_PAIRS[char];
  if (!close) return false;

  const { selection } = view.state;
  const { main } = selection;

  if (!main.empty) {
    view.dispatch({
      changes: [
        { from: main.from, insert: char },
        { from: main.to, insert: close },
      ],
      selection: { anchor: main.to + 1 },
      scrollIntoView: true,
    });
    return true;
  }

  const insert = char + close;
  view.dispatch({
    changes: { from: main.head, insert },
    selection: { anchor: main.head + 1 },
    scrollIntoView: true,
  });
  return true;
}

const PAIR_CHARS: Record<string, string> = {
  '`': '`',
  '$': '$',
  '「': '」',
  '『': '』',
  '（': '）',
  '【': '】',
  '《': '》',
  '〈': '〉',
  '“': '”',
  '‘': '’',
};

/**
 * inputHandler for auto-pairing. Intercepts typed text before CM6 inserts it.
 *
 * Returns true to consume the input (pairing applied), false to fall through
 * to default CM6 behavior.
 *
 * Special cases:
 * - `*` pairs only when the previous char is also `*` (produces `**│**`).
 * - `[` pairs to `]`, or to `](url)` when preceded by `!` (image link).
 * - All other PAIR_CHARS insert an empty pair with the caret between.
 * - With a non-empty selection, wraps the selection with the pair.
 * - While IME composing, passes through unchanged.
 */
const autoPairInputHandler = EditorView.inputHandler.of(
  (view, from, to, text) => {
    if (composing) return false;
    if (text.length !== 1) return false;

    // ** : pair only when the PREVIOUS char is also '*'
    if (text === '*') {
      const before = view.state.sliceDoc(Math.max(0, from - 1), from);
      if (before === '*') {
        const selected = view.state.sliceDoc(from, to);
        if (selected) {
          view.dispatch({
            changes: [
              { from, insert: '**' },
              { from: to, insert: '**' },
            ],
            selection: { anchor: from + 2 + selected.length },
            scrollIntoView: true,
          });
        } else {
          view.dispatch({
            changes: { from, to, insert: '*' },
            selection: { anchor: from },
            scrollIntoView: true,
          });
        }
        return true;
      }
      return false;
    }

    // [ : pair to ']', or '](url)' when preceded by '!'
    if (text === '[') {
      const before = view.state.sliceDoc(Math.max(0, from - 1), from);
      const isImage = before === '!';
      const close = isImage ? '](url)' : ']';
      const selected = view.state.sliceDoc(from, to);
      if (selected) {
        const open = isImage ? '![' : '[';
        view.dispatch({
          changes: [
            { from, insert: open },
            { from: to, insert: close },
          ],
          selection: { anchor: from + open.length + selected.length },
          scrollIntoView: true,
        });
      } else {
        view.dispatch({
          changes: { from, to, insert: text + close },
          selection: { anchor: from + 1 },
          scrollIntoView: true,
        });
      }
      return true;
    }

    const close = PAIR_CHARS[text];
    if (!close) return false;

    const selected = view.state.sliceDoc(from, to);
    if (selected) {
      view.dispatch({
        changes: [
          { from, insert: text },
          { from: to, insert: close },
        ],
        selection: { anchor: from + 1 + selected.length },
        scrollIntoView: true,
      });
    } else {
      view.dispatch({
        changes: { from, to, insert: text + close },
        selection: { anchor: from + 1 },
        scrollIntoView: true,
      });
    }
    return true;
  },
);

// --- Keymap extensions ------------------------------------------------------

const markdownShortcutKeymap = keymap.of([
  {
    key: ' ',
    run: (view) => handleMarkdownShortcut(view),
  },
]);

const smartEnterKeymap = keymap.of([
  {
    key: 'Enter',
    run: (view) => smartEnter(view),
  },
]);

const smartBackspaceKeymap = keymap.of([
  {
    key: 'Backspace',
    run: (view) => smartBackspace(view),
  },
]);

const headingTabKeymap = keymap.of([
  {
    key: 'Tab',
    run: (view) => demoteHeading(view),
  },
  {
    key: 'Shift-Tab',
    run: (view) => promoteHeading(view),
  },
]);

/**
 * ViewPlugin that tracks IME composition state via DOM events.
 * Sets the module-level `composing` flag so the auto-pair inputHandler
 * can skip during active composition.
 */
const compositionGuardPlugin = ViewPlugin.define(() => ({}), {
  eventHandlers: {
    compositionstart() {
      composing = true;
    },
    compositionend() {
      composing = false;
    },
  },
});

/**
 * Combined smart input extension.
 * Enables all smart input behaviors.
 */
export function smartInput(): Extension {
  return [
    markdownShortcutKeymap,
    smartEnterKeymap,
    smartBackspaceKeymap,
    autoPairInputHandler,
    headingTabKeymap,
    compositionGuardPlugin,
  ];
}
