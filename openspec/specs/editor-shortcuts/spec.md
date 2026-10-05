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

Every bound shortcut SHALL be listed in the command palette and SHALL be shown next to the corresponding menu item, except for icon-only menu items (which have no text label to attach a keybind to). The command palette SHALL retain its single-column layout with right-aligned keybindings, a recent-commands section, fuzzy/pinyin matching with highlighted matches, and a footer shortcut hint bar.

#### Scenario: Shortcut is visible in the palette
- **WHEN** the user opens the command palette and looks at 加粗
- **THEN** the item shows `⌘/Ctrl+B`

#### Scenario: Shortcut is visible next to a menu item
- **WHEN** the user opens a menu containing 复制, which has a shortcut
- **THEN** the 复制 row shows its keybind next to the label

#### Scenario: Icon-only items omit the keybind
- **WHEN** a menu item is icon-only (no text label)
- **THEN** no keybind text is rendered for it

#### Scenario: Block menu copy item shows ⌘C
- **WHEN** the block menu opens on a paragraph block
- **THEN** the `复制` item shows `⌘C` (or platform equivalent) right-aligned

### Requirement: Command palette item height 32px, font 12px, spacing multiples of 4

The command palette (⌘/Ctrl+K) SHALL render each command row with `height: 32px`, label `font-size: 12px`, description `font-size: 11px`, icon `18px`, horizontal padding `0 8px`, gap `8px` (all multiples of 4). Group headings SHALL be sticky.

#### Scenario: Palette item height is 32px
- **WHEN** the user opens the command palette
- **THEN** each command row `getBoundingClientRect().height = 32` (±1px)

#### Scenario: Palette label font is 12px
- **WHEN** the command palette is open
- **THEN** computed `font-size` of command labels = `12px`

#### Scenario: Palette horizontal spacing multiples of 4
- **WHEN** the command palette is open
- **THEN** row `padding-left` and `padding-right` are multiples of 4; `gap` between icon/label/keybinding is a multiple of 4

#### Scenario: Palette retains single-column with keybindings right-aligned
- **WHEN** the command palette is open
- **THEN** commands are listed in a single column; keybindings appear right-aligned on each row

#### Scenario: Palette shows recent section and sticky group headings
- **WHEN** the user opens the command palette after using some commands
- **THEN** a "最近使用" section appears at the top; group headings stick while scrolling

### Requirement: Slash menu items show product keybindings (not markdown trigger chars)

The insert menu (slash) items SHALL display their product keybinding from `keybindings.ts` where applicable, NOT the markdown trigger syntax (e.g., show `⌘⇧7` for heading 1, not `# `).

#### Scenario: Slash menu heading shows ⌘⇧7 not "# "
- **WHEN** the insert menu is open and the "一级标题" item is visible
- **THEN** the item shows `⌘⇧7` (or platform equivalent) right-aligned, not `# `

