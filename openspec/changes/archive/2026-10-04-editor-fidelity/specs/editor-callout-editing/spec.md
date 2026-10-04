## MODIFIED Requirements

### Requirement: Callout is editable from its rendered state

A rendered callout card SHALL be editable inline: the caret is placed inside the card and typing updates the callout source, without ever switching the whole block to raw `> [!TYPE]` source. The card form is preserved while editing.

#### Scenario: Click to edit a callout
- **WHEN** the user clicks a rendered callout card
- **THEN** the raw callout source is revealed with the caret inside it and typing updates the source

#### Scenario: Edit inside the card
- **WHEN** the user clicks a rendered callout card and types
- **THEN** the card stays rendered and the typed text updates the callout source

#### Scenario: No collapse to raw callout source
- **WHEN** the caret is inside a callout block
- **THEN** the block does not turn into a `> [!TYPE]` raw source block

### Requirement: Callout type is selectable

The callout SHALL expose a type/style selector via a secondary submenu (in the callout block menu) so the user can pick among the supported callout types (e.g. note, info, tip, success, warning, danger, error, question), plus a color and an emoji option.

#### Scenario: Choose a callout type
- **WHEN** the user inserts a callout and picks the danger type
- **THEN** the source uses the corresponding `> [!DANGER]`-style marker and the preview renders the danger style

#### Scenario: Choose a callout type from the submenu
- **WHEN** the user opens the callout block menu and picks the danger type from the type submenu
- **THEN** the source uses the corresponding `> [!DANGER]`-style marker and the preview renders the danger style

#### Scenario: Change the callout emoji
- **WHEN** the user opens the callout emoji option and picks an emoji
- **THEN** the callout header shows that emoji and the source is updated

## ADDED Requirements

### Requirement: Callout header text is not duplicated

The rendered callout header SHALL show `emoji + label` exactly once; it SHALL NOT repeat the label (e.g. 「注释 注释」).

#### Scenario: Header shows a single label
- **WHEN** a `> [!NOTE]` callout is rendered
- **THEN** the header text is strictly 「注释」 (or its emoji + 「注释」), with no duplicated label

#### Scenario: Typing after the last character appends
- **WHEN** the caret is at the end of the callout content and the user types
- **THEN** the typed text is appended (no character is swallowed)