/**
 * Callout card decorations.
 *
 * Parses markdown blockquote callout syntax (> [!TYPE][+-] title + subsequent
 * > lines) and renders them as styled callout cards. Colors/labels come from
 * `resolveCalloutType` (the deduped editor set, falling back to the renderer's
 * calloutTypeMap so parse aliases still render). Invalid types ([!FOO]) fall
 * back to regular blockquote display.
 *
 * How editing works (D5/D7: a callout must never collapse to `> [!TYPE]` source)
 * ------------------------------------------------------------------------------
 * The card stays rendered even while its block is active. A click opens a real
 * `<textarea>` inside the card (a form control is never part of CM6's editable
 * content, emits no DOM mutations its observer could act on, and has native
 * focus, caret, IME and undo). CM6 rebuilds the widget DOM during the mousedown
 * capture phase, so the editor is opened on the next frame against the live card.
 *
 * Typed text is staged in a per-view map (survives a widget rebuild) and written
 * back with ONE transaction when the edit settles. The flush never dispatches
 * inside a CM6 update — it defers to the next tick when it would.
 */
import { Decoration, WidgetType, type EditorView } from '@codemirror/view';
import type { Range } from '@codemirror/state';
import { resolveCalloutType } from '../callout-types';
import { getCalloutEmojiOverride, openCalloutEmojiPicker } from './callout-emoji';

// --- Staging + flush --------------------------------------------------------

/** Staged callout content, keyed by view then callout ordinal. */
const dirtyCallouts = new WeakMap<EditorView, Map<number, string>>();

const flushScheduled = new WeakSet<EditorView>();
const flushingViews = new WeakSet<EditorView>();
const externalFlushWired = new WeakSet<EditorView>();

/**
 * Queue a flush for the next macrotask.
 *
 * Dispatching is illegal while CM6 is mid-update — and widget/plugin teardown
 * runs exactly there — so a deferred flush is the only way to persist staged text
 * from those paths instead of losing it to a swallowed error.
 */
export function scheduleCalloutFlush(view: EditorView): void {
  if (flushScheduled.has(view)) return;
  flushScheduled.add(view);
  setTimeout(() => {
    flushScheduled.delete(view);
    flushCalloutEdits(view);
  }, 0);
}

function markCalloutDirty(view: EditorView, index: number, content: string): void {
  let pending = dirtyCallouts.get(view);
  if (!pending) {
    pending = new Map<number, string>();
    dirtyCallouts.set(view, pending);
  }
  pending.set(index, content);
}

function clearCalloutDirty(view: EditorView, index: number): void {
  dirtyCallouts.get(view)?.delete(index);
}

/** Rebuild a callout block's markdown from its source block plus edited content. */
function buildCalloutMarkdown(block: CalloutBlock, content: string): string {
  const head = `> [!${block.type.toUpperCase()}]${block.fold}${block.title ? ` ${block.title}` : ''}`;
  const lines = content === '' ? [] : content.split('\n').map((line) => (line ? `> ${line}` : '>'));
  return [head, ...lines].join('\n');
}

/** Write every staged callout back to the document in a single transaction. */
export function flushCalloutEdits(view: EditorView): boolean {
  const pending = dirtyCallouts.get(view);
  if (!pending || pending.size === 0 || flushingViews.has(view)) return false;

  const docText = view.state.doc.toString();
  const blocks = findCalloutBlocks(docText);
  const changes: { from: number; to: number; insert: string }[] = [];
  for (const [index, content] of pending) {
    const block = blocks[index];
    if (!block) continue;
    const insert = buildCalloutMarkdown(block, content);
    if (insert === docText.slice(block.from, block.to)) continue;
    changes.push({ from: block.from, to: block.to, insert });
  }

  if (changes.length === 0) {
    pending.clear();
    return false;
  }

  changes.sort((a, b) => a.from - b.from);
  flushingViews.add(view);
  try {
    view.dispatch({ changes });
  } catch {
    // Only reachable from inside an update cycle: keep the staged text and retry.
    scheduleCalloutFlush(view);
    return false;
  } finally {
    flushingViews.delete(view);
  }
  pending.clear();
  return true;
}

/**
 * Open the inline content editor for a callout card. Resolved through the live
 * DOM by ordinal because CM6 may have rebuilt the widget since the click.
 */
function openCalloutEditor(view: EditorView, index: number): void {
  // Commit any open callout first, and do it BEFORE resolving the DOM: a flush
  // dispatch can rebuild this widget, which would detach a card resolved earlier.
  flushCalloutEdits(view);

  const card = view.dom.querySelectorAll('.cm-callout')[index];
  if (!(card instanceof HTMLElement)) return;
  const existing = card.querySelector('.cm-callout-editor') as HTMLTextAreaElement | null;
  if (existing) {
    existing.focus();
    return;
  }

  const block = findCalloutBlocks(view.state.doc.toString())[index];
  if (!block) return;

  const contentEl = card.querySelector<HTMLElement>('.cm-callout-content');
  const editor = document.createElement('textarea');
  editor.className = 'cm-callout-editor';
  editor.setAttribute('data-testid', 'cm-callout-editor');
  editor.rows = 1;
  editor.value = block.content;
  contentEl?.setAttribute('hidden', '');
  card.appendChild(editor);
  autoGrow(editor);
  editor.focus();
  editor.setSelectionRange(editor.value.length, editor.value.length);

  let composing = false;
  const teardown = (): void => {
    editor.remove();
    contentEl?.removeAttribute('hidden');
  };
  const commit = (): void => {
    if (!editor.isConnected) return;
    markCalloutDirty(view, index, editor.value);
    flushCalloutEdits(view);
    teardown();
  };

  editor.addEventListener('input', () => {
    autoGrow(editor);
    markCalloutDirty(view, index, editor.value);
  });
  editor.addEventListener('compositionstart', () => {
    composing = true;
  });
  editor.addEventListener('compositionend', () => {
    composing = false;
    markCalloutDirty(view, index, editor.value);
  });
  editor.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      clearCalloutDirty(view, index);
      teardown();
    }
  });
  editor.addEventListener('blur', () => {
    if (!composing) commit();
  });
  editor.addEventListener('mousedown', (event) => event.stopPropagation());
}

/** Size the textarea to its content so the card grows instead of scrolling. */
function autoGrow(editor: HTMLTextAreaElement): void {
  editor.style.height = 'auto';
  editor.style.height = `${editor.scrollHeight}px`;
}

/**
 * Settle staged callouts when a pointer press lands outside every card.
 * Capture phase so it still fires when a card's listener stops propagation.
 */
function wireExternalFlush(view: EditorView): void {
  if (externalFlushWired.has(view)) return;
  externalFlushWired.add(view);
  view.dom.addEventListener(
    'mousedown',
    (event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest?.('.cm-callout')) return;
      flushCalloutEdits(view);
    },
    true,
  );
}

// --- Callout widget --------------------------------------------------------

class CalloutWidget extends WidgetType {
  constructor(
    readonly index: number,
    readonly type: string,
    readonly label: string,
    readonly tone: string,
    readonly icon: string,
    readonly title: string,
    readonly content: string,
    readonly fold: '+' | '-' | '',
  ) {
    super();
  }

  toDOM(view?: EditorView): HTMLElement {
    const container = document.createElement('div');
    container.className = `cm-callout cm-callout-tone-${this.tone}`;
    if (this.fold) container.setAttribute('data-fold', this.fold);
    const emoji = (view ? getCalloutEmojiOverride(view, this.index) : undefined) ?? this.icon;
    container.setAttribute('data-callout-emoji', emoji);

    if (view) {
      wireExternalFlush(view);
      const index = this.index;
      const defaultEmoji = this.icon;
      // The card replaces the whole block, so it owns pointer events. Open the
      // inline editor on the next frame: CM6 rebuilds this widget during the
      // mousedown capture phase, detaching the event's target. A press on the
      // header emoji opens the picker instead of the text editor.
      container.addEventListener('mousedown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const onEmoji = event.target instanceof Element && event.target.closest('.cm-callout-icon') !== null;
        const open = (): void => {
          if (onEmoji) {
            flushCalloutEdits(view);
            openCalloutEmojiPicker(view, index, defaultEmoji);
          } else {
            openCalloutEditor(view, index);
          }
        };
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(open);
        } else {
          open();
        }
      });
    }

    const header = document.createElement('div');
    header.className = 'cm-callout-header';

    const iconEl = document.createElement('span');
    iconEl.className = 'cm-callout-icon';
    iconEl.setAttribute('data-testid', 'cm-callout-emoji-btn');
    iconEl.setAttribute('data-callout-emoji', emoji);
    iconEl.setAttribute('role', 'button');
    iconEl.setAttribute('tabindex', '0');
    iconEl.setAttribute('aria-label', '更改 emoji');
    iconEl.title = '更改 emoji';
    iconEl.textContent = emoji;
    if (view) {
      const index = this.index;
      const defaultEmoji = this.icon;
      // Keyboard parity with the mouse path; focus stays on the (rebuilt) card.
      iconEl.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
        flushCalloutEdits(view);
        openCalloutEmojiPicker(view, index, defaultEmoji);
      });
    }
    header.appendChild(iconEl);

    const badge = document.createElement('span');
    badge.className = 'cm-callout-badge';
    badge.textContent = this.label;
    header.appendChild(badge);

    // Title only when the source declares one — otherwise the badge is the whole
    // header (D2: an untitled callout must not read "注释 注释").
    if (this.title) {
      const titleEl = document.createElement('span');
      titleEl.className = 'cm-callout-title';
      titleEl.textContent = this.title;
      header.appendChild(titleEl);
    }

    container.appendChild(header);

    if (this.content) {
      const contentEl = document.createElement('div');
      contentEl.className = 'cm-callout-content';
      contentEl.textContent = this.content;
      container.appendChild(contentEl);
    }

    return container;
  }

  eq(other: CalloutWidget): boolean {
    return (
      this.index === other.index &&
      this.type === other.type &&
      this.label === other.label &&
      this.tone === other.tone &&
      this.icon === other.icon &&
      this.title === other.title &&
      this.content === other.content &&
      this.fold === other.fold
    );
  }

  get estimatedHeight(): number {
    return 60;
  }
}

// --- Callout parsing -------------------------------------------------------

/**
 * Regex to match callout opening line: > [!TYPE][+-] optional title
 * Captures: (1) type (case-insensitive), (2) fold indicator (+/-/empty), (3) optional title
 */
const CALLOUT_OPEN_RE = /^>\s*\[!([A-Za-z]+)\]([+-]?)\s*(.*)$/;

/** Regex to match continuation line: > optional content. */
const CALLOUT_LINE_RE = /^>\s?(.*)$/;

interface CalloutBlock {
  from: number;
  to: number;
  type: string;
  title: string;
  content: string;
  fold: '+' | '-' | '';
}

function findCalloutBlocks(docText: string): CalloutBlock[] {
  const blocks: CalloutBlock[] = [];
  const lines = docText.split('\n');

  let i = 0;
  while (i < lines.length) {
    const openMatch = CALLOUT_OPEN_RE.exec(lines[i]);
    if (openMatch) {
      const type = openMatch[1].toLowerCase();
      const fold = (openMatch[2] as '+' | '-' | '') || '';
      const title = openMatch[3].trim();

      const typeInfo = resolveCalloutType(type);
      if (!typeInfo) {
        i++;
        continue;
      }

      let from = 0;
      for (let j = 0; j < i; j++) {
        from += lines[j].length + 1;
      }

      const contentLines: string[] = [];
      let j = i + 1;
      while (j < lines.length) {
        const lineMatch = CALLOUT_LINE_RE.exec(lines[j]);
        if (lineMatch) {
          if (lines[j].startsWith('>')) {
            contentLines.push(lineMatch[1]);
            j++;
          } else {
            break;
          }
        } else {
          break;
        }
      }

      let to = from;
      for (let k = i; k < j; k++) {
        to += lines[k].length;
        if (k < j - 1) to += 1;
      }

      blocks.push({ from, to, type, title, content: contentLines.join('\n'), fold });

      i = j;
    } else {
      i++;
    }
  }

  return blocks;
}

// --- Public API ------------------------------------------------------------

/**
 * Create callout decorations for the given document text. The card is rendered
 * even for the active block — a callout never collapses to `> [!TYPE]` source
 * (D5/D7); editing happens inline in the card.
 */
export function createCalloutDecorations(
  docText: string,
  _activeFrom: number = -1,
  _activeTo: number = -1,
): Range<Decoration>[] {
  const decorations: Range<Decoration>[] = [];

  findCalloutBlocks(docText).forEach((block, index) => {
    const typeInfo = resolveCalloutType(block.type);
    if (!typeInfo) return;

    decorations.push(
      Decoration.replace({
        widget: new CalloutWidget(
          index,
          block.type,
          typeInfo.label,
          typeInfo.tone,
          typeInfo.icon,
          block.title,
          block.content,
          block.fold,
        ),
        inclusive: true,
      }).range(block.from, block.to),
    );
  });

  return decorations;
}
