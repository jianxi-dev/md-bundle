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
import { Decoration, WidgetType } from '@codemirror/view';

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
  onImageDelete?: (path: string) => void;
  onImageLocate?: (path: string) => void;
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

  constructor(
    alt: string,
    path: string,
    src: string | null,
    callbacks: ImageCallbacks,
  ) {
    super();
    this._alt = alt;
    this._path = path;
    this._src = src;
    this._callbacks = callbacks;
  }

  eq(other: ImageWidget): boolean {
    return (
      other._alt === this._alt &&
      other._path === this._path &&
      other._src === this._src
    );
  }

  toDOM(): HTMLElement {
    const container = document.createElement('span');
    container.className = 'cm-image-widget';
    container.style.display = 'inline-block';
    container.style.position = 'relative';
    container.style.maxWidth = '100%';
    container.style.verticalAlign = 'middle';

    if (this._src) {
      // Render actual image
      const img = document.createElement('img');
      img.src = this._src;
      img.alt = this._alt;
      img.style.maxWidth = '100%';
      img.style.maxHeight = '24px';
      img.style.display = 'block';
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

    // Hover toolbar
    const toolbar = document.createElement('span');
    toolbar.className = 'cm-image-toolbar';
    toolbar.style.display = 'none';
    toolbar.style.position = 'absolute';
    toolbar.style.top = '-28px';
    toolbar.style.left = '0';
    toolbar.style.background = '#fff';
    toolbar.style.border = '1px solid #ddd';
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
    replaceBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._callbacks.onImageReplace?.(this._path);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.dataset.testid = 'img-hover-delete';
    deleteBtn.textContent = '删除';
    deleteBtn.style.marginRight = '4px';
    deleteBtn.style.cursor = 'pointer';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._callbacks.onImageDelete?.(this._path);
    });

    const locateBtn = document.createElement('button');
    locateBtn.dataset.testid = 'img-hover-locate';
    locateBtn.textContent = '定位';
    locateBtn.style.cursor = 'pointer';
    locateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._callbacks.onImageLocate?.(this._path);
    });

    toolbar.appendChild(replaceBtn);
    toolbar.appendChild(deleteBtn);
    toolbar.appendChild(locateBtn);
    container.appendChild(toolbar);

    // Show/hide toolbar on hover
    container.addEventListener('mouseenter', () => {
      toolbar.style.display = 'block';
    });
    container.addEventListener('mouseleave', () => {
      toolbar.style.display = 'none';
    });

    return container;
  }

  /**
   * Allow mouse events to reach the widget (needed for hover toolbar).
   */
  ignoreEvent(): boolean {
    return false;
  }
}

// --- Decoration creator ------------------------------------------------------

/**
 * Matches markdown image references: ![alt](path)
 * Excludes images inside code fences (``` or indented code blocks).
 */
const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;

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

    // Resolve the image path
    const src = resolveFn(path);

    // Create decoration replacing the entire match
    decorations.push(
      Decoration.replace({
        widget: new ImageWidget(alt, path, src, callbacksFn),
        inclusive: false,
      }).range(matchStart, matchStart + match[0].length),
    );
  }

  return decorations;
}
