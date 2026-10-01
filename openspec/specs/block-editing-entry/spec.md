# block-editing-entry Specification

## Purpose
TBD - created by archiving change editor-block-entry. Update Purpose after archive.
## Requirements
### Requirement: Slash menu is grouped

The slash (`/`) menu SHALL render its commands in labelled groups (基础 / 常用 / 小组件) instead of a single flat list.

#### Scenario: Grouped menu is shown
- **WHEN** the user types `/` on an empty line in edit mode
- **THEN** the menu shows group headings and each command under its group

### Requirement: Slash menu offers a heading-level submenu

The slash menu SHALL expose a 「标题」 entry that opens a second-level panel listing H1–H6; selecting a level SHALL insert that heading in a single undoable change.

#### Scenario: Insert H2 from the submenu
- **WHEN** the user types `/`, selects 「标题」, then picks H2
- **THEN** the current line becomes an H2 heading in the underlying Markdown source

### Requirement: Slash menu offers a table grid selector

The slash menu SHALL expose a 「表格」 second-level panel with a hover grid showing `N × M`; clicking SHALL insert a GFM pipe table with N columns and M rows (header + separator + rows).

#### Scenario: Insert a 7×3 table
- **WHEN** the user opens `/` → 「表格」 and clicks the 7×3 grid cell
- **THEN** a GFM pipe table with 7 columns and 3 body rows is inserted into the source

### Requirement: Slash menu stays inside the viewport

The slash menu SHALL clamp its right and bottom edges to the viewport and scroll internally when its content exceeds the available height.

#### Scenario: Menu near the bottom-right corner does not overflow
- **WHEN** the user opens the `/` menu with the cursor near the bottom-right of the window
- **THEN** the menu's right and bottom edges stay within the viewport

### Requirement: Block handle menu moves a block up or down

The block handle menu SHALL offer 「上移」 and 「下移」 actions that swap the current block with its previous/next sibling in a single minimal-change transaction.

#### Scenario: Move a block down
- **WHEN** the user opens the block handle menu on a block and selects 「下移」
- **THEN** that block swaps position with the block below it and the viewport does not jump

### Requirement: Heading level is controllable and demotable

A heading block SHALL be switchable between H1–H6 from the block handle menu, and pressing Backspace at the start of a heading line SHALL demote it one level (H1 becomes a paragraph).

#### Scenario: Switch a heading via the block handle menu
- **WHEN** the cursor is on a heading and the user picks H3 from the block handle menu
- **THEN** the line becomes an H3 heading

#### Scenario: Backspace demotes a heading
- **WHEN** the cursor is at the start of an H2 line and the user presses Backspace
- **THEN** the line becomes an H1 heading; pressing Backspace again on an H1 makes it a paragraph

### Requirement: Heading markers are editable in the active block

When the cursor is inside a heading block, the `# ` marker SHALL NOT be replaced by a non-editable widget, so the heading can be edited/demoted from the source.

#### Scenario: Heading source is reachable
- **WHEN** the cursor enters a heading line
- **THEN** the raw `# ` marker is reachable and Backspace can change the level

