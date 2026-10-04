## MODIFIED Requirements

### Requirement: Floating toolbar font color uses colored "A" swatches (8: default + 7 colors, prototype machine value)

The floating toolbar's font color button SHALL open a submenu showing a single row of 8 swatches: the first swatch is "default" (transparent with diagonal slash), followed by 7 colored "A" letters (15px, 600 weight) in the exact prototype colors. Each swatch is 18px wide.

#### Scenario: Font color submenu shows 8 "A" swatches with correct colors
- **WHEN** the user opens the font color submenu from the floating toolbar
- **THEN** the submenu shows 8 swatches in a row: default (slash) + `A` in `#ebebeb` `#f0000e` `#f2962c` `#f0b622` `#419e34` `#20b2aa` `#4c88ff` `#8a5cf6`

#### Scenario: Selecting an "A" applies that text color
- **WHEN** the font color submenu is open and the user clicks the red `A` (`#f0000e`)
- **THEN** the selected text receives `color: #f0000e`

### Requirement: Floating toolbar background color uses 16 color blocks (first = none/slash)

The floating toolbar's background color button SHALL open a submenu showing two rows of 8 blocks (16 total). The first block is "none" (transparent with diagonal slash). The remaining 15 blocks use the exact prototype background colors.

#### Scenario: Background color submenu shows 16 blocks with correct colors
- **WHEN** the user opens the background color submenu from the floating toolbar
- **THEN** the submenu shows 16 blocks: block 0 = slash (none); blocks 1–15 = `#f0000e` `#f2962c` `#f0b622` `#419e34` `#20b2aa` `#4c88ff` `#8a5cf6` `#ebebeb` `#b34444` `#845117` `#877b10` `#296b22` `#203e78` `#4d2691` `#5f5f5f`

#### Scenario: Selecting a block applies that background color
- **WHEN** the background color submenu is open and the user clicks block 3 (`#f0b622`)
- **THEN** the selected cells/text receive `background-color: #f0b622`

### Requirement: Both submenus have a full-width "恢复默认" button (height 30px)

Both the font color and background color submenus SHALL include a full-width "恢复默认" button at the bottom, height 30px, which clears the respective color style.

#### Scenario: "恢复默认" clears font color
- **WHEN** the font color submenu is open and the user clicks "恢复默认"
- **THEN** the selected text's `color` style is removed

#### Scenario: "恢复默认" clears background color
- **WHEN** the background color submenu is open and the user clicks "恢复默认"
- **THEN** the selected cells/text's `background-color` style is removed

### Requirement: Block menu "颜色›" flyout shares the same color submenu component

The block menu's `颜色›` flyout SHALL render the **exact same** font-color + background-color + "恢复默认" submenu as the floating toolbar (shared component, same colors, same layout).

#### Scenario: Block menu color flyout matches toolbar
- **WHEN** the user hovers `颜色›` in the block menu (on a paragraph block)
- **THEN** the flyout shows the same 8 "A" swatches（默认 + 7 色，原型机读值）, 16 bg blocks, and "恢复默认" as the floating toolbar

## ADDED Requirements

### Requirement: Table cell selection toolbar includes merge cells and cell background

When multiple table cells are selected, the floating toolbar SHALL show `合并单元格` (enabled only when >1 cell selected, icon `MergecellsOutlined`) and `单元格背景颜色›` (opens the same 16-block background color submenu + "恢复默认").

#### Scenario: Multi-cell selection shows merge cells
- **WHEN** the user drag-selects 2+ table cells
- **THEN** the floating toolbar shows `合并单元格` enabled and `单元格背景颜色›`

#### Scenario: Single-cell selection disables merge cells
- **WHEN** the user selects exactly 1 table cell
- **THEN** the floating toolbar shows `合并单元格` disabled (`menu-item-disabled`)

#### Scenario: Cell background submenu uses same 16 colors
- **WHEN** the user opens `单元格背景颜色›`
- **THEN** the submenu shows the same 16 blocks + "恢复默认" as the main background color submenu