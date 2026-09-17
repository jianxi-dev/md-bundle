/**
 * Living-source decorations — combines the seven decoration modules
 * (heading, bold/italic, list, quote, inline code, image, callout) into a
 * single CM6 Extension via a StateField.
 *
 * Semantic editing mode: decorations have two visual states per block:
 * - Non-active block (cursor NOT in block): fully rendered, zero syntax
 *   markers visible. `## Heading` renders as a styled heading with `##`
 *   completely hidden.
 * - Active block (cursor IN block): semantic reveal. Structure markers
 *   shown at low opacity so the user sees the markdown source structure
 *   without full raw syntax. Inline markers (bold/italic) stay hidden.
 *
 * IME guard: a companion ViewPlugin listens for compositionstart/
 * compositionend DOM events and sets a module-level `composing` flag.
 * The StateField skips decoration recalculation while composing &&
 * docChanged. On compositionend the plugin dispatches a
 * `rebuildAfterComposition` StateEffect that forces the StateField
 * to catch up.
 *
 * Freeze mechanism: pointerdown freezes decoration updates for ~100ms to
 * prevent layout shift when clicking causes cursor move + decoration reveal.
 *
 * Multi-instance safety: the module-level `composing` and `frozen` flags
 * are safe because IME composition and pointer events are browser-singleton.
 */
import type { Extension, EditorState, Range } from '@codemirror/state';
import { StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, type DecorationSet } from '@codemirror/view';
import { createHeadingDecorations } from './heading';
import { createBoldItalicDecorations } from './boldItalic';
import { createListDecorations } from './list';
import { createQuoteDecorations } from './quote';
import { createCodeDecorations } from './code';
import { createImageDecorations } from './image';
import { createCalloutDecorations } from './callout';
import { editorDecorationsTheme } from './theme';
import { getBlocks, getBlockAt } from '../block-model';
import type { ImageResolver } from './image';

/**
 * Options for editorDecorations — all optional.
 * Image-related options allow injection of resolver and callbacks
 * without the editor package depending on app-level assets.
 */
export interface EditorDecorationsOptions {
  /** Resolver for image paths → URL/dataUrl. Default: always null (fallback text). */
  resolveImage?: ImageResolver;
  /** Callback when user clicks "replace" on an image widget. */
  onImageReplace?: (path: string) => void;
  /** Callback when user clicks "delete" on an image widget. */
  onImageDelete?: (path: string) => void;
  /** Callback when user clicks "locate" on an image widget. */
  onImageLocate?: (path: string) => void;
}

// --- IME composition guard ---------------------------------------------------

/**
 * Module-level composing flag. Set by the ViewPlugin's eventHandlers,
 * read by the StateField's update.
 *
 * Safe for multi-editor instances: IME composition is browser-singleton.
 */
let composing = false;

/**
 * StateEffect dispatched on compositionend to force the StateField to
 * rebuild decorations (catch up to the final composed text).
 */
const rebuildAfterComposition = StateEffect.define<void>();

// --- Freeze mechanism ---------------------------------------------------------

/**
 * Module-level freeze flag. Set on pointerdown, cleared after a short
 * timeout. Prevents layout shift when clicking causes cursor move +
 * decoration reveal.
 */
let frozen = false;

/**
 * StateEffect dispatched when freeze lifts to force a rebuild.
 */
const unfreezeRebuild = StateEffect.define<void>();

// --- Decoration helpers ------------------------------------------------------

/**
 * Build a DecorationSet from the current editor state.
 *
 * The block model (getBlocks/getBlockAt) determines which block the cursor
 * is in. Decorations in the active block get the `active` flag (semantic
 * reveal); decorations in non-active blocks get `inactive` (fully rendered).
 */
function buildDecorationSet(
  state: EditorState,
  options?: EditorDecorationsOptions,
): DecorationSet {
  const docText = state.doc.toString();
  const cursorPos = state.selection.main.head;

  // Determine which block is active (contains the cursor).
  const blocks = getBlocks(state);
  const activeBlock = getBlockAt(cursorPos, blocks);
  const activeFrom = activeBlock?.from ?? -1;
  const activeTo = activeBlock?.to ?? -1;

  const all: Range<Decoration>[] = [
    ...createHeadingDecorations(docText, activeFrom, activeTo),
    ...createBoldItalicDecorations(docText, activeFrom, activeTo),
    ...createListDecorations(docText, activeFrom, activeTo),
    ...createQuoteDecorations(docText, activeFrom, activeTo),
    ...createCodeDecorations(docText, activeFrom, activeTo),
    ...createImageDecorations(
      docText,
      options?.resolveImage,
      {
        onImageReplace: options?.onImageReplace,
        onImageDelete: options?.onImageDelete,
        onImageLocate: options?.onImageLocate,
      },
    ),
    ...createCalloutDecorations(docText),
  ];

  // Sort by from-position (required by CM6)
  all.sort((a, b) => a.from - b.from || a.value.startSide - b.value.startSide);

  return Decoration.set(all, true);
}

// --- StateField --------------------------------------------------------------

/**
 * Factory that creates a StateField with the given options.
 * Each editorDecorations() call gets its own StateField instance
 * so different editors can have different image resolvers.
 */
function createDecorationField(options?: EditorDecorationsOptions) {
  return StateField.define<DecorationSet>({
    create(state) {
      return buildDecorationSet(state, options);
    },
    update(decos, tr) {
      // Skip recalculation during active IME composition when the document
      // changes — intermediate composition text would cause decorations to
      // flicker as they are rapidly added and removed.
      if (composing && tr.docChanged) return decos;

      // Skip recalculation while frozen (pointerdown freeze mechanism).
      if (frozen && (tr.docChanged || tr.selection)) return decos;

      // Rebuild on doc/selection changes, or when composition ends
      // (the rebuildAfterComposition effect catches up decorations to
      // the final composed text), or when freeze lifts.
      if (tr.docChanged || tr.selection
        || tr.effects.some((e) => e.is(rebuildAfterComposition))
        || tr.effects.some((e) => e.is(unfreezeRebuild))) {
        return buildDecorationSet(tr.state, options);
      }
      return decos;
    },
    provide: (f) => EditorView.decorations.from(f),
  });
}

// --- ViewPlugin (companion for IME guard + freeze) ---------------------------

/**
 * ViewPlugin that tracks IME composition state and freeze state via DOM
 * events.
 *
 * StateField.update(value, tr) has no access to EditorView.composing
 * (Transaction has no view property), so this companion plugin bridges
 * the gap by setting the module-level `composing` flag and dispatching
 * a rebuildAfterComposition effect on compositionend.
 *
 * Freeze: on pointerdown, sets `frozen = true` and schedules a timeout
 * to clear it after 100ms. This prevents layout shift when clicking
 * causes cursor move + decoration reveal.
 */
const compositionGuard = ViewPlugin.define(() => ({}), {
  eventHandlers: {
    compositionstart() {
      composing = true;
    },
    compositionend(_e, view) {
      composing = false;
      view.dispatch({ effects: rebuildAfterComposition.of(undefined) });
    },
    pointerdown(_e, view) {
      if (frozen) return;
      frozen = true;
      // After 100ms, unfreeze and dispatch rebuild effect.
      // The StateField's update will then rebuild decorations.
      setTimeout(() => {
        frozen = false;
        view.dispatch({ effects: unfreezeRebuild.of(undefined) });
      }, 100);
    },
  },
});

/**
 * The living-source decorations extension.
 * Pass as an optional extension to `createMarkdownEditor`.
 *
 * ```ts
 * createMarkdownEditor(parent, {
 *   extensions: [editorDecorations()],
 * });
 * ```
 *
 * For image support, provide a resolver and optional callbacks:
 *
 * ```ts
 * editorDecorations({
 *   resolveImage: (path) => resolveImagePath(path),
 *   onImageReplace: (path) => handleReplace(path),
 *   onImageDelete: (path) => handleDelete(path),
 *   onImageLocate: (path) => handleLocate(path),
 * });
 * ```
 */
export function editorDecorations(options?: EditorDecorationsOptions): Extension {
  return [createDecorationField(options), compositionGuard.extension, editorDecorationsTheme];
}
