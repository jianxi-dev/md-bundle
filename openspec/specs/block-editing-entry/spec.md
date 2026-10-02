# block-editing-entry Specification

## Purpose
TBD - created by archiving change editor-block-entry. Update Purpose after archive.
## Requirements
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

### Requirement: Block handle stays visible while the pointer is on the block or handle

The block handle SHALL remain visible while the pointer is anywhere on the hovered block's line, on the handle itself, or on the handle menu, and SHALL NOT disappear when the pointer crosses the gap toward the handle. It SHALL reappear after scrolling without requiring the pointer to leave and re-enter the editor.

#### Scenario: Handle survives moving toward it
- **WHEN** the pointer moves from the block's text toward the handle
- **THEN** the handle stays visible until the pointer leaves the block/handle/menu region

#### Scenario: Handle survives scrolling
- **WHEN** the user scrolls while a block is hovered
- **THEN** the handle returns to the current hovered block without an extra mouse move

### Requirement: Block handle hit area is enlarged and bridged

The block handle SHALL have an enlarged interactive hit area with an invisible bridge between the text and the handle, so moving toward it does not lose the handle.

#### Scenario: Enlarged hit area
- **WHEN** the pointer is near but not exactly on the handle glyph
- **THEN** the handle is still treated as hovered

### Requirement: Block handle shows the block type icon

The block handle SHALL display an icon reflecting the current block's type and heading level (e.g. H1/H2, task checkbox, quote, code), not a single generic glyph.

#### Scenario: Heading icon on the handle
- **WHEN** the pointer is on an H2 block
- **THEN** the handle shows an H2-level icon

### Requirement: Empty lines expose an insert affordance

An empty line/blank area SHALL show a 「＋」 affordance in the gutter on hover; clicking it SHALL open the insert menu.

#### Scenario: Empty line shows plus
- **WHEN** the pointer is over an empty line
- **THEN** a 「＋」 appears in the gutter and clicking it opens the insert menu

### Requirement: Block handle menu and toolbar controls are iconified

The block handle menu SHALL render each entry with an icon and label.

#### Scenario: Menu shows icons
- **WHEN** the user opens the block handle menu
- **THEN** each entry shows an icon alongside its label

