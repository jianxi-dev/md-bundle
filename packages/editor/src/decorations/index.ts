/**
 * Living-source decorations — combines the five decoration modules
 * (heading, bold/italic, list, quote, inline code) into a single
 * CM6 Extension via a StateField.
 *
 * IME guard: a companion ViewPlugin listens for compositionstart/
 * compositionend DOM events and sets a module-level `composing` flag.
 * The StateField skips decoration recalculation while composing &&
 * docChanged. On compositionend the plugin dispatches a
 * `rebuildAfterComposition` StateEffect that forces the StateField
 * to catch up.
 *
 * Multi-instance safety: the module-level `composing` flag is safe
 * because IME composition is browser-singleton — only one editor
 * can be actively composing at any time.
 *
 * Selection reveal: decorations are suppressed when the cursor
 * overlaps them, so raw markdown markers reappear during editing.
 */
import type { Extension, Range } from '@codemirror/state';
import { StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, type DecorationSet } from '@codemirror/view';
import { createHeadingDecorations } from './heading';
import { createBoldItalicDecorations } from './boldItalic';
import { createListDecorations } from './list';
import { createQuoteDecorations } from './quote';
import { createCodeDecorations } from './code';
import { createImageDecorations } from './image';
import { createCalloutDecorations } from './callout';
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
 * Safe for multi-editor instances: IME composition is browser-singleton,
 * so only one editor can be actively composing at any time.
 */
let composing = false;

/**
 * StateEffect dispatched on compositionend to force the StateField to
 * rebuild decorations (catch up to the final composed text).
 */
const rebuildAfterComposition = StateEffect.define<void>();

// --- Decoration helpers ------------------------------------------------------

/**
 * Build a DecorationSet from the current doc text, filtering out
 * decorations whose range overlaps the cursor position.
 */
function buildDecorationSet(
  docText: string,
  cursorPos: number,
  options?: EditorDecorationsOptions,
): DecorationSet {
  const all: Range<Decoration>[] = [
    ...createHeadingDecorations(docText),
    ...createBoldItalicDecorations(docText),
    ...createListDecorations(docText),
    ...createQuoteDecorations(docText),
    ...createCodeDecorations(docText),
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

  // Filter: remove decorations whose range contains the cursor.
  // This makes the raw markdown visible when editing inside a decorated region.
  const filtered = all.filter((deco) => {
    const { from, to } = deco;
    // Line decorations (Decoration.line) don't have a span range;
    // only filter inline replace/mark decorations.
    if (from === to) return true;
    // Suppressed when cursor is anywhere inside this decoration span
    return cursorPos < from || cursorPos >= to;
  });

  // Sort by from-position (required by CM6)
  filtered.sort((a, b) => a.from - b.from || a.value.startSide - b.value.startSide);

  return Decoration.set(filtered, true);
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
      return buildDecorationSet(
        state.doc.toString(),
        state.selection.main.head,
        options,
      );
    },
    update(decos, tr) {
      // Skip recalculation during active IME composition when the document
      // changes — intermediate composition text would cause decorations to
      // flicker as they are rapidly added and removed.
      if (composing && tr.docChanged) return decos;

      // Rebuild on doc/selection changes, or when composition ends
      // (the rebuildAfterComposition effect catches up decorations to
      // the final composed text).
      if (tr.docChanged || tr.selection || tr.effects.some(e => e.is(rebuildAfterComposition))) {
        return buildDecorationSet(
          tr.state.doc.toString(),
          tr.state.selection.main.head,
          options,
        );
      }
      return decos;
    },
    provide: (f) => EditorView.decorations.from(f),
  });
}

// --- ViewPlugin (companion for IME guard) ------------------------------------

/**
 * ViewPlugin that tracks IME composition state via DOM events.
 *
 * StateField.update(value, tr) has no access to EditorView.composing
 * (Transaction has no view property), so this companion plugin bridges
 * the gap by setting the module-level `composing` flag and dispatching
 * a rebuildAfterComposition effect on compositionend.
 */
const compositionGuard = ViewPlugin.define(() => ({}), {
  eventHandlers: {
    compositionstart() {
      composing = true;
    },
    compositionend(_e, view) {
      composing = false;
      // Trigger StateField rebuild to catch up decorations to the
      // final composed text.
      view.dispatch({ effects: rebuildAfterComposition.of(undefined) });
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
  return [createDecorationField(options), compositionGuard.extension];
}
