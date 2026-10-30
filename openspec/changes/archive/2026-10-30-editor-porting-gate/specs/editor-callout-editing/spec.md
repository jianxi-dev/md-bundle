## MODIFIED Requirements

### Requirement: Callout is editable from its rendered state

A rendered callout card SHALL be editable inline: the caret is placed inside the card and typing updates the callout source, without ever switching the whole block to raw `> [!TYPE]` source. The card form SHALL be preserved while editing, and typing after the last character SHALL continue inside the card.

The card SHALL render the in-progress draft, not the last persisted parse: while an edit is staged, any rebuild of the card (viewport update, decoration recompute, sibling transaction) MUST show the typed text rather than fall back to the pre-edit content.

#### Scenario: Click to edit a callout
- **WHEN** the user clicks a rendered callout card
- **THEN** the raw callout source is revealed with the caret inside it and typing updates the source

#### Scenario: Edit inside the card
- **WHEN** the user clicks a rendered callout card and types
- **THEN** the card stays rendered and the typed text updates the callout source

#### Scenario: No collapse to raw callout source
- **WHEN** the caret is inside a callout block
- **THEN** the block does not turn into a `> [!TYPE]` raw source block

#### Scenario: Typing in callout keeps card rendered
- **WHEN** the user clicks inside a callout block and types
- **THEN** the callout remains a rendered card; no source markup appears

#### Scenario: Draft survives a card rebuild
- **WHEN** the user is typing in a callout card and the card is rebuilt by an editor update
- **THEN** the card shows the typed draft text, never the pre-edit content

#### Scenario: Clicking the card always opens the editor once
- **WHEN** the user clicks the body of a rendered callout card
- **THEN** exactly one inline editor opens and receives focus, regardless of how many cards exist or how many times the card was rebuilt
