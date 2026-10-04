## MODIFIED Requirements

### Requirement: Tables render as a preview-state widget in edit mode

A GFM pipe table block SHALL render in edit mode as a preview-state table (bordered cells, aligned columns) rather than raw pipe source, while the Markdown source remains the single source of truth. The table SHALL NOT collapse into raw Markdown in any interaction — including clicking a cell or editing its content.

#### Scenario: Edit mode shows a rendered table
- **WHEN** a document containing a GFM pipe table is opened in edit mode
- **THEN** the table is displayed as a bordered preview table, not as raw `|` text

#### Scenario: Clicking a cell does not collapse the table
- **WHEN** the user clicks a table cell in edit mode
- **THEN** the table stays rendered as a table and does not become raw pipe source

### Requirement: Clicking a cell edits its source content

Clicking a table cell SHALL place an editable cursor for that cell and allow editing, synchronizing back to the Markdown source cell, while the table stays rendered.

#### Scenario: Edit a cell
- **WHEN** the user clicks a cell and types `A1`
- **THEN** the corresponding source cell becomes `A1`

### Requirement: Hover reveals add-row and add-column affordances

Hovering a boundary line between two cells SHALL reveal a 「＋」 on that inter-cell line (a vertical line between columns, a horizontal line between rows); clicking it SHALL insert a column/row at that position. The hover highlight SHALL be a single boundary line with an 「插入列」/「插入行」 bubble, NOT a full-column or full-row background fill.

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

## ADDED Requirements

### Requirement: An in-cell handle opens the insert menu

Hovering an unselected cell SHALL reveal a block handle on the cell's left edge; hovering that handle SHALL open the insert menu (an icon grid of block types), so a block can be inserted into the cell.

#### Scenario: Hovering the in-cell handle opens the insert menu
- **WHEN** the pointer hovers the in-cell handle
- **THEN** the insert menu opens (the block-type icon grid), not the generic block menu

### Requirement: Table block menu exposes structure toggles

The table block menu SHALL expose a title-row toggle, a title-column toggle, and an equalize-column-widths action.

#### Scenario: Toggle the title row
- **WHEN** the user enables 标题行 in the table block menu
- **THEN** the first row becomes a header row in the source and renders as a header

### Requirement: Inserted tables have a real size and editable cells

An inserted table SHALL have a real size chosen by the size selector (grid of rows × columns), defaulting to 2×3 on direct click, with sensible column widths and editable cells — never `A/B/1/2/3/4` placeholder content.

#### Scenario: Size selector inserts a real table
- **WHEN** the user opens the table size flyout and picks 4×3
- **THEN** a 4-column, 3-row table is inserted with empty editable cells

#### Scenario: Direct click inserts the default size
- **WHEN** the user clicks the table command directly without opening the size flyout
- **THEN** a 2×3 table is inserted