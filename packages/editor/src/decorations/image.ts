/**
 * Inline image decoration — Task 3.2.
 *
 * Renders markdown image references `![alt](path)` as real `<img>` widgets
 * in the editor. Supports a resolver injection seam for converting image
 * paths to data URLs/real URLs, with fallback text for unresolved images.
 *
 * Hover operations (replace/delete/locate) are provided via callback
 * injection seams — the editor package never depends on app-level assets.
 */
import type { Range } from '@codemirror/state';
import { Decoration, WidgetType, EditorView } from '@codemirror/view';

// --- Types -------------------------------------------------------------------

/**
 * Resolver function that converts an image path to a URL/dataUrl string.
 * Returns null if the image cannot be resolved (triggers fallback text).
 */
export type ImageResolver = (path: string) => string | null;

/**
 * Callbacks for hover operations on image widgets.
 * All optional — editor never throws when callbacks are missing.
 */
export interface ImageCallbacks {
  onImageReplace?: (path: string) => void;
  /** Persist a dragged width for the image whose markdown starts at `from`. */
  onImageResize?: (from: number, width: number) => void;
  onImageDelete?: (path: string) => void;
  onImageLocate?: (path: string) => void;
}

// --- Media classification ----------------------------------------------------

/**
 * The three renderings a `![alt](path)` reference can take. Mirrors the
 * shared renderer's `image()` rules (packages/renderer/src/markdown.ts) so
 * edit and preview agree on which extension is a video, an image, or a file.
 */
export type MediaKind = 'image' | 'video' | 'file';

const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'ogv', 'mov', 'm4v']);
const IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'bmp', 'ico',
]);

/** Lowercased extension without query/hash, or '' when the path has none. */
function extensionOf(path: string): string {
  const clean = path.split(/[?#]/)[0];
  const dot = clean.lastIndexOf('.');
  return dot >= 0 ? clean.slice(dot + 1).toLowerCase() : '';
}

/**
 * Classify a media path by extension. No extension (or an image extension)
 * is an image; a known video extension is a video; anything else is a file.
 */
export function classifyMedia(path: string): MediaKind {
  const ext = extensionOf(path);
  if (ext !== '' && VIDEO_EXTENSIONS.has(ext)) return 'video';
  if (ext !== '' && !IMAGE_EXTENSIONS.has(ext)) return 'file';
  return 'image';
}

// --- Image widget ------------------------------------------------------------

/**
 * Widget that renders a markdown image reference as either:
 * - An `<img>` element (when resolver returns a URL/dataUrl)
 * - Fallback text `[图片: path]` (when resolver returns null)
 *
 * Hover overlay with replace/delete/locate buttons appears on mouseenter.
 */
class ImageWidget extends WidgetType {
  private readonly _alt: string;
  private readonly _path: string;
  private readonly _src: string | null;
  private readonly _callbacks: ImageCallbacks;
  private readonly _width: number | null;
  /** Document offset of the `!` — where a resize writes the comment. */
  private readonly _from: number;

  constructor(
    alt: string,
    path: string,
    src: string | null,
    callbacks: ImageCallbacks,
    width: number | null = null,
    from = 0,
  ) {
    super();
    this._alt = alt;
    this._path = path;
    this._src = src;
    this._callbacks = callbacks;
    this._width = width;
    this._from = from;
  }

  eq(other: ImageWidget): boolean {
    return (
      other._alt === this._alt &&
      other._path === this._path &&
      other._src === this._src &&
      other._width === this._width &&
      other._from === this._from
    );
  }

  toDOM(): HTMLElement {
    const container = document.createElement('span');
    container.className = 'cm-image-widget';
    container.style.display = 'inline-block';
    container.style.position = 'relative';
    container.style.maxWidth = '100%';
    container.style.verticalAlign = 'middle';
    // The <img> carries the rounded clip via clip-path (below), so this
    // container is NOT rounded. An overflow:hidden + border-radius container
    // anti-aliases its clipped child against the near-black editor canvas —
    // the dark corner halo reported as "black edges". Clipping the image's own
    // pixels rounds them with no overflowing child to halo against.
    // A theme-aware surface background still sits on the container so pixels
    // revealed through the rounded corners (transparent PNG corners, or the
    // notches left by opaque images) composite over the surface, never the canvas.
    container.style.backgroundColor = 'var(--mdb-surface)';

    if (this._src) {
      // Render actual image at natural size (capped to container width by
      // the .cm-image-widget maxWidth). No max-height constraint — otherwise
      // pasted/dropped images render tiny.
      const img = document.createElement('img');
      img.src = this._src;
      img.alt = this._alt;
      img.style.maxWidth = '100%';
      img.style.display = 'block';
      if (this._width !== null) {
        img.style.width = `${this._width}px`;
        img.setAttribute('data-width', String(this._width));
      }
      // Round the image's own pixels here — a clip-path on the element (not a
      // rounded container clipping an overflowing child) leaves no dark halo
      // and no dependence on fragile canvas corner sampling.
      img.style.clipPath = 'inset(0 round 4px)';
      container.appendChild(img);
    } else {
      // Fallback text for unresolved images
      const fallback = document.createElement('span');
      fallback.className = 'cm-image-fallback';
      fallback.textContent = `[图片: ${this._path}]`;
      fallback.style.color = '#999';
      fallback.style.fontStyle = 'italic';
      container.appendChild(fallback);
    }

    // Hover toolbar — overlays the top of the image (inside the container
    // bounds) so moving the mouse from the image onto the toolbar does not
    // leave the container and hide it.
    const toolbar = document.createElement('span');
    toolbar.className = 'cm-image-toolbar';
    toolbar.style.display = 'none';
    toolbar.style.position = 'absolute';
    toolbar.style.top = '4px';
    toolbar.style.left = '4px';
    toolbar.style.borderRadius = '4px';
    toolbar.style.padding = '2px 4px';
    toolbar.style.fontSize = '12px';
    toolbar.style.whiteSpace = 'nowrap';
    toolbar.style.zIndex = '10';
    toolbar.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';

    const replaceBtn = document.createElement('button');
    replaceBtn.dataset.testid = 'img-hover-replace';
    replaceBtn.textContent = '替换';
    replaceBtn.style.marginRight = '4px';
    replaceBtn.style.cursor = 'pointer';
    replaceBtn.style.color = 'inherit';
    replaceBtn.style.background = 'transparent';
    replaceBtn.style.border = 'none';
    replaceBtn.style.padding = '0';
    replaceBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._callbacks.onImageReplace?.(this._path);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.dataset.testid = 'img-hover-delete';
    deleteBtn.textContent = '删除';
    deleteBtn.style.marginRight = '4px';
    deleteBtn.style.cursor = 'pointer';
    deleteBtn.style.color = 'inherit';
    deleteBtn.style.background = 'transparent';
    deleteBtn.style.border = 'none';
    deleteBtn.style.padding = '0';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._callbacks.onImageDelete?.(this._path);
    });

    const locateBtn = document.createElement('button');
    locateBtn.dataset.testid = 'img-hover-locate';
    locateBtn.textContent = '定位';
    locateBtn.style.cursor = 'pointer';
    locateBtn.style.color = 'inherit';
    locateBtn.style.background = 'transparent';
    locateBtn.style.border = 'none';
    locateBtn.style.padding = '0';
    locateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._callbacks.onImageLocate?.(this._path);
    });

    // Resize handle: drag to set the width, released value is persisted as a
    // trailing `<!--w=N-->` comment (#498).
    if (this._src) {
      const handle = document.createElement('span');
      handle.className = 'cm-image-resize';
      handle.setAttribute('data-testid', 'cm-image-resize');
      handle.setAttribute('role', 'slider');
      handle.setAttribute('aria-label', '调整图片宽度');
      handle.title = '拖动调整宽度';
      container.appendChild(handle);

      handle.addEventListener('mousedown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const img = container.querySelector('img');
        if (!img) return;
        const startX = event.clientX;
        const startWidth = img.getBoundingClientRect().width;
        const maxAllowed = container.getBoundingClientRect().width;
        const onMove = (move: MouseEvent): void => {
          const next = Math.max(
            MIN_IMAGE_WIDTH,
            Math.min(startWidth + (move.clientX - startX), maxAllowed),
          );
          img.style.width = `${Math.round(next)}px`;
        };
        const onUp = (up: MouseEvent): void => {
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
          const raw = Math.round(startWidth + (up.clientX - startX));
          const clamped = Math.max(MIN_IMAGE_WIDTH, Math.min(raw, MAX_IMAGE_WIDTH));
          if (this._callbacks.onImageResize) {
            this._callbacks.onImageResize(this._from, clamped);
            return;
          }
          // No host callback: write into the document; the view is recovered
          // from the widget's own DOM so decorations need no view reference.
          const view = EditorView.findFromDOM(container);
          if (view) applyImageWidth(view, this._from, clamped);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
      });
    }

    toolbar.appendChild(replaceBtn);
    toolbar.appendChild(deleteBtn);
    toolbar.appendChild(locateBtn);
    container.appendChild(toolbar);

    // Show/hide toolbar on hover. mouseleave checks relatedTarget so moving
    // onto the toolbar (or any descendant) does not hide it prematurely.
    container.addEventListener('mouseenter', () => {
      toolbar.style.display = 'block';
    });
    container.addEventListener('mouseleave', (e) => {
      const related = e.relatedTarget as Node | null;
      if (related && container.contains(related)) return;
      toolbar.style.display = 'none';
    });

    return container;
  }

  /**
   * Let the editor ignore events that target the hover toolbar so its buttons
   * receive real clicks. CM6's mousedown handler calls preventDefault() on
   * events it handles, which cancels the subsequent click event on the
   * buttons — leaving them unresponsive.
   */
  ignoreEvent(event: Event): boolean {
    const target = event.target as Node | null;
    return target instanceof Element && target.closest('.cm-image-toolbar') !== null;
  }
}

// --- Media widget (video / file) ---------------------------------------------

/**
 * Widget for the non-image media kinds. A video reference becomes a
 * `<video controls preload="metadata">` player; anything else becomes a file
 * link card. `kind` is part of `eq()` so a path edit that flips a reference
 * between video and file forces CM6 to rebuild the widget.
 */
class MediaWidget extends WidgetType {
  constructor(
    private readonly _kind: 'video' | 'file',
    private readonly _alt: string,
    private readonly _path: string,
    private readonly _src: string | null,
  ) {
    super();
  }

  eq(other: MediaWidget): boolean {
    return (
      other._kind === this._kind &&
      other._alt === this._alt &&
      other._path === this._path &&
      other._src === this._src
    );
  }

  toDOM(): HTMLElement {
    const container = document.createElement('span');
    container.className = `cm-media-widget cm-media-${this._kind}`;
    container.style.display = 'inline-block';
    container.style.maxWidth = '100%';
    container.style.verticalAlign = 'middle';
    container.style.backgroundColor = 'var(--mdb-surface)';

    if (this._kind === 'video') {
      const video = document.createElement('video');
      video.controls = true;
      video.preload = 'metadata';
      // setAttribute (not .src) keeps a relative path relative: the property
      // getter resolves against the document base URL, which would make the
      // rendered attribute differ from the source path.
      video.setAttribute('src', this._src ?? this._path);
      video.style.maxWidth = '100%';
      video.style.display = 'block';
      container.appendChild(video);
    } else {
      const link = document.createElement('a');
      link.setAttribute('href', this._path);
      link.textContent = this._alt !== '' ? this._alt : this._path;
      container.appendChild(link);
    }

    return container;
  }

  /**
   * The player and the link keep their native behaviour (a click must reach
   * the control); a click on the card body is handed back to CM6. CM6 treats
   * an event as the editor's only when `ignoreEvent` returns false, so the
   * body returns false and the click places the cursor in the block.
   */
  ignoreEvent(event: Event): boolean {
    const target = event.target as Node | null;
    return target instanceof Element && target.closest('video, a') !== null;
  }
}

// --- Decoration creator ------------------------------------------------------

/**
 * Matches markdown image references: ![alt](path)
 * Excludes images inside code fences (``` or indented code blocks).
 */
const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;

/** Accepted `<!--w=N-->` bounds (px). */
export const MIN_IMAGE_WIDTH = 40;
export const MAX_IMAGE_WIDTH = 2000;

const WIDTH_COMMENT_RE = /^[ \t]*<!--\s*w=(\d+)\s*-->/;

/** Width persisted right after an image's markdown, or null (#498). */
export function parseImageWidth(text: string, after: number): number | null {
  const match = WIDTH_COMMENT_RE.exec(text.slice(after, after + 64));
  if (!match) return null;
  const width = Number(match[1]);
  if (!Number.isFinite(width) || width < MIN_IMAGE_WIDTH || width > MAX_IMAGE_WIDTH) return null;
  return width;
}

/**
 * Replace (or add) the width comment for the image whose markdown starts at
 * `from`, clamped to the accepted range (#498).
 */
export function applyImageWidth(view: EditorView, from: number, width: number): boolean {
  const clamp = Math.round(Math.max(MIN_IMAGE_WIDTH, Math.min(width, MAX_IMAGE_WIDTH)));
  const rest = view.state.doc.sliceString(from, Math.min(from + 400, view.state.doc.length));
  const image = /^!\[[^\]]*\]\([^)]+\)/.exec(rest);
  if (!image) return false;
  const imageEnd = from + image[0].length;
  const tail = rest.slice(image[0].length);
  const existing = /^[ \t]*<!--\s*w=\d+\s*-->/.exec(tail);
  const insert = `<!--w=${clamp}-->`;
  if (existing) {
    view.dispatch({ changes: { from: imageEnd, to: imageEnd + existing[0].length, insert } });
    return true;
  }
  view.dispatch({ changes: { from: imageEnd, to: imageEnd, insert } });
  return true;
}

/**
 * Finds line ranges that are inside code fences (``` delimited).
 * Returns an array of [start, end] offsets for fenced content.
 */
function findFencedRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const lines = text.split('\n');
  let inFence = false;
  let fenceStart = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineStart = i === 0 ? 0 : lines.slice(0, i).join('\n').length + 1;

    if (/^\s*```/.test(line)) {
      if (!inFence) {
        inFence = true;
        fenceStart = lineStart;
      } else {
        // End of fence — include the closing ``` line
        ranges.push([fenceStart, lineStart + line.length]);
        inFence = false;
        fenceStart = -1;
      }
    }
  }

  // Unclosed fence — treat rest of document as fenced
  if (inFence) {
    ranges.push([fenceStart, text.length]);
  }

  // Also handle indented code blocks (4 spaces or tab)
  let indentedStart = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineStart = i === 0 ? 0 : lines.slice(0, i).join('\n').length + 1;
    const isIndented = /^\s{4}|\t/.test(line);

    if (isIndented && indentedStart === -1) {
      indentedStart = lineStart;
    } else if (!isIndented && indentedStart !== -1) {
      ranges.push([indentedStart, lineStart]);
      indentedStart = -1;
    }
  }
  if (indentedStart !== -1) {
    ranges.push([indentedStart, text.length]);
  }

  return ranges;
}

/**
 * Checks if a position is inside any of the given ranges.
 */
function isInsideRange(pos: number, ranges: Array<[number, number]>): boolean {
  for (const [start, end] of ranges) {
    if (pos >= start && pos < end) return true;
  }
  return false;
}

/**
 * Create image decorations for all markdown image references in the document.
 *
 * @param docText - The full document text
 * @param resolve - Resolver function for image paths (default: always null)
 * @param callbacks - Optional callbacks for hover operations
 * @returns Array of CM6 Range<Decoration> for image widgets
 */
export function createImageDecorations(
  docText: string,
  resolve?: ImageResolver,
  callbacks?: ImageCallbacks,
): Range<Decoration>[] {
  const decorations: Range<Decoration>[] = [];
  const resolveFn = resolve ?? (() => null);
  const callbacksFn = callbacks ?? {};

  // Find code fence ranges to exclude
  const fencedRanges = findFencedRanges(docText);

  imageRegex.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = imageRegex.exec(docText)) !== null) {
    const matchStart = match.index;

    // Skip images inside code fences
    if (isInsideRange(matchStart, fencedRanges)) continue;

    const alt = match[1];
    const path = match[2];
    const kind = classifyMedia(path);
    const from = matchStart;
    const to = matchStart + match[0].length;

    if (kind === 'image') {
      // Resolve the image path (unchanged image behaviour: null → fallback text).
      const src = resolveFn(path);
      decorations.push(
        Decoration.replace({
          widget: new ImageWidget(alt, path, src, callbacksFn, parseImageWidth(docText, to), from),
          inclusive: false,
        }).range(from, to),
      );
      continue;
    }

    // Video URL resolution reuses the image resolver seam; unresolved video
    // paths fall back to the raw path so the player still gets a src.
    const src = kind === 'video' ? (resolveFn(path) ?? path) : null;
    decorations.push(
      Decoration.replace({
        widget: new MediaWidget(kind, alt, path, src),
        inclusive: false,
      }).range(from, to),
    );
  }

  return decorations;
}
