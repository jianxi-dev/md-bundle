/**
 * Shared contracts for the application-layer capabilities that both the web app
 * and Clairis consume: mdpkg packaging, export, clipboard and the outline.
 *
 * This module is intentionally TYPE-ONLY. The implementations move here in the
 * follow-up tickets (#508–#511); declaring the seams first keeps every consumer
 * agnostic about whether it runs in a browser tab or an Electron window.
 */

/** A file-like payload handed to a download/save seam. */
export interface FilePayload {
  readonly name: string;
  readonly blob: Blob;
}

/**
 * How a consumer writes a file. The web app downloads it; Clairis writes it with
 * the main-process `fs` API.
 */
export type SaveFile = (payload: FilePayload) => Promise<void>;

/**
 * How a consumer puts an image on the clipboard. The web app uses
 * `navigator.clipboard`; Clairis uses Electron's `clipboard.writeImage`.
 * Returning `false` (never throwing) is the contract: callers fall back to a
 * download.
 */
export type ClipboardWriter = (png: Blob) => Promise<boolean>;

/** One heading row of the outline. */
export interface OutlineHeading {
  /** Heading level 1–6. */
  readonly level: number;
  /** Heading text without the leading `#`s. */
  readonly text: string;
  /** 0-based line number in the markdown source. */
  readonly line: number;
}

/**
 * How a consumer scrolls the editor (or the preview pane) to a heading. The
 * outline never holds an editor instance itself, so Clairis can inject its own.
 */
export interface OutlineNavigator {
  /** Scroll to a source line (edit/source mode). */
  scrollToLine(line: number): void;
  /** Scroll to the rendered heading element (preview mode). */
  scrollToHeading(id: string): void;
}

/** Formats the exporter can produce. */
export type ExportFormat = 'html' | 'png' | 'docx' | 'mdpkg';

/** Result of opening a package: content on success, a localized message otherwise. */
export type OpenPackageResult<T> = { readonly ok: true; readonly package: T } | { readonly ok: false; readonly error: string };
