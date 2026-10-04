# editor-columns Specification

## Purpose
TBD - created by archiving change editor-fidelity. Update Purpose after archive.
## Requirements
### Requirement: Each column exposes its own block handle

Hovering into any single column of a column layout SHALL reveal that column's block handle, so block-level operations apply to the content of that column.

#### Scenario: Handle appears per column
- **WHEN** the pointer hovers the content of the second column
- **THEN** a block handle appears for that column's content

### Requirement: The gutter between columns is draggable to resize

A draggable gutter SHALL exist between adjacent columns: hovering it SHALL highlight a vertical line and show a horizontal resize cursor, and dragging SHALL change the column widths and persist back to the source.

#### Scenario: Drag the gutter to resize
- **WHEN** the user drags the gutter between two columns to the right
- **THEN** the left column widens and the right narrows, and the change is written to the source

#### Scenario: Gutter shows a resize cursor
- **WHEN** the pointer is over the gutter between two columns
- **THEN** the cursor becomes a horizontal resize (col-resize) cursor and the gutter line is highlighted

