## ADDED Requirements

### Requirement: Font color is chosen from a row of colored "A" swatches

The color panel SHALL present font colors as colored letter "A" swatches (the letter tinted with its own color) and background colors as color swatches, so a color is identifiable without reading a text label.

#### Scenario: Font color swatches are colored letters
- **WHEN** the user opens the color panel from the selection toolbar
- **THEN** the font-color options are rendered as letter "A" glyphs each tinted with its own color (not text labels)

#### Scenario: Background colors are swatches
- **WHEN** the user opens the color panel from the selection toolbar
- **THEN** the background-color options are rendered as solid color swatches

### Requirement: Cell selection exposes merge and cell-background actions

When a table cell selection is active, the selection toolbar SHALL expose a merge-cells action (enabled when more than one cell is selected) and a cell-background-color action.

#### Scenario: Merge is enabled for a multi-cell selection
- **WHEN** the user selects more than one table cell
- **THEN** the merge-cells action is enabled

#### Scenario: Merge is disabled for a single cell
- **WHEN** the user selects a single table cell
- **THEN** the merge-cells action is disabled

#### Scenario: Apply a cell background color
- **WHEN** the user selects a cell and picks a background color
- **THEN** the cell renders with that background color
