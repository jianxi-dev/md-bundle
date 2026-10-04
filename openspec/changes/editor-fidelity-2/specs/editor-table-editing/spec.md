## MODIFIED Requirements

### Requirement: Table row/column insertion hotspots are hover-gated boundary indicators

Row and column insertion hotspots SHALL appear **only on hover** of a cell, positioned exactly on the cell boundaries (row hotspot on the horizontal line between rows at the left edge; column hotspot on the vertical line between columns at the top edge). Each hotspot SHALL be a 12×12px circle that turns into a brand-blue `+` (`var(--brand)`) with a tooltip bubble ("插入行" / "插入列") and a highlight line along the boundary (horizontal for row, vertical for column).

#### Scenario: Hover cell shows row hotspot at row boundary
- **WHEN** the pointer hovers a table cell
- **THEN** a row hotspot appears at the left end of the horizontal boundary line above the cell; its center Y matches the boundary line Y (±1px)

#### Scenario: Hover cell shows column hotspot at column boundary
- **WHEN** the pointer hovers a table cell
- **THEN** a column hotspot appears at the top end of the vertical boundary line left of the cell; its center X matches the boundary line X (±1px)

#### Scenario: Hotspot shows blue "+" and tooltip on hover
- **WHEN** the pointer hovers the row/column hotspot itself
- **THEN** the hotspot becomes a blue `+` (`var(--brand)`), a tooltip "插入行" / "插入列" appears, and a highlight line runs along the full boundary (horizontal / vertical)

#### Scenario: Non-hover hides hotspots
- **WHEN** the pointer leaves the table area
- **THEN** all row/column hotspots are hidden (`display: none`)

### Requirement: Table boundary layer does not intercept cell clicks

The 6px boundary overlay layer SHALL have `pointer-events: none` over cell interiors. It SHALL only receive pointer events within 8px of a boundary line **and** while the pointer is hovering a cell. Clicking a cell center SHALL place the caret in that cell, not trigger row/column insertion.

#### Scenario: Click cell center places caret, does not insert row
- **WHEN** the user clicks the geometric center of a table cell
- **THEN** the caret appears in that cell; no row/column is inserted; `document.elementFromPoint(centerX, centerY)` returns the cell element

#### Scenario: Click near boundary on hotspot inserts row/column
- **WHEN** the user clicks the blue `+` hotspot on a row/column boundary
- **THEN** a new row/column is inserted at that boundary

### Requirement: Cell handle appears on cell hover and opens insert menu

Each table cell SHALL act as an independent block host. Hovering a cell SHALL reveal a cell handle (`.mdb-table-cell-handle`) on the cell's left border line, showing the cell's block-type icon (empty cell → `AddOutlined`). Hovering this handle SHALL open the **shared insert menu** (per `editor-insert-menu` spec) as a flyout.

#### Scenario: Hover cell shows cell handle on left border
- **WHEN** the pointer hovers a table cell
- **THEN** a handle appears on the cell's left border line; empty cell shows `AddOutlined`; non-empty shows the cell content's block-type icon

#### Scenario: Hover cell handle opens insert menu
- **WHEN** the pointer hovers the cell handle
- **THEN** the insert menu (categorized list) opens as a flyout; selecting an item replaces the cell content

### Requirement: Table block menu includes header row/column toggles and distribute columns

The table block menu SHALL include three table-specific items: `标题行` (toggle switch, `HeaderRowOutlined`), `标题列` (toggle switch, `HeaderColumnOutlined`), `均分列宽` (action, `DistributeColumnsOutlined`).

#### Scenario: Table block menu shows three toggles
- **WHEN** the block menu opens on a table block
- **THEN** the panel items include `标题行` (switch), `标题列` (switch), `均分列宽` with correct icons

#### Scenario: Header row toggle adds/removes <thead>
- **WHEN** the user toggles `标题行` on
- **THEN** the first row becomes a header row (rendered in `<thead>`, bold); toggling off restores normal row

#### Scenario: Distribute columns equalizes widths
- **WHEN** the user clicks `均分列宽`
- **THEN** all columns receive equal width (source markdown updated with equal col widths)

## ADDED Requirements

### Requirement: Table renders with real dimensions (no toy placeholder)

Inserted tables SHALL have real dimensions matching the selected size (default 2×3), not placeholder content like `A/B/1/2/3/4`.

#### Scenario: Inserted table has correct rows and columns
- **WHEN** the user inserts a 5×3 table via the size grid
- **THEN** the rendered table has 5 columns and 3 rows with empty cells