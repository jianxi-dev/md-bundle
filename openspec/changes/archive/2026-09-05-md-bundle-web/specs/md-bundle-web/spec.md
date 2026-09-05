## ADDED Requirements

### Requirement: Open markdown and package files
The system SHALL support opening files via file-selector and drag-and-drop for `.md` and `.mdpkg` inputs. `.md` files SHALL open directly into the editor. `.mdpkg` files SHALL be unpacked via the upstream `openMdpkg` reader and shown in a sandboxed iframe preview with a validation report. Corrupted, schema-invalid, or non-format files SHALL produce a graceful, deterministic error state and MUST NOT crash or render a white screen.

#### Scenario: Open a markdown file via file selector
- **WHEN** the user selects a `.md` file through the file picker
- **THEN** the file content loads into the source editor

#### Scenario: Drag a package file into the app
- **WHEN** the user drags a valid `.mdpkg` file onto the dropzone
- **THEN** the file is unpacked and the full preview renders inside a sandboxed iframe

#### Scenario: Open a corrupted file
- **WHEN** the user opens a file whose bytes are not a valid package or contain a schema-violating manifest
- **THEN** the system shows an error UI with a clear message and no uncaught exception or white screen

### Requirement: Markdown editing with split preview and slash templates
The system SHALL provide a CodeMirror 6 source editor (markdown language, controlled value, #165DFF dark theme) with a beautified split preview, all shipped from the shared `@md-bundle/editor` library. Typing `/` SHALL show a slash-command menu (heading / callout / image-ref / code block / table / quote) that inserts markdown templates at the cursor; Esc SHALL close the menu without inserting. The preview SHALL render markdown to HTML via marked on a github-markdown-css base, and SHALL escape embedded script so it is never executed.

#### Scenario: Typing reflects into preview
- **WHEN** the user edits markdown in the source editor
- **THEN** the split preview updates to the rendered HTML fragment in real time

#### Scenario: Insert a heading via slash command
- **WHEN** the user types `/` at the cursor and selects "heading" from the command menu
- **THEN** `## ` is inserted at the cursor

#### Scenario: Esc closes slash menu without inserting
- **WHEN** the user opens the slash menu and presses Esc
- **THEN** the menu closes and no template is inserted

#### Scenario: Embedded script is escaped
- **WHEN** markdown containing a `<script>` block is rendered to preview
- **THEN** the script is escaped as text and is not executed

### Requirement: Frictionless image import and asset management
The system SHALL import images through three channels — clipboard paste, drag onto the editor, and multi-file selection — in at most 2 steps with no wizard or dialog. Each import SHALL insert a markdown image reference at the cursor and add the image to an asset manifest sidebar (path / size / thumbnail) that supports delete and replace. When the body already references `![name](name.png)` / `![name](./name.png)`, batch import SHALL auto-wire images by filename. Pasting non-image content SHALL NOT trigger an import; duplicate names SHALL be auto-renamed without overwriting.

#### Scenario: Paste a clipboard screenshot
- **WHEN** the user pastes a screenshot image onto the editor
- **THEN** an image reference appears in the body and the image is listed in the asset sidebar

#### Scenario: Paste non-image content
- **WHEN** the user pastes text or other non-image content
- **THEN** no import is triggered and the editor content is unaffected

#### Scenario: Batch import wires existing references by filename
- **WHEN** the body already contains `![name](name.png)` and the user batch-selects a file named `name.png`
- **THEN** the reference is wired to the imported asset without further user steps

#### Scenario: Duplicate import filename does not overwrite
- **WHEN** the user imports an image whose name already exists in the asset list
- **THEN** the new image is auto-renamed and the existing asset is not overwritten

### Requirement: Package validation report
The system SHALL surface the validation result returned by `openMdpkg` (`validation.ok` / `errors` / `warnings` / `externalCount`) in a report panel. A valid package SHALL show a pass state; a package with errors SHALL list each error; `externalCount > 0` SHALL show an external-reference notice.

#### Scenario: Valid package shows pass state
- **WHEN** a valid `.mdpkg` is opened
- **THEN** the validation panel shows a "passed" state

#### Scenario: Invalid package lists errors
- **WHEN** a `.mdpkg` with validation errors is opened
- **THEN** the panel lists each error and shows a fail state

### Requirement: Content-driven save
The main "save" button SHALL be content-driven: a document containing images SHALL save as `.mdpkg`; an image-free document SHALL save as `.md`; a document opened from `.mdpkg` SHALL save back to `.mdpkg` (seamless repackaging). `.mdpkg` writing SHALL reuse the upstream `packMdpkg` so the output is spec-compliant and round-trips through `openMdpkg` with content equivalence.

#### Scenario: Save a document with images
- **WHEN** the user clicks save on a document that contains imported images
- **THEN** the system downloads a `.mdpkg` file

#### Scenario: Save an image-free document
- **WHEN** the user clicks save on a document with no images
- **THEN** the system downloads a `.md` file with byte-identical editor text

#### Scenario: Repack a package and reopen it
- **WHEN** a `.mdpkg` is opened, edited, saved again, and reopened
- **THEN** the repacked package opens with files, manifest, and html content-equivalent to the source, with matching asset paths, sha256, and media types

### Requirement: Format-driven export of markdown source
The export dropdown SHALL explicitly offer four formats: `.md`, `.mdpkg`, HTML, and PNG long-image. Exporting `.md` SHALL download the source text byte-identical to the editor content. When the document contains images, exporting `.md` SHALL first warn that images will be lost; cancelling SHALL abort the export.

#### Scenario: Export markdown with image-loss warning
- **WHEN** the user exports `.md` from a document that contains images
- **THEN** a "images will be lost" warning is shown before export, and cancelling produces no download

#### Scenario: Export empty markdown
- **WHEN** the user exports `.md` from an empty document
- **THEN** an empty file is downloaded without error

### Requirement: Self-contained HTML export
The system SHALL export a self-contained HTML document rendered with the theme system: all images SHALL be inlined as `data:image/...` URIs, with zero relative paths, `file://` URLs, or external image references, and a "Made with MD-Bundle" byline footer linking to `https://bundle.jianxi.me/?ref=md-html`.

#### Scenario: HTML export inlines all images
- **WHEN** a fixture `.mdpkg` containing K images is opened and exported to HTML
- **THEN** the HTML contains K `<img>` tags that are all `data:image/...` URIs and zero broken or external image references

#### Scenario: HTML export of an image-free document
- **WHEN** an image-free markdown document is exported to HTML
- **THEN** the HTML contains no `<img>` tags and renders without error

### Requirement: PNG long-image export
The system SHALL export the whole document as a PNG long-image by rendering themed HTML into an SVG `foreignObject` and rasterizing onto a canvas (no html2canvas). CJK and emoji text SHALL render without tofu. Empty documents SHALL produce a clear error and no corrupt PNG.

#### Scenario: Export a document containing CJK and emoji
- **WHEN** the user exports a document containing text such as "中文👍测试" as a PNG long-image
- **THEN** the PNG is non-empty, has positive dimensions, and sampled pixels show no tofu artifacts

#### Scenario: Export an empty document to PNG
- **WHEN** the user exports an empty document as a PNG long-image
- **THEN** the system shows a clear error message and produces no corrupt PNG

### Requirement: Homepage hero, tool workspace, and gallery
The homepage SHALL present a hero with the tagline "分享 Markdown，不再裂图。" and "一个文件，带走全部图文。", a logo, and a promo image in the #165DFF dark minimal visual style, with an embedded tool workspace and an official-example gallery section. Gallery examples SHALL load into the editor in one click. A missing promo image SHALL NOT collapse the hero (fallback present).

#### Scenario: Hero copy is visible
- **WHEN** the homepage loads
- **THEN** both hero taglines, the logo, and the promo image are visible

#### Scenario: Load a gallery example into the editor
- **WHEN** the user clicks an official example in the gallery section
- **THEN** the example loads into the embedded editor workspace

#### Scenario: Missing promo image falls back
- **WHEN** the promo image asset is missing
- **THEN** the hero still renders with a fallback and no layout collapse

### Requirement: SEO multi-page static site
The system SHALL build three statically crawlable pages — landing (`index`), `/spec`, and `/about` — via Vite multi-page build (not SPA client routing). The site SHALL ship `robots.txt`, `sitemap.xml`, an OG image at 1200×630, JSON-LD `SoftwareApplication` metadata, and per-page canonical URLs pointing at `bundle.jianxi.me`. Page body content SHALL be present in the static HTML without requiring JavaScript.

#### Scenario: Static pages are crawlable
- **WHEN** the built output of all three pages is inspected
- **THEN** each page's body content and meta tags are present in its static HTML

#### Scenario: Sitemap lists all pages
- **WHEN** `sitemap.xml` is inspected
- **THEN** it contains the landing, `/spec`, and `/about` URLs under `bundle.jianxi.me`

#### Scenario: OG image has correct dimensions
- **WHEN** the OG image asset is inspected
- **THEN** its dimensions are 1200×630

### Requirement: Made-with byline and copy-as-image share card
The system SHALL render a small clickable "Made with MD-Bundle" byline (with a `?ref=` link) into the exported HTML footer, the PNG long-image corner, and the share-card corner. The `.mdpkg` file body SHALL remain clean of any branding. The primary share action SHALL be "copy as image": the share card (work thumbnail + stats + corner byline) SHALL be rendered to a PNG and copied to the clipboard, falling back to a PNG download when the Clipboard API is unavailable or denied. With no document data the share control SHALL be disabled.

#### Scenario: Byline appears in exports but not in package bytes
- **WHEN** HTML, PNG, and share-card artifacts are produced from a document
- **THEN** each contains the "Made with MD-Bundle" byline with its `?ref=` link, and the `.mdpkg` bytes contain no byline string

#### Scenario: Copy share card as image
- **WHEN** the user triggers copy-as-image on a document with content
- **THEN** a valid PNG blob (magic bytes `89 50 4E 47`) is handed to the clipboard seam

#### Scenario: Clipboard unavailable falls back to download
- **WHEN** the Clipboard API is unavailable or denied
- **THEN** the share card PNG is downloaded instead

#### Scenario: Share disabled without document data
- **WHEN** there is no document data to share
- **THEN** the share control is disabled and no empty card is generated

### Requirement: Local tiered achievement badges
The system SHALL award local achievement badges on a localStorage-backed ladder with rarity tiers (Common/Rare/Epic/Legendary). Badges SHALL unlock at the moment of completion of real Phase-1 actions — first successful `.mdpkg` save, first PNG export, and the Nth export (tier escalation) — never at registration or page entry. Unlocked state SHALL persist across reloads, repeated triggers SHALL NOT re-unlock or re-toast, and corrupted localStorage data SHALL degrade safely.

#### Scenario: First PNG export unlocks a badge
- **WHEN** the user completes their first successful PNG long-image export
- **THEN** the `first-png` badge unlocks and a completion toast appears

#### Scenario: First package save unlocks a badge
- **WHEN** the user completes their first successful `.mdpkg` save
- **THEN** the `first-pack` badge unlocks

#### Scenario: Tier escalates with repeated exports
- **WHEN** the user completes the Nth export that crosses the ladder threshold
- **THEN** the badge upgrades to the next rarity tier

#### Scenario: Badge state persists across reloads
- **WHEN** the user reloads the page after unlocking a badge
- **THEN** the unlocked badge and tier state are restored from localStorage

#### Scenario: Corrupted badge storage degrades safely
- **WHEN** localStorage badge data is malformed
- **THEN** the badge system starts from an empty default state without crashing

### Requirement: Static deployment on Vercel
The system SHALL deploy as a static site on Vercel bound to `bundle.jianxi.me`. The production landing, `/spec`, and `/about` pages SHALL return 200, and the tool SHALL open an official example `.mdpkg` in production.

#### Scenario: Production smoke test passes
- **WHEN** a smoke test visits `bundle.jianxi.me`, `/spec`, and `/about` in production and opens an example package
- **THEN** all three pages return 200 and the tool renders the example package
