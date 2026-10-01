## ADDED Requirements

### Requirement: Selection toolbar exposes the full inline format set

The text-selection floating toolbar SHALL render its controls from the command registry (data-driven) and SHALL offer 加粗, 斜体, 删除线, 下划线, 行内代码, 链接, and 复制. Clicking a format control SHALL apply it to the selection in a single undoable change, and clicking it again on already-formatted text SHALL remove the formatting (toggle).

#### Scenario: Apply underline to a selection
- **WHEN** the user selects text and clicks 下划线
- **THEN** the underlying source wraps the selection in `<u>…</u>` and the toolbar reflects the active state

#### Scenario: Toggle a format off
- **WHEN** the user selects text already wrapped in `~~…~~` and clicks 删除线
- **THEN** the `~~` delimiters are removed

### Requirement: Inline font family and color use class-based semantic HTML

The toolbar SHALL offer a 字体 control (sans / serif / mono) and a 颜色 control (a preset set), encoding them as `<span class="mdb-font-*">` and `<span class="mdb-color-*">`. The shared renderer's `readerCssText` SHALL ship matching styles for both dark and light themes, and the classes SHALL survive the sanitizer.

#### Scenario: Color a selection
- **WHEN** the user selects text and picks 红色
- **THEN** the source wraps the selection in `<span class="mdb-color-red">…</span>` and the preview renders it with the red class colour

#### Scenario: Class survives sanitization
- **WHEN** a document containing `<span class="mdb-color-blue">x</span>` is rendered
- **THEN** the output retains `class="mdb-color-blue"` (no sanitizer change required)

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
