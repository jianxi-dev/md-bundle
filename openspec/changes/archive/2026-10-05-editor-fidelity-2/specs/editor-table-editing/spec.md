## MODIFIED Requirements

### Requirement: Hover reveals add-row and add-column affordances

Row and column insertion hotspots SHALL appear only on hover of a cell, positioned exactly on the cell boundaries (row hotspot on the horizontal line between rows at the left edge; column hotspot on the vertical line between columns at the top edge). Each hotspot SHALL be a 12×12px circle that turns into a brand-blue `+` (`var(--brand)`) with a tooltip bubble ("插入行" / "插入列") and a highlight line along the boundary (horizontal for row, vertical for column). The hover highlight SHALL be a single boundary line, NOT a full-column or full-row background fill.

#### Scenario: Add a column at an inter-cell line
- **WHEN** the user hovers the vertical boundary line between two columns and clicks 「＋」
- **THEN** a new column is inserted at that position and the source is updated

#### Scenario: Add a row at an inter-cell line
- **WHEN** the user hovers the horizontal boundary line between two rows and clicks 「＋」
- **THEN** a new row is inserted at that position and the source is updated

#### Scenario: Hover highlights a boundary line, not a whole track
- **WHEN** the user hovers an inter-cell boundary line
- **THEN** a single boundary line is highlighted (with an insert bubble) rather than the entire column or row being filled

#### Scenario: Add a column
- **WHEN** the user hovers the hotzone above a column and clicks 「＋」
- **THEN** a new column is inserted at that position and the source is updated

#### Scenario: Add a row
- **WHEN** the user hovers the hotzone left of a row and clicks 「＋」
- **THEN** a new row is inserted at that position and the source is updated

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

### Requirement: Clicking a cell edits its source content

Clicking a table cell SHALL place an editable cursor for that cell and allow editing, synchronizing back to the Markdown source cell, while the table stays rendered. The 6px boundary overlay layer SHALL have `pointer-events: none` over cell interiors; it SHALL only receive pointer events within 8px of a boundary line and while the pointer is hovering a cell, so clicking a cell center places the caret rather than triggering row/column insertion.

#### Scenario: Edit a cell
- **WHEN** the user clicks a cell and types `A1`
- **THEN** the corresponding source cell becomes `A1`

#### Scenario: Click cell center places caret, does not insert row
- **WHEN** the user clicks the geometric center of a table cell
- **THEN** the caret appears in that cell; no row/column is inserted; `document.elementFromPoint(centerX, centerY)` returns the cell element

#### Scenario: Click near boundary on hotspot inserts row/column
- **WHEN** the user clicks the blue `+` hotspot on a row/column boundary
- **THEN** a new row/column is inserted at that boundary

### Requirement: An in-cell handle opens the insert menu

Each table cell SHALL act as an independent block host. Hovering a cell SHALL reveal a cell handle (`.mdb-table-cell-handle`) on the cell's left border line, showing the cell's block-type icon (empty cell → `AddOutlined`). Hovering this handle SHALL open the **shared insert menu** (per `editor-insert-menu` spec) as a flyout, so a block can be inserted into the cell.

#### Scenario: Hovering the in-cell handle opens the insert menu
- **WHEN** the pointer hovers the in-cell handle
- **THEN** the insert menu opens (the categorized list), not the generic block menu

#### Scenario: Hover cell shows cell handle on left border
- **WHEN** the pointer hovers a table cell
- **THEN** a handle appears on the cell's left border line; empty cell shows `AddOutlined`; non-empty shows the cell content's block-type icon

### Requirement: Table block menu exposes structure toggles

The table block menu SHALL expose three table-specific items: `标题行` (toggle switch, `HeaderRowOutlined`), `标题列` (toggle switch, `HeaderColumnOutlined`), and `均分列宽` (action, `DistributeColumnsOutlined`).

#### Scenario: Toggle the title row
- **WHEN** the user enables 标题行 in the table block menu
- **THEN** the first row becomes a header row in the source and renders as a header

#### Scenario: Table block menu shows three toggles
- **WHEN** the block menu opens on a table block
- **THEN** the panel items include `标题行` (switch), `标题列` (switch), `均分列宽` with correct icons

#### Scenario: Header row toggle adds/removes <thead>
- **WHEN** the user toggles `标题行` on
- **THEN** the first row becomes a header row (rendered in `<thead>`, bold); toggling off restores normal row

#### Scenario: Distribute columns equalizes widths
- **WHEN** the user clicks `均分列宽`
- **THEN** all columns receive equal width (source markdown updated with equal col widths)

### Requirement: Inserted tables have a real size and editable cells

An inserted table SHALL have a real size chosen by the size selector (grid of rows × columns), defaulting to 2×3 on direct click, with sensible column widths and editable cells — never `A/B/1/2/3/4` placeholder content.

#### Scenario: Size selector inserts a real table
- **WHEN** the user opens the table size flyout and picks 4×3
- **THEN** a 4-column, 3-row table is inserted with empty editable cells

#### Scenario: Direct click inserts the default size
- **WHEN** the user clicks the table command directly without opening the size flyout
- **THEN** a 2×3 table is inserted

#### Scenario: Inserted table has correct rows and columns
- **WHEN** the user inserts a 5×3 table via the size grid
- **THEN** the rendered table has 5 columns and 3 rows with empty cells
