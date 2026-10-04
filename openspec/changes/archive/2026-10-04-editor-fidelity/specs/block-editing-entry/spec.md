## MODIFIED Requirements

### Requirement: Block handle stays visible while the pointer is on the block or handle

The block handle SHALL appear when the pointer hovers the block's line (pointer-driven, no click required to summon it) and SHALL remain visible while the pointer is anywhere on the hovered block's line, on the handle itself, or on the block menu, and SHALL NOT disappear when the pointer crosses the gap toward the handle. It SHALL reappear after scrolling without requiring the pointer to leave and re-enter the editor.

#### Scenario: Handle appears on hover
- **WHEN** the pointer moves onto a block's line without clicking
- **THEN** the block handle appears in the gutter

#### Scenario: Handle survives moving toward it
- **WHEN** the pointer moves from the block's text toward the handle
- **THEN** the handle stays visible until the pointer leaves the block/handle/menu region

#### Scenario: Handle survives scrolling
- **WHEN** the user scrolls while a block is hovered
- **THEN** the handle returns to the current hovered block without an extra mouse move

## ADDED Requirements

### Requirement: The block menu opens on hover over the handle

Hovering over the block handle SHALL automatically open the block menu without a click, and the block SHALL display a selected state while its menu is open.

#### Scenario: Hovering the handle opens the menu
- **WHEN** the pointer moves onto the block handle
- **THEN** the block menu opens and the block shows its selected state, with no click required

#### Scenario: Moving from handle to menu keeps it open
- **WHEN** the pointer moves from the handle into the open menu
- **THEN** the menu stays open

### Requirement: The block menu is contextual and exposes secondary submenus

The block menu SHALL vary its actions by block type, and multi-option actions (such as indent/alignment and color) SHALL open a secondary submenu labeled with a chevron rather than a flat list.

#### Scenario: Multi-option action opens a submenu
- **WHEN** the user opens the block menu and points at the alignment action
- **THEN** a secondary submenu with the alignment/indent choices opens next to it

#### Scenario: Callout block menu exposes a type submenu
- **WHEN** the user opens the block menu on a callout block
- **THEN** the menu includes a type/color submenu rather than only generic actions
