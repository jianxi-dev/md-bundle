## MODIFIED Requirements

### Requirement: Inline color uses a popup dual palette and class-based HTML

The toolbar SHALL offer a 颜色 control that opens a popup dual palette (font color + background color) with a 恢复默认 action, encoding choices as `<span class="mdb-color-*">` and `<span class="mdb-bg-*">`. The shared renderer's `readerCssText` SHALL ship matching styles for both dark and light themes, and the classes SHALL survive the sanitizer. The font color row SHALL show 8 swatches (default + 7 colors). The background color row SHALL show 16 blocks (first = none/slash). The previous 字体 (font-family) control SHALL be removed from the toolbar; existing `mdb-font-*` styles remain for backward compatibility.

#### Scenario: Pick a background color
- **WHEN** the user selects text and picks a background color
- **THEN** the source wraps the selection in `<span class="mdb-bg-*">…</span>` and the preview renders it with that background

#### Scenario: Reset colors
- **WHEN** the user picks 恢复默认 in the color popup
- **THEN** any `mdb-color-*` / `mdb-bg-*` wrappers on the selection are removed

#### Scenario: Font control is gone
- **WHEN** the user selects text and inspects the toolbar
- **THEN** there is no 字体 control; the freed slot is occupied by 转换

#### Scenario: Color a selection
- **WHEN** the user selects text and picks 红色
- **THEN** the source wraps the selection in `<span class="mdb-color-red">…</span>` and the preview renders it with the red class colour

#### Scenario: Class survives sanitization
- **WHEN** a document containing `<span class="mdb-color-blue">x</span>` is rendered
- **THEN** the output retains `class="mdb-color-blue"` (no sanitizer change required)

#### Scenario: Background color submenu shows 16 blocks with correct colors
- **WHEN** the user opens the background color submenu
- **THEN** the submenu shows 16 blocks: block 0 = slash (none); blocks 1–15 = `#f0000e` `#f2962c` `#f0b622` `#419e34` `#20b2aa` `#4c88ff` `#8a5cf6` `#ebebeb` `#b34444` `#845117` `#877b10` `#296b22` `#203e78` `#4d2691` `#5f5f5f`

#### Scenario: Selecting a block applies that background color
- **WHEN** the background color submenu is open and the user clicks block 3 (`#f0b622`)
- **THEN** the selected cells/text receive `background-color: #f0b622`

### Requirement: Font color is chosen from a row of colored "A" swatches

The color panel SHALL present font colors as colored letter "A" swatches (the letter tinted with its own color) and background colors as color swatches, so a color is identifiable without reading a text label. The font color submenu SHALL show a single row of 8 swatches: the first swatch is "default" (transparent with diagonal slash), followed by 7 colored "A" letters (15px, 600 weight) in the exact prototype colors, each 18px wide.

#### Scenario: Font color swatches are colored letters
- **WHEN** the user opens the color panel from the selection toolbar
- **THEN** the font-color options are rendered as letter "A" glyphs each tinted with its own color (not text labels)

#### Scenario: Background colors are swatches
- **WHEN** the user opens the color panel from the selection toolbar
- **THEN** the background-color options are rendered as solid color swatches

#### Scenario: Font color submenu shows 8 "A" swatches with correct colors
- **WHEN** the user opens the font color submenu from the floating toolbar
- **THEN** the submenu shows 8 swatches in a row: default (slash) + `A` in `#ebebeb` `#f0000e` `#f2962c` `#f0b622` `#419e34` `#20b2aa` `#4c88ff` `#8a5cf6`

#### Scenario: Selecting an "A" applies that text color
- **WHEN** the font color submenu is open and the user clicks the red `A` (`#f0000e`)
- **THEN** the selected text receives `color: #f0000e`

### Requirement: Cell selection exposes merge and cell-background actions

When a table cell selection is active, the selection toolbar SHALL expose a merge-cells action (enabled when more than one cell is selected, icon `MergecellsOutlined`), disabled for a single cell, and a cell-background-color action that opens the same 16-block background color submenu plus "恢复默认".

#### Scenario: Merge is enabled for a multi-cell selection
- **WHEN** the user selects more than one table cell
- **THEN** the merge-cells action is enabled

#### Scenario: Merge is disabled for a single cell
- **WHEN** the user selects a single table cell
- **THEN** the merge-cells action is disabled

#### Scenario: Apply a cell background color
- **WHEN** the user selects a cell and picks a background color
- **THEN** the cell renders with that background color

#### Scenario: Multi-cell selection shows merge cells
- **WHEN** the user drag-selects 2+ table cells
- **THEN** the floating toolbar shows `合并单元格` enabled and `单元格背景颜色›`

#### Scenario: Single-cell selection disables merge cells
- **WHEN** the user selects exactly 1 table cell
- **THEN** the floating toolbar shows `合并单元格` disabled (`menu-item-disabled`)

#### Scenario: Cell background submenu uses same 16 colors
- **WHEN** the user opens `单元格背景颜色›`
- **THEN** the submenu shows the same 16 blocks + "恢复默认" as the main background color submenu

## ADDED Requirements

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
