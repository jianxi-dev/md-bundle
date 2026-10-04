# editor-shortcuts Specification

## Purpose
TBD - created by archiving change editor-doubao-parity. Update Purpose after archive.
## Requirements
### Requirement: Inline Markdown shortcuts convert on typing

Typing a Markdown prefix at the start of a line SHALL convert the block: `# ␣`…`###### ␣` to H1–H6, `- ␣`/`* ␣` to bullet, `1. ␣` to ordered, `> ␣` to quote, ` ``` ␣` to code block, `[ ] ␣`/`[] ␣` to task, `--- ␣` to divider.

#### Scenario: Hash converts to heading
- **WHEN** the user types `## ` at the start of an empty line
- **THEN** the line becomes an H2 heading

### Requirement: Function-key shortcuts cover headings and lists

The editor SHALL provide `⌘/Ctrl+Alt+1…6` for heading levels, `⌘/Ctrl+Alt+0` for paragraph, `⌘/Ctrl+⇧7/8/9` for ordered/bullet/task, `⌘/Ctrl+⇧.` for quote, `⌘/Ctrl+⇧C` for code block, `⌘/Ctrl+B/I/U/⇧S` for bold/italic/underline/strikethrough, `⌘/Ctrl+⇧L` for link, `⌘/Ctrl+⇧H` for the color panel, and `Tab`/`⇧Tab` for indent/outdent.

#### Scenario: Heading level via keyboard
- **WHEN** the cursor is on a paragraph and the user presses ⌘/Ctrl+Alt+3
- **THEN** the line becomes an H3 heading

#### Scenario: Indent a list item
- **WHEN** the cursor is on a list item and the user presses Tab
- **THEN** the item is indented one level in the source

### Requirement: Shortcut conflicts are resolved deterministically

The shortcut scheme SHALL keep `⌘/Ctrl+K` for the command palette (link uses `⌘/Ctrl+⇧L`) and SHALL NOT bind `⌘/Ctrl+M` on macOS.

#### Scenario: Command palette keeps Mod-K
- **WHEN** the user presses ⌘/Ctrl+K
- **THEN** the command palette opens (not the link dialog)

### Requirement: Shortcuts are discoverable in the command palette

Every bound shortcut SHALL be listed in the command palette and SHALL be shown next to the corresponding menu item, except for icon-only menu items (which have no text label to attach a keybind to).

#### Scenario: Shortcut is visible in the palette
- **WHEN** the user opens the command palette and looks at 加粗
- **THEN** the item shows `⌘/Ctrl+B`

#### Scenario: Shortcut is visible next to a menu item
- **WHEN** the user opens a menu containing 复制, which has a shortcut
- **THEN** the 复制 row shows its keybind next to the label

#### Scenario: Icon-only items omit the keybind
- **WHEN** a menu item is icon-only (no text label)
- **THEN** no keybind text is rendered for it

