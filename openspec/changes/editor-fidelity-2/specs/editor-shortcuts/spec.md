## MODIFIED Requirements

### Requirement: Command palette item height 32px, font 12px, spacing multiples of 4

The command palette (⌘/Ctrl+K) SHALL render each command row with `height: 32px`, label `font-size: 12px`, description `font-size: 11px`, icon `18px`, horizontal padding `0 8px`, gap `8px` (all multiples of 4). Group headings SHALL be sticky. The palette SHALL retain single-column layout with right-aligned keybindings, recent-commands section, fuzzy/pinyin matching with highlighted matches, and footer shortcut hint bar.

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

### Requirement: Block menu action items show product keybindings (non-icon items)

Non-icon panel items in the block menu SHALL display their keybinding from `keybindings.ts` (e.g., `复制 ⌘C`, `删除 ⌘⌫`) right-aligned. Icon-grid items (Convert grid) show no keybinding.

#### Scenario: Block menu copy item shows ⌘C
- **WHEN** the block menu opens on a paragraph block
- **THEN** the `复制` item shows `⌘C` (or platform equivalent) right-aligned

#### Scenario: Block menu delete item shows keybinding
- **WHEN** the block menu opens
- **THEN** the `删除` item shows its keybinding (e.g., `⌘⌫` or `Backspace`) right-aligned

#### Scenario: Convert grid items show no keybinding
- **WHEN** the block menu convert grid is visible
- **THEN** the 10 icon items have no keybinding text

## ADDED Requirements

### Requirement: Slash menu items show product keybindings (not markdown trigger chars)

The insert menu (slash) items SHALL display their product keybinding from `keybindings.ts` where applicable, NOT the markdown trigger syntax (e.g., show `⌘⇧7` for heading 1, not `# `).

#### Scenario: Slash menu heading shows ⌘⇧7 not "# "
- **WHEN** the insert menu is open and the "一级标题" item is visible
- **THEN** the item shows `⌘⇧7` (or platform equivalent) right-aligned, not `# `