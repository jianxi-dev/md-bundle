## MODIFIED Requirements

### Requirement: Video and file embeds are supported

The editor SHALL support embedding a video or a file attachment via a defined Markdown-compatible syntax, with sanitization decided by the shared renderer. An inserted video/file SHALL render in edit mode as a recognizable card or player (not raw syntax).

#### Scenario: Insert a file embed
- **WHEN** the user invokes the video/file insert command and selects a file
- **THEN** a reference to the file is inserted into the source and the preview renders a corresponding embed/link

#### Scenario: A file embed renders as a card in edit mode
- **WHEN** a document containing a file embed is opened in edit mode
- **THEN** the embed renders as a recognizable card/link rather than raw syntax

## ADDED Requirements

### Requirement: Mermaid flowcharts preview in edit mode and render without collapsing

A Mermaid fenced code block SHALL preview as a rendered diagram in edit mode and render as a finished diagram in preview/export, and SHALL NOT be collapsed into raw source outside the active block.

#### Scenario: Flowchart previews in edit mode
- **WHEN** a document containing a Mermaid fenced code block is opened in edit mode
- **THEN** the block shows a rendered diagram, not raw Mermaid source

#### Scenario: Flowchart renders on export
- **WHEN** a document containing a Mermaid flowchart is exported to HTML
- **THEN** the output contains the rendered diagram
