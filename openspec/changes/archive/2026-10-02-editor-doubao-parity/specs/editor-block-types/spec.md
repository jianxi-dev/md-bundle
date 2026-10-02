## ADDED Requirements

### Requirement: Block model distinguishes heading levels and task blocks

The block model SHALL expose heading level (H1–H6) and a task/checkbox block type, in addition to the existing block kinds, so that UI (handle icon, menus, conversions) can reflect the actual block type.

#### Scenario: Task block is identified
- **WHEN** the cursor is on a line containing `- [ ] text`
- **THEN** the block model reports it as a task block (not a generic list)

### Requirement: Add task and convert to task

The editor SHALL provide commands to insert a new task block and to convert an existing block to a task (via whole-block turn-into).

#### Scenario: Convert a paragraph to a task
- **WHEN** the cursor is on a paragraph and the user invokes convert-to-task
- **THEN** the line becomes `- [ ] …` in the source

### Requirement: Task checkbox is clickable

Clicking a task checkbox SHALL toggle the underlying source between `- [ ]` and `- [x]`.

#### Scenario: Toggle a task
- **WHEN** the user clicks the checkbox of an unchecked task
- **THEN** the source becomes `- [x]` and the checkbox renders checked

### Requirement: Block indent and outdent

The editor SHALL provide indent and outdent commands for list blocks that add/remove one indentation level in the source, bound to Tab / Shift-Tab outside headings.

#### Scenario: Outdent a nested list item
- **WHEN** the cursor is on an indented list item and the user presses Shift-Tab
- **THEN** the item's indentation decreases by one level

### Requirement: Video and file embeds are supported

The editor SHALL support embedding a video or a file attachment via a defined Markdown-compatible syntax, with sanitization decided by the shared renderer.

#### Scenario: Insert a file embed
- **WHEN** the user invokes the video/file insert command and selects a file
- **THEN** a reference to the file is inserted into the source and the preview renders a corresponding embed/link
