# editor-table-editing Specification

## Purpose
TBD - created by archiving change editor-doubao-parity. Update Purpose after archive.
## Requirements
### Requirement: Tables render as a preview-state widget in edit mode

A GFM pipe table block SHALL render in edit mode as a preview-state table (bordered cells, aligned columns) rather than raw pipe source, while the Markdown source remains the single source of truth.

#### Scenario: Edit mode shows a rendered table
- **WHEN** a document containing a GFM pipe table is opened in edit mode
- **THEN** the table is displayed as a bordered preview table, not as raw `|` text

### Requirement: Clicking a cell edits its source content

Clicking a table cell SHALL place an editable cursor for that cell and allow editing, synchronizing back to the Markdown source cell.

#### Scenario: Edit a cell
- **WHEN** the user clicks a cell and types `A1`
- **THEN** the corresponding source cell becomes `A1`

### Requirement: Hover reveals add-row and add-column affordances

Hovering the table SHALL reveal a 「＋」 hotzone above each column and to the left of each row; clicking SHALL insert a column/row at that position.

#### Scenario: Add a column
- **WHEN** the user hovers the hotzone above a column and clicks 「＋」
- **THEN** a new column is inserted at that position and the source is updated

#### Scenario: Add a row
- **WHEN** the user hovers the hotzone left of a row and clicks 「＋」
- **THEN** a new row is inserted at that position and the source is updated

### Requirement: Cells allow inserting blocks

A table cell SHALL allow invoking the insert menu to insert block content into that cell.

#### Scenario: Insert a block inside a cell
- **WHEN** the cursor is in a table cell and the user triggers the insert menu and picks a block type
- **THEN** that block content is inserted into the cell in the source

