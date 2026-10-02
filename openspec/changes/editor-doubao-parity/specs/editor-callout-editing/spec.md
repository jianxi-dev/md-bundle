## ADDED Requirements

### Requirement: Callout is edited in its rendered state

A callout block SHALL be editable directly in its rendered card state, without switching the whole block to raw `> [!TYPE]` source. The rendered card and the underlying source SHALL stay in sync.

#### Scenario: Edit callout content in place
- **WHEN** the user clicks into a callout's rendered content and types
- **THEN** the text is edited in place and the underlying `> …` source updates, without the block collapsing to raw source

### Requirement: Cursor after the last character does not swallow input

When the cursor is positioned immediately after the last character of a callout block (including end-of-document), typing SHALL insert into the callout rather than being swallowed by a preview widget.

#### Scenario: Type at end of callout
- **WHEN** the cursor is after the last character of a callout's last line and the user types `x`
- **THEN** `x` is appended to the callout source

### Requirement: Callout type is selectable

The callout SHALL expose a type/style selector so the user can pick among the supported callout types (e.g. note, info, tip, success, warning, danger, error, question) when inserting or converting a callout.

#### Scenario: Choose a callout type
- **WHEN** the user inserts a callout and picks the danger type
- **THEN** the source uses the corresponding `> [!DANGER]`-style marker and the preview renders the danger style
