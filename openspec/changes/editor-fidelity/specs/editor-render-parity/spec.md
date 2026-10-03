## ADDED Requirements

### Requirement: Edit mode renders each block through the shared renderer

The editor SHALL render each non-active block in edit mode by invoking the shared renderer on that block's Markdown source, producing the same HTML as preview/export, instead of an approximating editor decoration.

#### Scenario: A heading block renders identically to preview
- **WHEN** a document containing `## 标题` is shown in edit mode and the same source is rendered in preview
- **THEN** the heading block's computed styles in edit mode equal those in preview

#### Scenario: A table block never falls back to raw source
- **WHEN** the caret is placed inside a table in edit mode
- **THEN** the table remains rendered through the shared renderer and does not collapse to raw pipe source

### Requirement: Edit mode and preview share one style source

The edit-mode content area SHALL apply the same style scope as preview, so a given block's computed style is identical in both modes (no second, divergent stylesheet).

#### Scenario: Table styles match across modes
- **WHEN** a table block is shown in edit mode and in preview
- **THEN** its computed border and cell styles are equal in both modes

#### Scenario: Callout styles match across modes
- **WHEN** a callout block is shown in edit mode and in preview
- **THEN** its computed background and header styles are equal in both modes

### Requirement: The active block reveals source while others stay rendered

The block containing the caret SHALL reveal its raw Markdown source for editing (the live-source bridge), and when the caret leaves that block it SHALL return to the rendered presentation, preserving live-source editability.

#### Scenario: Leaving a block returns it to rendered form
- **WHEN** the caret leaves a block that was showing raw source
- **THEN** that block renders again through the shared renderer and no longer shows its raw markers

### Requirement: Block rendering is incremental and cached

Only blocks whose source changed SHALL re-render; unchanged blocks SHALL reuse cached output. Math and diagram features SHALL hydrate lazily rather than on every keystroke.

#### Scenario: Unchanged blocks are not re-rendered
- **WHEN** the user edits one block in a multi-block document
- **THEN** blocks whose source did not change reuse their previously rendered output
