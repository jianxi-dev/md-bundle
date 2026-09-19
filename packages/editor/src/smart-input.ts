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
 * All behaviors are implemented as CM6 keymap extensions that return
 * `true` when they handle the event, `false` to fall through to default.
 */

import { EditorView, keymap, ViewPlugin } from '@codemirror/view';
import { type EditorState, type Extension } from '@codemirror/state';

// --- IME composition guard ---------------------------------------------------

/**
 * Module-level composing flag. Shared by auto-pair and Chinese-pair keymaps
 * so that pairing logic never fires on intermediate IME composition text.
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
  // at end of line so the user can keep typing the heading text.
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
    // Store heading level as a marker for Tab/Shift+Tab handling.
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
    const foldState = calloutFoldMatch[2]; // '-' = collapsed, '+' = expanded
    const from = line.from;
    const to = view.state.selection.main.head;
    // Replace with a collapsible callout block.
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

/**
 * WeakMap to track the heading level at each cursor position.
 * Used by Tab/Shift+Tab to promote/demote headings.
 */
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
 * Returns true if the heading was demoted.
 */
export function demoteHeading(view: EditorView): boolean {
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  const currentLevel = getHeadingLevel(view);

  if (currentLevel === undefined) return false;
  if (currentLevel >= 6) return false;

  const newLevel = currentLevel + 1;
  const newMarker = '#'.repeat(newLevel) + ' ';
  const from = line.from;
  const to = from + currentLevel + 1; // old marker length (# + space)

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
 * Returns true if the heading was promoted.
 */
export function promoteHeading(view: EditorView): boolean {
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  const currentLevel = getHeadingLevel(view);

  if (currentLevel === undefined) return false;
  if (currentLevel <= 1) return false;

  const newLevel = currentLevel - 1;
  const newMarker = '#'.repeat(newLevel) + ' ';
  const from = line.from;
  const to = from + currentLevel + 1; // old marker length (# + space)

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

  // Only handle at end of line or within the line content
  if (main.head !== line.to && cursorInLine < lineText.length) {
    return false;
  }

  // Check for list continuation
  const listMatch = lineText.match(/^(\s*)([-*+]|\d+\.)\s*(.*)/);
  if (listMatch) {
    const [, indent, marker, content] = listMatch;

    if (content.trim() === '') {
      // Empty list item — exit the list
      view.dispatch({
        changes: [
          { from: line.from, to: line.to, insert: '' },
        ],
        selection: { anchor: line.from + indent.length },
        scrollIntoView: true,
      });
      return true;
    }

    // Continue the list
    const newMarker = /^\d+\./.test(marker) ? `${parseInt(marker) + 1}. ` : `${marker} `;
    const insert = `\n${indent}${newMarker}`;
    view.dispatch({
      changes: { from: main.head, insert },
      selection: { anchor: main.head + insert.length },
      scrollIntoView: true,
    });
    return true;
  }

  // Check for blockquote continuation
  const quoteMatch = lineText.match(/^(\s*)(>+)\s?(.*)/);
  if (quoteMatch) {
    const [, indent, markers, content] = quoteMatch;

    if (content.trim() === '') {
      // Empty quote line — exit the quote
      view.dispatch({
        changes: [{ from: line.from, to: line.to, insert: '' }],
        selection: { anchor: line.from + indent.length },
        scrollIntoView: true,
      });
      return true;
    }

    // Continue the quote
    const insert = `\n${indent}${markers} `;
    view.dispatch({
      changes: { from: main.head, insert },
      selection: { anchor: main.head + insert.length },
      scrollIntoView: true,
    });
    return true;
  }

  // Check for code block indentation preservation
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

/**
 * Check if the given position is inside a fenced code block.
 */
function isInsideCodeBlock(state: EditorState, pos: number): boolean {
  const line = state.doc.lineAt(pos);
  const lineNum = line.number;

  // Count fence markers (```) above the current line
  let fenceCount = 0;
  for (let i = 1; i < lineNum; i++) {
    const prevLine = state.doc.line(i);
    if (prevLine.text.trim().startsWith('```')) {
      fenceCount++;
    }
  }

  // Odd number of fences above means we're inside a code block
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

  // Check for list marker removal
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

  // Check for blockquote marker removal
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

// --- Auto-pairing -----------------------------------------------------------

/**
 * Characters that trigger auto-pairing.
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
 * If text is selected, wraps the selection with the pair.
 * If no selection, inserts the pair and places cursor between.
 * Returns true if auto-pairing was applied.
 */
export function handleAutoPair(view: EditorView, char: string): boolean {
  const pair = PAIR_MAP[char];
  if (!pair) return false;

  const { selection } = view.state;
  const { main } = selection;

  if (!main.empty) {
    // Wrap selection
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

  // Insert pair and place cursor between
  const insert = char + pair;
  view.dispatch({
    changes: { from: main.head, insert },
    selection: { anchor: main.head + char.length },
    scrollIntoView: true,
  });
  return true;
}

// --- Chinese punctuation ----------------------------------------------------

/**
 * Chinese punctuation auto-pairing.
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
 * Returns true if a Chinese pair was applied.
 */
export function handleChinesePair(view: EditorView, char: string): boolean {
  const close = CHINESE_PAIRS[char];
  if (!close) return false;

  const { selection } = view.state;
  const { main } = selection;

  if (!main.empty) {
    // Wrap selection
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

  // Insert pair and place cursor between
  const insert = char + close;
  view.dispatch({
    changes: { from: main.head, insert },
    selection: { anchor: main.head + 1 },
    scrollIntoView: true,
  });
  return true;
}

// --- Keymap extensions ------------------------------------------------------

/**
 * Keymap for markdown shortcuts.
 * Triggers on space character after a markdown prefix.
 */
const markdownShortcutKeymap = keymap.of([
  {
    key: ' ',
    run: (view) => handleMarkdownShortcut(view),
  },
]);

/**
 * Keymap for smart Enter behavior.
 */
const smartEnterKeymap = keymap.of([
  {
    key: 'Enter',
    run: (view) => smartEnter(view),
  },
]);

/**
 * Keymap for smart Backspace behavior.
 */
const smartBackspaceKeymap = keymap.of([
  {
    key: 'Backspace',
    run: (view) => smartBackspace(view),
  },
]);

/**
 * Keymap for auto-pairing. Skips when IME is composing.
 */
const autoPairKeymap = keymap.of([
  { key: '**', run: (view) => (composing ? false : handleAutoPair(view, '**')) },
  { key: '`', run: (view) => (composing ? false : handleAutoPair(view, '`')) },
  { key: '$', run: (view) => (composing ? false : handleAutoPair(view, '$')) },
  { key: '[', run: (view) => (composing ? false : handleAutoPair(view, '[')) },
  { key: '!', run: (view) => (composing ? false : handleAutoPair(view, '![')) },
]);

/**
 * Keymap for Chinese punctuation auto-pairing. Skips when IME is composing.
 */
const chinesePairKeymap = keymap.of([
  { key: '「', run: (view) => (composing ? false : handleChinesePair(view, '「')) },
  { key: '『', run: (view) => (composing ? false : handleChinesePair(view, '『')) },
  { key: '（', run: (view) => (composing ? false : handleChinesePair(view, '（')) },
  { key: '【', run: (view) => (composing ? false : handleChinesePair(view, '【')) },
  { key: '《', run: (view) => (composing ? false : handleChinesePair(view, '《')) },
  { key: '〈', run: (view) => (composing ? false : handleChinesePair(view, '〈')) },
  { key: '"', run: (view) => (composing ? false : handleChinesePair(view, '"')) },
  { key: "'", run: (view) => (composing ? false : handleChinesePair(view, "'")) },
]);

/**
 * Keymap for heading promote/demote on Tab/Shift+Tab.
 */
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
 * Sets the module-level `composing` flag so auto-pair keymaps can skip
 * during active composition.
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
    autoPairKeymap,
    chinesePairKeymap,
    headingTabKeymap,
    compositionGuardPlugin,
  ];
}
