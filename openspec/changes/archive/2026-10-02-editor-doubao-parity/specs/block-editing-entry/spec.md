## ADDED Requirements

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

## REMOVED Requirements

### Requirement: Slash menu is grouped
**Reason**: The slash/insert menu behavior is redefined by the `editor-insert-menu` capability (icon grid, filtering, codes, triggers).
**Migration**: See `editor-insert-menu` requirements.

### Requirement: Slash menu offers a heading-level submenu
**Reason**: Heading-level selection is redefined as a flyout with codes in `editor-insert-menu`.
**Migration**: See `editor-insert-menu` requirements.

### Requirement: Slash menu offers a table grid selector
**Reason**: Table insertion is superseded by the `/t<cols><rows>` code and the flyout in `editor-insert-menu`.
**Migration**: See `editor-insert-menu` requirements.

### Requirement: Slash menu stays inside the viewport
**Reason**: Viewport clamping is retained as part of `editor-insert-menu`.
**Migration**: See `editor-insert-menu` requirements.
