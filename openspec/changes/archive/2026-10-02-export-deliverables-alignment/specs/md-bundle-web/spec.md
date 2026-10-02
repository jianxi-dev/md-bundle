## MODIFIED Requirements

### Requirement: Format-driven export of markdown source

The export dropdown SHALL explicitly offer six formats: `.md`, `.mdpkg`, Word (`.docx`), HTML, PNG long-image, and `.zip`. Exporting `.md` SHALL produce a single Markdown file via the upstream `toMarkdown` engine (include directives expanded, symbols kept as source text); for documents without includes this is equivalent to the editor source text. Exporting `.zip` SHALL produce a standard zip deliverable via the upstream `toZip` engine (includes expanded, no `manifest.json`, with an attached `README.md`). When the document contains images, exporting `.md` SHALL first warn that images will be lost; cancelling SHALL abort the export. Word export SHALL be produced by the upstream mdpkg `toDocx` engine from a files Map assembled from the current editor source (`document.md`) and each imported asset's raw bytes, and SHALL yield a standard OOXML document (ZIP container with `[Content_Types].xml` + `word/document.xml`) whose images are embedded as `word/media/*` entries; the artifacts SHALL download as a `Blob` with filename derived from the document name (default `document.docx`). An empty document SHALL still produce a valid, non-empty `.docx`. Export failures SHALL surface through the deterministic `{ error }` result path of the export wrapper and MUST NOT crash or render a white screen.

#### Scenario: Export markdown with image-loss warning
- **WHEN** the user exports `.md` from a document that contains images
- **THEN** a "images will be lost" warning is shown before export, and cancelling produces no download

#### Scenario: Export markdown expands includes
- **WHEN** the user exports `.md` from a `.mdpkg` document that contains `<<< include` directives
- **THEN** the downloaded single file has includes inlined and is byte-identical to the CLI `export --md` output

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

#### Scenario: Export zip is a standard deliverable
- **WHEN** the user exports a `.mdpkg` document with includes to `.zip`
- **THEN** the downloaded file is a valid ZIP (PK magic), contains a `README.md`, contains no `manifest.json`, has includes expanded, and is byte-identical to the CLI `export --zip` output

#### Scenario: Export zip from image-free document
- **WHEN** the user exports an image-free `.md` document to `.zip`
- **THEN** a valid ZIP downloads containing the entry document and a `README.md`, without error
