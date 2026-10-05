/**
 * Callout header emoji picker (#361, change editor-fidelity-2 task 2.6).
 *
 * Owns the editor-side emoji override store and the lightweight picker DOM
 * (search + curated grid + 恢复默认). Split out of `callout.ts` so the card
 * decoration file stays focused on parsing and inline editing.
 *
 * Persistence: markdown has no attribute slot for a callout emoji, and rewriting
 * the source title would corrupt user content, so the override lives for the
 * session only. `CalloutWidget.toDOM` re-applies it after a widget rebuild,
 * which keeps the header stable across document edits; a reload starts from the
 * type's default emoji (documented limitation, #361).
 */
import type { EditorView } from '@codemirror/view';
import { CALLOUT_EMOJI_CHOICES } from '../callout-types';

/** Header emoji overrides, keyed by view then callout ordinal. */
const calloutEmojiOverrides = new WeakMap<EditorView, Map<number, string>>();

/** Document-level outside-press dismissers, so a removed picker never leaks one. */
const pickerDismissers = new WeakMap<HTMLElement, (event: MouseEvent) => void>();

/** Display override for a callout, or undefined to fall back to the type default. */
export function getCalloutEmojiOverride(view: EditorView, index: number): string | undefined {
  return calloutEmojiOverrides.get(view)?.get(index);
}

/** Resolve the live card for a callout ordinal (a widget rebuild detaches the old one). */
function liveCard(view: EditorView, index: number): HTMLElement | null {
  const card = view.dom.querySelectorAll('.cm-callout')[index];
  return card instanceof HTMLElement ? card : null;
}

function closeEmojiPicker(picker: HTMLElement): void {
  const onDocDown = pickerDismissers.get(picker);
  if (onDocDown) {
    document.removeEventListener('mousedown', onDocDown, true);
    pickerDismissers.delete(picker);
  }
  picker.remove();
}

/**
 * Store an emoji choice (or clear it with `null`) and paint the live card.
 * Re-resolves the card so a widget rebuilt between click and apply is not left
 * with a stale header.
 */
function applyEmoji(view: EditorView, index: number, emoji: string | null, defaultEmoji: string): void {
  let overrides = calloutEmojiOverrides.get(view);
  if (emoji === null) {
    overrides?.delete(index);
  } else {
    if (!overrides) {
      overrides = new Map();
      calloutEmojiOverrides.set(view, overrides);
    }
    overrides.set(index, emoji);
  }
  const next = emoji ?? defaultEmoji;
  const card = liveCard(view, index);
  if (!card) return;
  card.setAttribute('data-callout-emoji', next);
  const iconEl = card.querySelector<HTMLElement>('.cm-callout-icon');
  if (iconEl) {
    iconEl.textContent = next;
    iconEl.setAttribute('data-callout-emoji', next);
  }
}

function buildEmojiPicker(view: EditorView, index: number, defaultEmoji: string): HTMLElement {
  const picker = document.createElement('div');
  picker.className = 'cm-callout-emoji-picker';
  picker.setAttribute('data-testid', 'cm-callout-emoji-picker');
  // The card opens its inline editor on mousedown; the picker owns its presses.
  picker.addEventListener('mousedown', (event) => event.stopPropagation());

  const search = document.createElement('input');
  search.type = 'text';
  search.className = 'cm-callout-emoji-search';
  search.setAttribute('data-testid', 'cm-callout-emoji-search');
  search.placeholder = '搜索 emoji';
  search.setAttribute('aria-label', '搜索 emoji');
  picker.appendChild(search);

  const grid = document.createElement('div');
  grid.className = 'cm-callout-emoji-grid';
  const options: HTMLButtonElement[] = [];
  for (const choice of CALLOUT_EMOJI_CHOICES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cm-callout-emoji-option';
    btn.setAttribute('data-testid', 'cm-callout-emoji-option');
    btn.setAttribute('data-emoji', choice.emoji);
    btn.setAttribute('data-name', choice.name);
    btn.title = choice.name;
    btn.textContent = choice.emoji;
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      applyEmoji(view, index, choice.emoji, defaultEmoji);
      closeEmojiPicker(picker);
    });
    options.push(btn);
    grid.appendChild(btn);
  }
  picker.appendChild(grid);

  search.addEventListener('input', () => {
    const query = search.value.trim().toLowerCase();
    for (const btn of options) {
      const name = (btn.getAttribute('data-name') ?? '').toLowerCase();
      btn.style.display = query === '' || name.includes(query) ? '' : 'none';
    }
  });

  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'cm-callout-emoji-reset';
  reset.setAttribute('data-testid', 'cm-callout-emoji-reset');
  reset.textContent = '恢复默认';
  reset.addEventListener('click', (event) => {
    event.stopPropagation();
    applyEmoji(view, index, null, defaultEmoji);
    closeEmojiPicker(picker);
  });
  picker.appendChild(reset);

  return picker;
}

/** Toggle the emoji picker on the callout card at `index`. */
export function openCalloutEmojiPicker(view: EditorView, index: number, defaultEmoji: string): void {
  const card = liveCard(view, index);
  if (!card) return;
  const existing = card.querySelector<HTMLElement>('.cm-callout-emoji-picker');
  if (existing) {
    closeEmojiPicker(existing);
    return;
  }
  const picker = buildEmojiPicker(view, index, defaultEmoji);
  const onDocDown = (event: MouseEvent): void => {
    const target = event.target;
    const onIcon = target instanceof Element && target.closest('.cm-callout-icon') !== null;
    if (target instanceof Node && (picker.contains(target) || onIcon)) return;
    closeEmojiPicker(picker);
  };
  pickerDismissers.set(picker, onDocDown);
  document.addEventListener('mousedown', onDocDown, true);
  card.appendChild(picker);
}
