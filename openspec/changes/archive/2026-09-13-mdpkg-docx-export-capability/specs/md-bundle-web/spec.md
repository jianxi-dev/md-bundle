## MODIFIED Requirements

### Requirement: Format-driven export of markdown source

The export dropdown SHALL explicitly offer five formats: `.md`, `.mdpkg`, Word (`.docx`), HTML, and PNG long-image. Exporting `.md` SHALL download the source text byte-identical to the editor content. When the document contains images, exporting `.md` SHALL first warn that images will be lost; cancelling SHALL abort the export. Word export SHALL be produced by the upstream mdpkg `toDocx` engine from a files Map assembled from the current editor source (`document.md`) and each imported asset's raw bytes, and SHALL yield a standard OOXML document (ZIP container with `[Content_Types].xml` + `word/document.xml`) whose images are embedded as `word/media/*` entries; the artifacts SHALL download as a `Blob` with filename derived from the document name (default `document.docx`). An empty document SHALL still produce a valid, non-empty `.docx`. Export failures SHALL surface through the deterministic `{ error }` result path of the export wrapper and MUST NOT crash or render a white screen.

#### Scenario: Export markdown with image-loss warning
- **WHEN** the user exports `.md` from a document that contains images
- **THEN** a "images will be lost" warning is shown before export, and cancelling produces no download

#### Scenario: Export empty markdown
- **WHEN** the user exports `.md` from an empty document
- **THEN** an empty file is downloaded without error

#### Scenario: Export a document to Word
- **WHEN** the user exports a non-empty document containing headings, lists, a table, and an imported image to Word (`.docx`)
- **THEN** a valid OOXML document downloads (ZIP magic bytes `PK\x03\x04`, `[Content_Types].xml` and `word/document.xml` present), the image is embedded as a `word/media/*` entry, and the download completes through the export result path

#### Scenario: Export an empty document to Word
- **WHEN** the user exports an empty document to Word
- **THEN** a valid, non-empty `.docx` is produced without error

#### Scenario: Word export of an SVG image degrades gracefully
- **WHEN** the document contains an SVG image whose bytes cannot be embedded as Office media
- **THEN** the export succeeds with an alt-text placeholder and a warning, without failing the whole export

#### Scenario: Word export failure is reported deterministically
- **WHEN** the export wrapper encounters an error while producing the `.docx`
- **THEN** the wrapper returns an `{ error }` result (no uncaught exception, no white screen) and the UI surfaces the error message

### Requirement: Homepage hero, tool workspace, and gallery

**Status:** MODIFIED in v2

The homepage SHALL present a redesigned hero with the tagline "分享 Markdown，不再裂图。" and a second line communicating the product's format range (open and edit `.md`, one-click `.mdpkg` packaging, export md·Word·HTML·PNG long-image), a product-style main visual of the editing workspace, dual call-to-action buttons, and three value badges (local-only no upload / single-file bundling / copy-to-share). The homepage SHALL include a Recent Documents section fed from session storage and a Featured Works gallery of official example documents (markdown with math+mermaid, markdown with callout+table, and a packaged mdpkg with images). Each gallery card SHALL show a real rendered-content thumbnail with title, auto summary, and format badge, and SHALL load the example into the editor as a new tab on click. A missing promo asset SHALL NOT collapse the hero (fallback present).

#### Scenario: Redesigned hero copy and format range are visible
- **WHEN** the homepage loads
- **THEN** the hero tagline, the format-range line, the product main visual, both CTA buttons, and the value badges are visible

#### Scenario: Load a featured example into the editor
- **WHEN** the user clicks a Featured Works example card
- **THEN** the example opens in the editor as a new tab

#### Scenario: Missing promo image falls back
- **WHEN** the promo image asset is missing
- **THEN** the hero still renders with a fallback and no layout collapse