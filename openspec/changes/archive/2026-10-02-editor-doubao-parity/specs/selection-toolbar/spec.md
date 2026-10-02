## RENAMED Requirements

- FROM: `### Requirement: Inline font family and color use class-based semantic HTML`
- TO: `### Requirement: Inline color uses a popup dual palette and class-based HTML`

## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Toolbar offers whole-paragraph turn-into

The selection toolbar SHALL offer a 转换 (turn-into) control that converts the entire block to a chosen type (paragraph, H1–H6, bullet, ordered, task, quote, code block, callout, table), applying to the whole block when only part of the text is selected and to multi-line blocks.

#### Scenario: Convert a paragraph to a task from the toolbar
- **WHEN** part of a paragraph's text is selected and the user picks 任务 in the 转换 control
- **THEN** the whole paragraph's source becomes a task block `- [ ] …`

#### Scenario: Convert a multi-line block
- **WHEN** the user picks a heading level for a multi-line paragraph
- **THEN** the whole block is converted (not only the first line)
