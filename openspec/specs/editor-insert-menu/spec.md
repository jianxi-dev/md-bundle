# editor-insert-menu Specification

## Purpose
TBD - created by archiving change editor-doubao-parity. Update Purpose after archive.
## Requirements
### Requirement: Insert menu renders as a grouped icon grid

The insert menu SHALL render commands as a grouped icon grid in labelled groups (基础 / 常用 / 数据 / 绘图 / 团队协作 / 项目管理 / 进阶), where each row shows an icon and a label, instead of a flat text list.

#### Scenario: Icon grid is shown
- **WHEN** the user triggers the insert menu on an empty line in edit mode
- **THEN** the menu shows group headings and each command as an icon + label grid item

### Requirement: Second-level options open as a flyout

The insert menu SHALL open second-level options (e.g. 标题 → H1–H6, 标注 → 样式) as a flyout panel anchored to the parent item, without replacing the root list.

#### Scenario: Open the heading flyout
- **WHEN** the user selects 「标题」 in the insert menu
- **THEN** a flyout listing H1–H6 appears next to the item and selecting a level inserts that heading

### Requirement: Insert menu supports typing to filter and hit codes

After the insert menu is open, typing SHALL filter the visible items and, when the typed text matches a declared single-key or second-level code, SHALL select that item directly. A non-code character (e.g. Chinese prose input) SHALL NOT close the menu.

#### Scenario: Single-key code selects a block type
- **WHEN** the menu is open and the user types `r`
- **THEN** the 任务 item is selected and inserting applies the task block

#### Scenario: Second-level code hits a callout style
- **WHEN** the menu is open and the user types `nd`
- **THEN** the danger callout style is inserted

#### Scenario: IME composition does not close the menu
- **WHEN** the user is composing Chinese text with an IME while the menu is open
- **THEN** the menu stays open and does not select a command until composition ends

### Requirement: Insert menu declares single-key and second-level codes

The insert menu SHALL declare a single-key code for the root items it exposes (`/1…/6` headings, `/q` quote, `/c` code block, `/t` table, `/n` callout, `/p` image with alias `/img`, `/m` HTML with alias `/css`, `/r` task, `/d` divider) and second-level codes (`/nn /ni /nt /ns /nw /nd /ne /nq` callout styles, `/t<cols><rows>` table size up to 9×9).

#### Scenario: Table size code
- **WHEN** the menu is open and the user types `t53`
- **THEN** a table with 5 columns and 3 rows is inserted

#### Scenario: Callout style code
- **WHEN** the menu is open and the user types `nd`
- **THEN** a callout with the danger style is inserted

### Requirement: Insert window is triggered by slash

The insert window SHALL be triggerable by typing `/` at a valid start position, subject to the existing IME guard.

#### Scenario: Slash triggers the window
- **WHEN** the user types `/` on an empty line
- **THEN** the insert window opens

### Requirement: Command palette renders as a grid with shortcuts and previews

The command palette (⌘/Ctrl+K) SHALL render commands as a grid where each item shows its keyboard shortcut and a brief description or a style preview.

#### Scenario: Palette shows shortcuts
- **WHEN** the user opens the command palette
- **THEN** each command item shows its shortcut keys and a one-line description or style preview

