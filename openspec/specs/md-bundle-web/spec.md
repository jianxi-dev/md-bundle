# MD-Bundle Web

## Purpose

MD-Bundle Web is a browser-based Markdown packaging tool that bundles images and attachments into a self-contained `.mdpkg` file, enabling zero-crack image sharing.

## Requirements

### Requirement: Open markdown and package files

**Status:** MODIFIED in v2

The system SHALL support opening files via file-selector and drag-and-drop for `.md` and `.mdpkg` inputs. `.md` files SHALL open directly into the editor in a new tab. `.mdpkg` files SHALL be unpacked via the upstream `openMdpkg` reader and rendered through the shared markdown renderer as a live preview that refreshes as the document is edited (the v1 sandboxed-iframe static preview is removed). A package's validation result SHALL surface in a validation banner and its resource inventory in the left-rail Assets tab. Corrupted, schema-invalid, or non-format files SHALL produce a graceful, deterministic error state and MUST NOT crash or render a white screen.

#### Scenario: Open a markdown file via file selector
- **WHEN** the user selects a `.md` file through the file picker
- **THEN** the file content loads into the source editor in a new tab

#### Scenario: Open a package file and see live preview
- **WHEN** the user opens a valid `.mdpkg` file
- **THEN** the file is unpacked, the full preview renders through the shared renderer, and the preview refreshes when the document is edited

#### Scenario: Open a corrupted file
- **WHEN** the user opens a file whose bytes are not a valid package or contain a schema-violating manifest
- **THEN** the system shows an error UI with a clear message and no uncaught exception or white screen

### Requirement: Markdown editing with split preview and slash templates

**Status:** MODIFIED in v2

The system SHALL provide a CodeMirror 6 source editor (markdown language, controlled value, dark theme) shipped from the shared `@md-bundle/editor` library. Editing follows the living-source paradigm: markdown stays the source of truth and in-edit decorations (headings, bold/italic, lists, quotes, inline code, inline images, callout cards) render visually, revealing raw markdown at the caret. Typing `/` SHALL show a slash-command menu (heading / callout / image-ref / code block / table / quote) that inserts markdown templates at the cursor; Esc SHALL close the menu without inserting. Rendering of preview output is delegated to the shared markdown renderer, and embedded script SHALL always be escaped so it is never executed. The former always-on split preview is replaced by the explicit three-mode workspace (edit / source / preview).

#### Scenario: Editing reflects into preview mode
- **WHEN** the user edits markdown in the editor and switches to preview mode
- **THEN** the preview shows the rendered HTML fragment from the shared renderer

#### Scenario: Insert a heading via slash command
- **WHEN** the user types `/` at the cursor and selects "heading" from the command menu
- **THEN** `## ` is inserted at the cursor

#### Scenario: Esc closes slash menu without inserting
- **WHEN** the user opens the slash menu and presses Esc
- **THEN** the menu closes and no template is inserted

#### Scenario: Embedded script is escaped
- **WHEN** markdown containing a `<script>` block is rendered to preview
- **THEN** the script is escaped as text and is not executed

#### Scenario: Caret reveals source in a decorated block
- **WHEN** the user moves the caret into a visually decorated heading or callout block
- **THEN** the raw markdown markers for that block become visible without changing the document value

### Requirement: Frictionless image import and asset management

The system SHALL import images through three channels -- clipboard paste, drag onto the editor, and multi-file selection -- in at most 2 steps with no wizard or dialog. Each import SHALL insert a markdown image reference at the cursor and add the image to an asset manifest (path / size / thumbnail) that supports delete and replace. When the body already references `![name](name.png)` / `![name](./name.png)`, batch import SHALL auto-wire images by filename. Pasting non-image content SHALL NOT trigger an import; duplicate names SHALL be auto-renamed without overwriting.

#### Scenario: Paste a clipboard screenshot
- **WHEN** the user pastes a screenshot image onto the editor
- **THEN** an image reference appears in the body and the image is listed in the asset inventory

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

**Status:** MODIFIED in v2

The system SHALL surface the validation result returned by `openMdpkg` (`validation.ok` / `errors` / `warnings` / `externalCount`) in a validation banner at the top of the workspace, with the package's resource inventory listed in the left-rail Assets tab. A valid package SHALL show a pass state; a package with errors SHALL list each error; `externalCount > 0` SHALL show an external-reference notice.

#### Scenario: Valid package shows pass state
- **WHEN** a valid `.mdpkg` is opened
- **THEN** the validation banner shows a "passed" state

#### Scenario: Invalid package lists errors
- **WHEN** a `.mdpkg` with validation errors is opened
- **THEN** the banner lists each error and shows a fail state

### Requirement: Format-driven export of markdown source

The export dropdown SHALL explicitly offer five formats: `.md`, `.mdpkg`, Word (`.docx`), HTML, and PNG long-image. Exporting `.md` SHALL download the source text byte-identical to the editor content. When the document contains images, exporting `.md` SHALL first warn that images will be lost; cancelling SHALL abort the export. Word export SHALL be produced by the upstream mdpkg `toDocx` engine from a files Map assembled from the current editor source (`document.md`) and each imported asset's raw bytes, and SHALL yield a standard OOXML document (ZIP container with `[Content_Types].xml` + `word/document.xml`) whose images are embedded as `word/media/*` entries; the artifact SHALL download as a `Blob` with filename derived from the document name (default `document.docx`). An empty document SHALL still produce a valid, non-empty `.docx`. Export failures SHALL surface through the deterministic `{ error }` result path of the export wrapper and MUST NOT crash or render a white screen.

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

### Requirement: Content-driven save

**Status:** MODIFIED in v2

The main save button SHALL be content-driven: a document containing images SHALL save as `.mdpkg`; an image-free document SHALL save as `.md`; a document opened from `.mdpkg` SHALL save back to `.mdpkg` (seamless repackaging). `.mdpkg` writing SHALL reuse the upstream `packMdpkg` so the output is spec-compliant and round-trips through `openMdpkg` with content equivalence. Whether the button writes back to disk, triggers save-as, or downloads is governed by the three-tier save model (FSA availability and handle ownership); the format selection rule above applies in every path.

#### Scenario: Save a document with images
- **WHEN** the user saves a document that contains imported images
- **THEN** the system produces a `.mdpkg` file (written to disk, save-as, or downloaded per the three-tier model)

#### Scenario: Save an image-free document
- **WHEN** the user saves a document with no images
- **THEN** the system produces a `.md` file with byte-identical editor text

#### Scenario: Repack a package and reopen it
- **WHEN** a `.mdpkg` is opened, edited, saved again, and reopened
- **THEN** the repacked package opens with files, manifest, and html content-equivalent to the source, with matching asset paths, sha256, and media types

### Requirement: Made-with byline and copy-as-image share card

**Status:** MODIFIED in v2

The system SHALL render a small clickable "Made with MD-Bundle" byline (with a `?ref=` link) into the exported HTML footer and the PNG long-image corner. The `.mdpkg` file body SHALL remain clean of any branding. This requirement's document-level sharing capability is split into two independent features: the invite share cards for the website (see "Invite share cards") and the document "copy body as image" button. The document copy-as-image action SHALL be a dedicated ghost icon button at the leftmost position of the top-bar action area, SHALL render the current document body through the shared renderer with a byline containing the website URL and the fading Jianxi brand, SHALL copy the PNG to the clipboard with a download fallback when the Clipboard API is unavailable or denied, and SHALL be disabled when no document is open. Invite cards are website-level, do not consume the current document, and remain available without an open document.

#### Scenario: Byline appears in exports but not in package bytes
- **WHEN** HTML, PNG, and copy-as-image artifacts are produced from a document
- **THEN** each contains the "Made with MD-Bundle" byline with its `?ref=` link, and the `.mdpkg` bytes contain no byline string

#### Scenario: Copy document body as image from the top-bar button
- **WHEN** the user triggers copy-as-image on a document with content from the leftmost top-bar icon button
- **THEN** a valid PNG blob (magic bytes `89 50 4E 47`) is handed to the clipboard seam

#### Scenario: Clipboard unavailable falls back to download
- **WHEN** the Clipboard API is unavailable or denied
- **THEN** the document PNG is downloaded instead

#### Scenario: Copy-as-image disabled without document data
- **WHEN** there is no document open
- **THEN** the copy-as-image top-bar button is disabled and no empty card is generated

### Requirement: Local tiered achievement badges

The system SHALL award local achievement badges on a localStorage-backed ladder with rarity tiers (Common/Rare/Epic/Legendary). Badges SHALL unlock at the moment of completion of real Phase-1 actions -- first successful `.mdpkg` save, first PNG export, and the Nth export (tier escalation) -- never at registration or page entry. Unlocked state SHALL persist across reloads, repeated triggers SHALL NOT re-unlock or re-toast, and corrupted localStorage data SHALL degrade safely.

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

### Requirement: SEO multi-page static site

**Status:** MODIFIED in v2 (see also "SEO example pages")

The system SHALL build statically crawlable pages -- landing (`index`), `/spec`, `/about`, and one page per featured example document -- via Vite multi-page build (not SPA client routing). The site SHALL ship `robots.txt`, `sitemap.xml`, an OG image at 1200x630, JSON-LD `SoftwareApplication` metadata, and per-page canonical URLs pointing at `bundle.jianxi.me`. Page body content SHALL be present in the static HTML without requiring JavaScript.

#### Scenario: Static pages are crawlable
- **WHEN** the built output of all pages is inspected
- **THEN** each page's body content and meta tags are present in its static HTML

#### Scenario: Sitemap lists all pages
- **WHEN** `sitemap.xml` is inspected
- **THEN** it contains the landing, `/spec`, `/about`, and example page URLs under `bundle.jianxi.me`

#### Scenario: OG image has correct dimensions
- **WHEN** the OG image asset is inspected
- **THEN** its dimensions are 1200x630

### Requirement: Static deployment on Vercel

The system SHALL deploy as a static site on Vercel bound to `bundle.jianxi.me`. The production landing, `/spec`, and `/about` pages SHALL return 200, and the tool SHALL open an official example `.mdpkg` in production.

#### Scenario: Production smoke test passes
- **WHEN** a smoke test visits `bundle.jianxi.me`, `/spec`, and `/about` in production and opens an example package
- **THEN** all three pages return 200 and the tool renders the example package

### Requirement: Shared markdown renderer

**Status:** ADDED in v2

The system SHALL provide a shared `@md-bundle/renderer` package that owns the single markdown rendering pipeline: marked + DOMPurify sanitization (the sole sanitization source of truth), KaTeX math, lazy-loaded mermaid, lezer-based code highlighting, callout folding, CJK spacing, frontmatter stripping, and image figure/zoom markup. The package SHALL export `renderMarkdown(markdown, opts)` (a pure function that never throws and degrades unsupported single features), `readerCssText` (reader typography with `[data-theme]` dark/light variants), `calloutTypeMap` (the clairis source's callout key set snapshotted verbatim -- 22 keys; earlier documents claiming 23 were a miscount), and `hydrateLazyFeatures(root, theme)` (mounts KaTeX/mermaid asynchronously and always resolves). `.md` live preview, HTML export, and PNG long-image export SHALL all consume this renderer; the editor's hand-written sanitizer is removed. Vendored `mdpkg-web.js` rendering is used only for export fidelity.

#### Scenario: Rendered markdown is sanitized
- **WHEN** markdown containing script, onerror handlers, javascript URLs, or iframes is rendered via `renderMarkdown`
- **THEN** the output HTML strips or escapes all executable content

#### Scenario: Lazy features hydrate into a detached root
- **WHEN** rendered HTML containing math and mermaid placeholders is hydrated in a detached DOM root
- **THEN** the placeholders become KaTeX and SVG output, and the promise always resolves even on bad input

### Requirement: Living-source editor decorations

**Status:** ADDED in v2

The system SHALL decorate the CodeMirror editor so markdown structure renders visually while the document value stays pure markdown: heading markers, bold/italic delimiters, list markers, quote blocks, inline code, inline images (with a hover action bar for replace/delete/locate), and callout cards (tones from the renderer's `calloutTypeMap`). Decorations SHALL be recalculated only outside IME composition (`view.composing === true` skips, and a compositionend pass catches up) so the decoration set never flickers mid-composition. Moving the caret into a decorated block SHALL reveal the raw markdown. Unsupported callout prefixes SHALL degrade to plain text. In source mode all decorations SHALL be disabled via a CodeMirror compartment.

#### Scenario: Decorations leave the document value untouched
- **WHEN** a heading is visually decorated in the editor
- **THEN** the underlying document text still contains the raw `#` marker and an undo restores exactly

#### Scenario: IME composition does not flicker decorations
- **WHEN** the user composes CJK text inside a decorated block
- **THEN** the decoration set remains stable during composition and catches up after compositionend

#### Scenario: Inline image hover bar offers replace and delete
- **WHEN** the user hovers an inline image widget in the editor
- **THEN** a replace and a delete action appear and trigger the existing asset flows

### Requirement: Three-mode workspace

**Status:** ADDED in v2

The system SHALL provide a single-pane three-mode workspace: edit (default, living source with decorations), source (raw CodeMirror view, full window, no decorations), and preview (read-only centered rendering through the shared renderer, ~800px). Mode switching SHALL use ghost icon buttons (pencil / code / eye) in the top bar on desktop and mobile, SHALL NOT remount the editor (undo history persists across edit<->source), and SHALL persist per tab. Preview SHALL refresh as the document is edited.

#### Scenario: Switching modes preserves undo history
- **WHEN** the user types in edit mode, switches to source mode, and switches back
- **THEN** undo still restores the pre-typing content

#### Scenario: Rapid mode cycling produces no page errors
- **WHEN** the user cycles edit -> source -> preview repeatedly
- **THEN** no page error is thrown and the workspace renders correctly

### Requirement: Multi-tab session persistence

**Status:** ADDED in v2

The system SHALL model documents as tabs (id / kind / name / source / assets / optional mdpkg files and manifest / mode / scroll position / dirty flag / optional disk handle). Opening a file or example SHALL always create a new tab and never silently replace the current one. Tabs SHALL be unlimited. Tab state SHALL auto-save to IndexedDB (debounced ~500ms on edits) together with the active tab, recent documents, and FSA handles, and SHALL silently restore the full session on reload with no prompt or wizard. IndexedDB quota failures SHALL degrade to in-memory operation with a toast, never a crash.

#### Scenario: Two tabs keep independent content
- **WHEN** the user opens two documents in two tabs and edits both
- **THEN** each tab retains its own independent content and undo history

#### Scenario: Reload restores the full session
- **WHEN** the user reloads the page with open tabs and assets
- **THEN** all tabs, the active tab, mode, and assets are restored from IndexedDB

#### Scenario: Quota exhaustion degrades gracefully
- **WHEN** IndexedDB writes fail due to quota exhaustion
- **THEN** the session continues in memory and a toast warns without crashing

### Requirement: Recent documents

**Status:** ADDED in v2

The system SHALL keep a recent-documents list in session storage, populated when tabs are created and retained when tabs are closed. The landing page SHALL render Recent Documents entries that restore the document (content, mode, scroll position, and disk handle when available) into a new tab on click. Corrupted entries SHALL be skipped without crashing.

#### Scenario: Closed document reappears in recent documents
- **WHEN** the user closes a tab and returns to the landing page
- **THEN** the document appears in Recent Documents and clicking it restores it as a new tab

#### Scenario: Corrupted recent entry is skipped
- **WHEN** a stored recent-document entry is malformed
- **THEN** the entry is skipped and the rest of the list renders normally

### Requirement: Hover outline

**Status:** ADDED in v2

The system SHALL provide a document outline as a small ghost icon button at the top-right inside the workspace content panel (visible in edit, source, and preview modes; on mobile in the same relative position below the tab strip, never overlapping it). Hovering or clicking the button SHALL open a frosted-glass overlay (backdrop blur, thin border, hierarchical guide lines, current-heading accent left bar, shadow) listing h1-h6 headings parsed code-fence-aware from the document text (edit/source modes) or from the rendered DOM (preview mode). Clicking the button SHALL pin the overlay, clicking again or pressing Esc SHALL close it. The outline SHALL navigate on click only -- no folding, no block dragging. It SHALL be keyboard reachable (Tab + Enter/Esc) and SHALL NOT depend on FSA.

#### Scenario: Hover opens and click pins the outline
- **WHEN** the user hovers the outline button and then clicks it
- **THEN** the overlay opens on hover, stays pinned after the click, and closes on Esc

#### Scenario: Outline click jumps to the heading in all modes
- **WHEN** the user clicks an outline entry in edit, source, and preview modes
- **THEN** the workspace scrolls the heading into view in each mode

### Requirement: Left-rail asset inventory

**Status:** ADDED in v2

The system SHALL remove the always-visible asset sidebar and move asset management into a collapsible left rail (~260px) with Files and Assets tabs (collapsed by default). The Assets tab SHALL list every imported image (thumbnail / name / size / reference status / replace / delete) and SHALL compute and mark orphan assets (imported but unreferenced in the body, or unreferenced within an opened mdpkg package) with a yellow indicator, plus a batch-import control. A badge dot on the rail toggle SHALL signal the presence of orphans. Delete and replace SHALL reuse the existing asset logic.

#### Scenario: Orphan asset is marked in the Assets tab
- **WHEN** an imported image is no longer referenced by the body
- **THEN** the asset is marked as orphan in the left-rail Assets tab

#### Scenario: Replace and delete still work from the left rail
- **WHEN** the user replaces or deletes an asset from the Assets tab
- **THEN** the asset manifest and body references update through the existing asset flows

### Requirement: Whole-window direct drop

**Status:** ADDED in v2

The system SHALL accept drops anywhere in the window (including the landing page) with no overlay or intermediate UI: dropping `.md` / `.mdpkg` SHALL immediately open a new tab; dropping an image inside the editor DOM SHALL route to the existing image import; dropping an image outside the editor with no active tab SHALL prompt the user to open a document first; dropping files onto a folder node in the file tree SHALL copy them into that folder. `dragover` SHALL only `preventDefault` to permit the drop; no covering overlay element SHALL be rendered at any point.

#### Scenario: Drop a markdown file on the landing page
- **WHEN** the user drops a `.md` file anywhere on the landing page
- **THEN** a new editor tab opens with the file content immediately

#### Scenario: Editor-internal image drop imports instead of opening
- **WHEN** the user drops an image inside the editor DOM
- **THEN** the image import flow runs and no new tab is opened

#### Scenario: No overlay element is ever present
- **WHEN** the user drags a file over the window
- **THEN** the DOM contains no drop-zone overlay node

### Requirement: FSA folder workspace (Chromium)

**Status:** ADDED in v2

The system SHALL offer a File System Access folder workspace as a Chromium-only progressive enhancement: `grantWorkspaceFolder()` calls `showDirectoryPicker` with readwrite mode; the directory handle persists in IndexedDB and re-entry offers one-click re-granting via `requestPermission`, with a refused permission degrading to a hidden tree plus a notice. The file tree SHALL list `.md` / `.mdpkg` / folders recursively from the granted directory (lazy expand, manual refresh -- no automatic change watching), highlight the node of the currently open document, and show an empty state with an "authorize folder" CTA when no folder is granted. Clicking a `.md` / `.mdpkg` node SHALL open it in a new tab holding the file handle for save write-back. All FSA capability functions SHALL return `{ ok } | { error }` results and never throw. In non-FSA environments the feature SHALL be entirely hidden and the main flow stays equivalent to v1. The system SHALL NOT preset any system directory (desktop/downloads/documents enumeration is forbidden).

#### Scenario: Folder authorization persists and re-grants
- **WHEN** the user authorizes a folder, reloads, and re-enters
- **THEN** the handle is restored and one click re-grants readwrite permission

#### Scenario: Tree opens a file into a tab with a write handle
- **WHEN** the user clicks a `.md` file in the authorized folder tree
- **THEN** the file opens in a new tab and that tab holds the file handle for write-back

#### Scenario: No-FSA environment hides the feature
- **WHEN** the browser lacks the three File System Access pickers
- **THEN** the file-tree feature is hidden and the main open/edit/save flow works as v1

### Requirement: Three-tier save model

**Status:** ADDED in v2

The system SHALL implement a three-tier save model with a single primary button in the top bar (one rule, no ambiguity): (1) a tab holding a disk handle -- from the FSA tree, an open, or a previous save-as -- SHALL make the button read "Save" and write back to the original file via `createWritable`, toast "saved to disk", and clear the dirty flag; (2) a tab without a handle in an FSA-capable browser SHALL make the button read "Save" and trigger `showSaveFilePicker` save-as with the content-driven extension, remembering the returned handle; (3) a non-FSA browser SHALL make the same primary button position read "Download" and perform a download. A separate "download copy" menu item SHALL live only inside the export dropdown (auto-format: images -> `.mdpkg`, no images -> `.md`, opened package -> `.mdpkg`). Auto-save to IndexedDB SHALL run silently at all times as draft protection (not counted as saved to disk). Dirty SHALL mean unsaved-to-disk changes. A user cancelling save-as SHALL be a silent cancel returning `{ ok: false, error: 'cancelled' }` with no error toast and the dirty flag kept. Every permission denial, write-back failure, or packaging failure SHALL return `{ ok: false, error }` plus a toast and never throw.

#### Scenario: Write-back to the original file clears dirty
- **WHEN** a tab holding a disk handle is saved
- **THEN** the bytes are written back to the original file via the mocked handle and the dirty flag clears

#### Scenario: No-FSA primary button downloads
- **WHEN** the browser lacks FSA pickers and the user activates the primary button
- **THEN** the primary button reads "Download" and a download occurs

#### Scenario: Save-as cancellation is silent
- **WHEN** the user cancels the save-as picker
- **THEN** the operation returns cancelled with no error toast and the dirty flag remains

### Requirement: Website invite link (InviteView)

**Status:** ADDED in v2

The system SHALL treat the share target as the website, not the document. The share menu SHALL offer "copy invite link", producing a URL with only two parameters -- `?ref=invite&by=<nickname>` -- carrying no document payload (lz-string / size-limited payload decoding is removed). The nickname SHALL be generated from an injectable random-nickname word list (`randomNickname(rng?)`, seeded for tests) at the moment the link is copied and written into the URL as the inviter's signature; there is no server-side storage. The landing page SHALL detect `ref=invite` and render an InviteView: the nickname as the visual hero (large display type with decorative CSS/SVG pattern) presenting "@nickname 邀请你来 MD-Bundle", website selling points, a product screenshot, a prominent "打开 MD-Bundle" CTA that opens the editor preloaded with the demo document, and the website URL `bundle.jianxi.me` displayed prominently. Malformed parameters (missing or illegal `ref` / `by`) SHALL be ignored and render the normal landing page with no error.

#### Scenario: Invite link carries only ref and by
- **WHEN** the user copies an invite link
- **THEN** the URL contains exactly `ref=invite` and `by=<nickname>` with no document bytes

#### Scenario: InviteView renders the signature and CTA
- **WHEN** a visitor opens an invite link
- **THEN** the page shows the invitee nickname as hero, the website URL text, and the CTA opens the editor with the demo document preloaded

#### Scenario: Malformed invite parameters fall back gracefully
- **WHEN** the URL contains missing or illegal `ref` / `by` values
- **THEN** the normal landing page renders without error

### Requirement: Invite share cards (4 compositions)

**Status:** ADDED in v2

The system SHALL generate invite share cards from a website-level data source -- invite copy, a random nickname, and fixed brand/product static assets -- never consuming the current document or the renderer. The share card system SHALL provide four compositionally distinct card types (not same-layout recolors): horizontal work card (product UI thumbnail + "@nickname invites you to MD-Bundle"), vertical quote card (large invite statement such as "分享 Markdown，不再裂图。" + nickname signature), website promo card (logo + slogan + UI shot + a decorative static invite-URL slot printing the full invite link text), and minimal name-card (typography only: @nickname * MD-Bundle * one-line invite). Every type SHALL include the website URL text and the fading Jianxi brand, SHALL offer at least two background palettes per type drawn from the active theme token family, and SHALL pick card type and background through an injectable RNG (`pickTemplate(rng?)`, seeded for tests). Repeated activation SHALL produce a different card, and a "change card" control SHALL cycle types. Cards SHALL be copyable as PNG (ClipboardItem with download fallback), usable with no document open, and themed by the current theme. The module SHALL be split as `inviteShareCards.ts` (invite cards) separate from `docShareCard.ts` (document copy-as-image).

#### Scenario: Four card types are compositionally distinct
- **WHEN** the four invite card templates are rendered
- **THEN** their layout structures differ (not merely colors) and each contains the website URL text and brand mark

#### Scenario: Seeded RNG reproduces a card choice
- **WHEN** a seeded RNG is injected and a card is generated
- **THEN** the chosen type and background palette fall within the defined families and a same seed reproduces the same card

#### Scenario: Invite card works without an open document
- **WHEN** the user generates an invite card with no document open
- **THEN** a valid PNG is still produced from website-level data

### Requirement: Theme tri-state

**Status:** ADDED in v2

The system SHALL offer a tri-state theme -- follow system (default, `prefers-color-scheme`), dark, and light -- with manual overrides persisted in localStorage (`md-bundle.theme`, corrupt values falling back to system). Reader typography SHALL ship dark and light variants, export HTML / PNG / share cards SHALL adopt the active theme, and code colors in dark mode SHALL use the mineral dark palette. Body text contrast SHALL be >= 4.5:1 in both themes.

#### Scenario: System preference is followed and override persists
- **WHEN** the user switches the theme override and reloads
- **THEN** the manual choice persists, and without an override the theme follows the OS preference

#### Scenario: Share-card pixels differ by theme
- **WHEN** a share card is generated in dark mode and in light mode
- **THEN** the sampled primary-color pixels differ between the two PNGs

### Requirement: Mobile responsive

**Status:** ADDED in v2

The system SHALL be fully usable below 768px: the left rail becomes a bottom drawer opened by a small horizontal egg-shaped icon button (slightly asymmetric horizontal ellipse, small and refined); the outline button sits in the same relative top-right position inside the workspace content panel (below the tab strip, not overlapping it); opening a document on a narrow screen defaults to preview mode; the top-bar action area collapses behind a more button with the same right-to-left ordering (theme rightmost, then share, export, primary save/download button, copy-as-image), with downloads available as the "download copy" item inside export and the primary button still reading "Download" in non-FSA environments. No horizontal overflow SHALL occur at 375px.

#### Scenario: No horizontal overflow at 375px
- **WHEN** the app is viewed at 375x812
- **THEN** no horizontal overflow occurs and the drawer, outline button, and overflow menu are reachable

#### Scenario: Narrow screen defaults to preview
- **WHEN** a document is opened on a narrow screen
- **THEN** the workspace opens in preview mode and the outline button does not overlap the tab strip

### Requirement: SEO example pages

**Status:** ADDED in v2

The system SHALL generate one statically crawlable page per featured example document (in addition to the existing landing /spec /about pages) by extending the Vite multi-page build (`rollupOptions.input` gains `examples/*.html`). Each example page SHALL render the example's body as static HTML (KaTeX pre-rendered inline; mermaid content stays out of the static body and is reachable via the "open in editor" CTA), SHALL include a CTA to open the example in the editor, and SHALL be added to the sitemap. Page body content SHALL be readable without JavaScript.

#### Scenario: Example pages are crawlable without JS
- **WHEN** the built output of an example page is inspected
- **THEN** the page body text and CTA are present in the static HTML without requiring JavaScript

#### Scenario: Sitemap includes example pages
- **WHEN** `sitemap.xml` is inspected
- **THEN** it lists the example page URLs alongside the landing, /spec, and /about pages
