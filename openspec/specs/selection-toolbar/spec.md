# selection-toolbar Specification

## Purpose
TBD - created by archiving change selection-toolbar. Update Purpose after archive.
## Requirements
### Requirement: Selection toolbar exposes the full inline format set

The text-selection floating toolbar SHALL render its controls from the command registry (data-driven) and SHALL offer 加粗, 斜体, 删除线, 下划线, 行内代码, 链接, and 复制. Clicking a format control SHALL apply it to the selection in a single undoable change, and clicking it again on already-formatted text SHALL remove the formatting (toggle).

#### Scenario: Apply underline to a selection
- **WHEN** the user selects text and clicks 下划线
- **THEN** the underlying source wraps the selection in `<u>…</u>` and the toolbar reflects the active state

#### Scenario: Toggle a format off
- **WHEN** the user selects text already wrapped in `~~…~~` and clicks 删除线
- **THEN** the `~~` delimiters are removed

### Requirement: Block alignment uses a fenced div

The toolbar SHALL offer a 对齐 control (左 / 中 / 右) that wraps the current block in a Pandoc fenced div `::: {.align-left|center|right}`. The renderer SHALL map these to `layout-align-*` and `readerCssText` SHALL provide the alignment styles.

#### Scenario: Center a paragraph
- **WHEN** the cursor is in a paragraph and the user picks 居中
- **THEN** the block is wrapped in `::: {.align-center}` … `:::` and the preview renders it centred

### Requirement: Columns use a fenced div and render with layout styles

The toolbar SHALL offer a 分栏 control (2 / 3 columns) that inserts `::: {.col-2}` / `::: {.col-3}`. `readerCssText` SHALL provide layout styles for `.layout-col-2`, `.layout-col-3`, and `.layout-card-grid[data-columns]` (currently absent).

#### Scenario: Two-column layout renders
- **WHEN** a block is wrapped in `::: {.col-2}` … `:::` and previewed
- **THEN** the preview lays the content out in two columns

### Requirement: Editing model stays live Markdown source

Style controls SHALL encode only into HTML passthrough or Pandoc fenced divs — never a private Markdown syntax — and the document source SHALL remain editable, with the active block revealing the raw tags.

#### Scenario: Raw tags are reachable in the active block
- **WHEN** the cursor enters a region styled via the toolbar
- **THEN** the raw `<span class="mdb-*">…</span>` or `::: {.align-center}` … `:::` source is visible and editable

### Requirement: Inline color uses a popup dual palette and class-based HTML

The toolbar SHALL offer a 颜色 control that opens a popup dual palette (font color + background color) with a 恢复默认 action, encoding choices as `<span class="mdb-color-*">` and `<span class="mdb-bg-*">`. The shared renderer's `readerCssText` SHALL ship matching styles for both dark and light themes, and the classes SHALL survive the sanitizer. The previous 字体 (font-family) control SHALL be removed from the toolbar; existing `mdb-font-*` styles remain for backward compatibility.

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

### Requirement: Toolbar offers whole-paragraph turn-into

The selection toolbar SHALL offer a 转换 (turn-into) control that converts the entire block to a chosen type (paragraph, H1–H6, bullet, ordered, task, quote, code block, callout, table), applying to the whole block when only part of the text is selected and to multi-line blocks.

#### Scenario: Convert a paragraph to a task from the toolbar
- **WHEN** part of a paragraph's text is selected and the user picks 任务 in the 转换 control
- **THEN** the whole paragraph's source becomes a task block `- [ ] …`

#### Scenario: Convert a multi-line block
- **WHEN** the user picks a heading level for a multi-line paragraph
- **THEN** the whole block is converted (not only the first line)

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

