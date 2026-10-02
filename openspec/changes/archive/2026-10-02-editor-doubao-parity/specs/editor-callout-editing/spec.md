## ADDED Requirements

### Requirement: Callout is editable from its rendered state

Clicking a rendered callout card SHALL place the caret inside the callout and reveal its `> [!TYPE]` source for editing, so the callout content can be modified with the card and the source staying in sync.

#### Scenario: Click to edit a callout
- **WHEN** the user clicks a rendered callout card
- **THEN** the raw callout source is revealed with the caret inside it and typing updates the source

### Requirement: Callout type is selectable

The callout SHALL expose a type/style selector so the user can pick among the supported callout types (e.g. note, info, tip, success, warning, danger, error, question) when inserting or converting a callout.

#### Scenario: Choose a callout type
- **WHEN** the user inserts a callout and picks the danger type
- **THEN** the source uses the corresponding `> [!DANGER]`-style marker and the preview renders the danger style
