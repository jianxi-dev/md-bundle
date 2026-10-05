## MODIFIED Requirements

### Requirement: Insert menu renders as a grouped icon grid

The insert menu SHALL render commands as a vertical list grouped under labelled category headings (基础 / 常用 / 数据 / 绘图 / 团队协作 / 进阶 / 更多小组件), where each row shows an SVG icon (`data-icon` from ICON_MAP) and a label, instead of a flat ungrouped icon grid.

#### Scenario: Icon grid is shown
- **WHEN** the user triggers the insert menu on an empty line in edit mode
- **THEN** the menu shows group headings and each command as a labelled icon row

#### Scenario: Grouped list is shown
- **WHEN** the user triggers the insert menu with `/` on an empty line in edit mode
- **THEN** the menu shows category headings with each command as an icon + label list row

#### Scenario: Categorized list is shown
- **WHEN** the user triggers the insert menu via `/`, `、`, empty-line "+", or "在下方添加›"
- **THEN** the menu shows category headings and each command as an icon + label list row; no grid layout

#### Scenario: Categories match Doubao spec
- **WHEN** the insert menu opens
- **THEN** the categories and their items (icon + name) match `functional-spec.md` §5.2 table exactly

### Requirement: Second-level options open as a flyout

The insert menu SHALL open second-level options (e.g. 标题 → H1–H6, 标注 → 样式, 表格 → 尺寸, 分栏 → 栏数, 按钮) as a flyout panel anchored to the parent item, without replacing the root list. Items marked with `›` SHALL open their second-level selector on pointer hover (no click/ArrowRight required).

#### Scenario: Open the heading flyout
- **WHEN** the user selects 「标题」 in the insert menu
- **THEN** a flyout listing H1–H6 appears next to the item and selecting a level inserts that heading

#### Scenario: Hover "表格›" opens 10×10 size grid
- **WHEN** the pointer hovers the `表格›` item
- **THEN** a flyout appears titled "插入支持富文本的表格" with a 10×10 grid; hovering a cell highlights the selection; clicking inserts that size

#### Scenario: Hover "分栏›" opens column count selector
- **WHEN** the pointer hovers the `分栏›` item
- **THEN** a flyout appears listing 1–5 栏; clicking inserts that column count

#### Scenario: Clicking parent item without selecting size inserts default
- **WHEN** the user clicks `表格` (not the flyout) or presses Enter on it
- **THEN** a default 2×3 table is inserted

### Requirement: Insert menu supports typing to filter and hit codes

After the insert menu is open, continuing to type SHALL filter the visible items by Chinese name, by pinyin initials/full pinyin, and by declared single-key or second-level codes. When the typed text matches a parent item that owns second-level options, the menu SHALL list those second-level options directly so the user does not need to hover. A non-code character (e.g. Chinese prose input) SHALL NOT close the menu.

#### Scenario: Single-key code selects a block type
- **WHEN** the menu is open and the user types `r`
- **THEN** the 任务 item is selected and inserting applies the task block

#### Scenario: Second-level code hits a callout style
- **WHEN** the menu is open and the user types `nd`
- **THEN** the danger callout style is inserted

#### Scenario: IME composition does not close the menu
- **WHEN** the user is composing Chinese text with an IME while the menu is open
- **THEN** the menu stays open and does not select a command until composition ends

#### Scenario: Pinyin filters to a command
- **WHEN** the menu is open and the user types `biao`
- **THEN** the 表格 command is matched and highlighted

#### Scenario: Second-level options are surfaced directly while filtering
- **WHEN** the menu is open and the user types a term that matches a parent owning second-level options
- **THEN** the second-level options for that parent are listed directly, without requiring a hover

### Requirement: Insert menu declares single-key and second-level codes

The insert menu SHALL declare a single-key code for the root items it exposes (`/1…/6` headings, `/q` quote, `/c` code block, `/t` table, `/n` callout, `/p` image with alias `/img`, `/m` HTML with alias `/css`, `/r` task, `/d` divider) and second-level codes (`/nn /ni /nt /ns /nw /nd /ne /nq` callout styles, `/f<cols>` columns, `/t<cols><rows>` table size up to 9×9).

#### Scenario: Table size code
- **WHEN** the menu is open and the user types `t53`
- **THEN** a table with 5 columns and 3 rows is inserted

#### Scenario: Callout style code
- **WHEN** the menu is open and the user types `nd`
- **THEN** a callout with the danger style is inserted

#### Scenario: Column count code uses /fN (not /flN)
- **WHEN** the menu is open and the user types `/f3`
- **THEN** the 3-column layout is inserted
- **WHEN** the user types `/fl3`
- **THEN** no match (legacy code deprecated)

### Requirement: Insert window is triggered by slash or Chinese comma

The insert window SHALL be triggerable by typing `/` or `、` at a valid start position, subject to the existing IME guard.

#### Scenario: Slash triggers the window
- **WHEN** the user types `/` on an empty line
- **THEN** the insert window opens

#### Scenario: Chinese comma triggers the window
- **WHEN** the user types `、` on an empty line
- **THEN** the insert window opens

### Requirement: Cancelling the insert menu leaves no residue

Cancelling the insert menu via Escape or an outside click SHALL remove the trigger character from the document, leaving no `/` or `、` residue. The menu SHALL also close when the caret moves away or the user clicks outside.

#### Scenario: Escape leaves no slash
- **WHEN** the user opens the insert menu with `/` and presses Escape
- **THEN** the document does not contain the triggering `/`

#### Scenario: Outside click closes the menu
- **WHEN** the insert menu is open and the user clicks elsewhere in the document
- **THEN** the menu closes
- **AND** no trigger character remains

### Requirement: An empty insert-menu result is dismissible

When filtering yields no matches, the insert menu SHALL show a "无匹配项" message and remain dismissible, and SHALL NOT persist as an empty box after the user exits.

#### Scenario: No matches then dismiss
- **WHEN** the menu is open and the typed query matches nothing
- **THEN** a "无匹配项" message is shown and pressing Escape dismisses the menu with no leftover box

## REMOVED Requirements

### Requirement: Command palette renders as a grid with shortcuts and previews

## ADDED Requirements

### Requirement: Three entry points share the same insert menu instance

The empty-line "+" hover, the block menu `在下方添加›` hover, and the `/` / `、` keystroke SHALL all open the **same** insert menu component (same DOM, same state, same filtering).

#### Scenario: Empty-line "+" hover opens insert menu
- **WHEN** the user hovers the "+" button on an empty line
- **THEN** the insert menu opens (categorized list)

#### Scenario: Block menu "在下方添加›" hover opens same insert menu
- **WHEN** the user hovers `在下方添加›` in the block menu
- **THEN** the same insert menu opens as a flyout

#### Scenario: Slash opens same insert menu
- **WHEN** the user types `/` on an empty line
- **THEN** the same insert menu opens

### Requirement: Command palette renders as a single-column list with shortcuts and previews

The command palette (⌘/Ctrl+K) SHALL render commands as a single vertical list — not a grid — where each row shows an icon, the command name, a one-line description, and the keyboard shortcut right-aligned, with sticky group headings, a recent-commands section, fuzzy/pinyin matching with highlighted matches, single-column arrow navigation with a selected state, and a footer shortcut hint bar.

#### Scenario: Palette shows shortcuts
- **WHEN** the user opens the command palette
- **THEN** each command item shows its shortcut keys and a one-line description or style preview

#### Scenario: Palette uses a single column
- **WHEN** the user opens the command palette
- **THEN** commands are listed in a single column with the shortcut right-aligned on each row

#### Scenario: Palette shows a recent section and group headings
- **WHEN** the user opens the command palette after using some commands
- **THEN** a 最近使用 section is shown at the top and group headings stick while scrolling

#### Scenario: Outside click closes the palette
- **WHEN** the user clicks outside the command palette
- **THEN** the palette closes
