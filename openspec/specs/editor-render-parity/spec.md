# editor-render-parity Specification

## Purpose
TBD - created by archiving change editor-fidelity. Update Purpose after archive.
## Requirements
### Requirement: Edit mode and preview share one style source

The edit-mode content area SHALL apply the same reader style scope and container box (inline padding, centered measure) as preview, so a given block's computed styles are equal in edit mode and preview — without replacing the editor's block DOM.

#### Scenario: Heading styles match across modes
- **WHEN** a document containing `## 标题` is shown in edit mode and the same source in preview
- **THEN** the heading's computed font-size, font-weight, color, line-height, margin and width are equal in both modes

#### Scenario: Code block styles match across modes
- **WHEN** a fenced code block is shown in edit mode and in preview
- **THEN** its computed font-family, font-size, background-color, border-radius and width are equal in both modes

#### Scenario: List and quote styles match across modes
- **WHEN** a list and a blockquote are shown in edit mode and in preview
- **THEN** their computed list/indent and border/padding styles are equal in both modes

#### Scenario: Table and callout styles match across modes
- **WHEN** a table and a callout are shown in edit mode and in preview
- **THEN** their computed box and typography styles are equal in both modes while their interactive widgets remain available

### Requirement: The active block reveals source while others stay rendered

The block containing the caret SHALL reveal its raw Markdown source for editing, and when the caret leaves that block it SHALL return to the rendered presentation.

#### Scenario: Leaving a block returns it to rendered form
- **WHEN** the caret leaves a block that was showing raw source
- **THEN** the block renders again and no raw marker text remains

### Requirement: Existing decoration DOM contracts are preserved

The parity change SHALL NOT replace editor block DOM wholesale; the existing decoration classes and line structure that block handling, the selection toolbar, and structure tooling depend on SHALL remain present, so block-level operations continue to work on non-active blocks.

#### Scenario: Block handle still works on a non-active block
- **WHEN** the user hovers a non-active block
- **THEN** the block handle appears and the block menu opens and works as before

#### Scenario: Selection toolbar still opens and its controls work
- **WHEN** the user selects text in a non-active block
- **THEN** the floating toolbar opens and its controls (including the column picker) work as before

