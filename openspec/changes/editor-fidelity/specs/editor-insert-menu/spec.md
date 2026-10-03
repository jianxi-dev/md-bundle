## MODIFIED Requirements

### Requirement: Insert menu renders as a grouped icon grid

The slash insert menu SHALL render commands as a vertical list grouped under labelled category headings (基础 / 常用 / 绘图), where each row shows an icon and a label, instead of a flat ungrouped list.

#### Scenario: Grouped list is shown
- **WHEN** the user triggers the insert menu with `/` on an empty line in edit mode
- **THEN** the menu shows category headings with each command as an icon + label list row

### Requirement: Insert menu supports typing to filter and hit codes

After the insert menu is open, continuing to type SHALL filter the visible items by Chinese name, by pinyin initials/full pinyin, and by declared single-key or second-level codes. When the typed text matches a parent item that owns second-level options, the menu SHALL list those second-level options directly so the user does not need to hover. A non-code character (e.g. Chinese prose input) SHALL NOT close the menu.

#### Scenario: Pinyin filters to a command
- **WHEN** the menu is open and the user types `biao`
- **THEN** the 表格 command is matched and highlighted

#### Scenario: Single-key code selects a block type
- **WHEN** the menu is open and the user types `r`
- **THEN** the 任务 item is selected and inserting applies the task block

#### Scenario: Second-level code hits a callout style
- **WHEN** the menu is open and the user types `nd`
- **THEN** the danger callout style is inserted

#### Scenario: Second-level options are surfaced directly while filtering
- **WHEN** the menu is open and the user types a term that matches a parent owning second-level options
- **THEN** the second-level options for that parent are listed directly, without requiring a hover

#### Scenario: IME composition does not close the menu
- **WHEN** the user is composing Chinese text with an IME while the menu is open
- **THEN** the menu stays open and does not select a command until composition ends

### Requirement: Insert window is triggered by slash or Chinese comma

The insert window SHALL be triggerable by typing `/` or `、` at a valid start position, subject to the existing IME guard.

#### Scenario: Slash triggers the window
- **WHEN** the user types `/` on an empty line
- **THEN** the insert window opens

#### Scenario: Chinese comma triggers the window
- **WHEN** the user types `、` on an empty line
- **THEN** the insert window opens

### Requirement: Command palette renders as a grid with shortcuts and previews

The command palette (⌘/Ctrl+K) SHALL render commands as a single vertical list — not a grid — where each row shows an icon, the command name, a one-line description, and the keyboard shortcut right-aligned, with sticky group headings, a recent-commands section, fuzzy/pinyin matching with highlighted matches, single-column arrow navigation with a selected state, and a footer shortcut hint bar.

#### Scenario: Palette uses a single column
- **WHEN** the user opens the command palette
- **THEN** commands are listed in a single column with the shortcut right-aligned on each row

#### Scenario: Palette shows a recent section and group headings
- **WHEN** the user opens the command palette after using some commands
- **THEN** a 最近使用 section is shown at the top and group headings stick while scrolling

#### Scenario: Outside click closes the palette
- **WHEN** the user clicks outside the command palette
- **THEN** the palette closes

## ADDED Requirements

### Requirement: Cancelling the insert menu leaves no residue

Cancelling the insert menu via Escape or an outside click SHALL remove the trigger character from the document, leaving no `/` or `、` residue. The menu SHALL also close when the caret moves away or the user clicks outside.

#### Scenario: Escape leaves no slash
- **WHEN** the user opens the insert menu with `/` and presses Escape
- **THEN** the document does not contain the triggering `/`

#### Scenario: Outside click closes the menu
- **WHEN** the insert menu is open and the user clicks elsewhere in the document
- **THEN** the menu closes

### Requirement: An empty insert-menu result is dismissible

When filtering yields no matches, the insert menu SHALL show a "无匹配项" message and remain dismissible, and SHALL NOT persist as an empty box after the user exits.

#### Scenario: No matches then dismiss
- **WHEN** the menu is open and the typed query matches nothing
- **THEN** a "无匹配项" message is shown and pressing Escape dismisses the menu with no leftover box
