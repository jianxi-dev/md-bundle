# editor-columns Specification

## Purpose
TBD - created by archiving change editor-doubao-parity. Update Purpose after archive.
## Requirements
### Requirement: Columns support one to five columns

The editor SHALL support block column layouts from 1 to 5 columns, encoded as Pandoc fenced divs `::: {.col-N}` with N in 1–5; the renderer SHALL map them to `layout-col-*` wrappers and `readerCssText` SHALL provide grid styles for 2–5 columns.

#### Scenario: Five-column layout renders
- **WHEN** a block is wrapped in `::: {.col-5}` … `:::` and previewed
- **THEN** the preview lays the content out in five columns

### Requirement: Column count is chosen visually

The toolbar SHALL present a visual column-count selector (bars/glyphs) for 1–5 columns instead of text options.

#### Scenario: Pick columns visually
- **WHEN** the user opens the 分栏 control and picks the 3-bar option
- **THEN** the block is wrapped in `::: {.col-3}` … `:::`

