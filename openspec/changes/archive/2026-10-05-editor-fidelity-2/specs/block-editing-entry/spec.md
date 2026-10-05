## MODIFIED Requirements

### Requirement: Block handle shows the block type icon

The block handle SHALL render as a 42px wide × 26px high rounded pill (radius 6px) containing two segments: a left block-type icon (22×22, 18px SVG) and a right drag handle (16×22, 12px SVG `DragOutlined`), with a 1px `var(--border-soft)` border and `var(--surface)` background. The left segment SHALL display an icon reflecting the current block's type and heading level (e.g. H1/H2, task checkbox, quote, code), not a single generic glyph.

#### Scenario: Heading icon on the handle
- **WHEN** the pointer is on an H2 block
- **THEN** the handle shows an H2-level icon

#### Scenario: Handle geometry matches spec
- **WHEN** the user hovers any block row in edit mode
- **THEN** the handle appears at `left: 0; top: 2px` relative to the block left gutter and its `getBoundingClientRect()` returns `{width: 42, height: 26}` (±1px)

#### Scenario: Block-type icon switches per block type
- **WHEN** the handle appears on a paragraph / heading / list / table / callout / code / quote / hr / image block
- **THEN** the left segment shows `data-icon` = `TextOutlined` / `H1Outlined`–`H3Outlined` / `DisorderListOutlined` / `DataSheetOutlined` / `CalloutOutlined` / `CodeblockOutlined` / `ReferenceOutlined` / `DividerOutlined` / `ImageOutlined` respectively (per ICON_MAP)

#### Scenario: Drag handle always shows DragOutlined
- **WHEN** the handle appears on any block
- **THEN** the right segment shows `data-icon = DragOutlined`

### Requirement: The block menu opens on hover over the handle

The block handle SHALL fade in when the pointer hovers the block row, but SHALL NOT open the block menu until the pointer enters the handle itself and dwells ≥120ms or moves ≥8px within the handle. Hovering over the block handle SHALL automatically open the block menu without a click, and the block SHALL display a selected state while its menu is open. The handle and menu SHALL be dismissed when the pointer leaves the combined handle + menu + flyout + insert-panel hit region, and SHALL be dismissed immediately on editor scroll.

#### Scenario: Hovering the handle opens the menu
- **WHEN** the pointer moves onto the block handle and dwells ≥120ms
- **THEN** the block menu opens and the block shows its selected state, with no click required

#### Scenario: Moving from handle to menu keeps it open
- **WHEN** the pointer moves from the handle into the open menu
- **THEN** the menu stays open

#### Scenario: Hovering block text does not open menu
- **WHEN** the pointer hovers the block text content (not the handle) for 500ms
- **THEN** the handle is visible but the block menu remains closed

#### Scenario: Leaving the handle/menu stack dismisses everything
- **WHEN** the pointer leaves the combined handle + menu + flyout + insert-panel region
- **THEN** the handle, menu, and any open flyout are dismissed (display: none) without requiring a click

#### Scenario: Scrolling dismisses the handle and menu
- **WHEN** the user scrolls the editor while a block is hovered
- **THEN** the handle and menu are dismissed immediately

### Requirement: Empty lines expose an insert affordance

An empty line/blank area SHALL show a 「＋」 affordance in the gutter on hover; clicking it SHALL open the insert menu. The insertion button SHALL render at the same gutter X coordinate as the block handle (difference < 2px), using `AddOutlined` icon, 20×20 size.

#### Scenario: Empty line shows plus
- **WHEN** the pointer is over an empty line
- **THEN** a 「＋」 appears in the gutter and clicking it opens the insert menu

#### Scenario: Empty line "+" X matches handle X
- **WHEN** the user hovers an empty line
- **THEN** the "+" button appears and its `left` coordinate differs from the block handle's `left` by < 2px

### Requirement: Block handle menu and toolbar controls are iconified

The block handle menu SHALL render each entry with an icon and label. The "转为" section SHALL render a 2-row icon grid (6 + 4 items) with no labels, using SVG icons from ICON_MAP; the current block type SHALL have a `var(--brand-soft)` background highlight.

#### Scenario: Menu shows icons
- **WHEN** the user opens the block handle menu
- **THEN** each entry shows an icon alongside its label

#### Scenario: Convert grid shows 10 items with correct icons
- **WHEN** the block menu opens on a paragraph block
- **THEN** the grid shows exactly 10 items in order: `TextOutlined` `H1Outlined` `H2Outlined` `H3Outlined` `OrderListOutlined` `DisorderListOutlined` / `TodoOutlined` `CodeblockOutlined` `ReferenceOutlined` `CalloutOutlined`; the `TextOutlined` item has blue background

### Requirement: The block menu is contextual and exposes secondary submenus

The block menu SHALL vary its actions by block type while sharing common chrome (the 转为 grid and the `缩进和对齐›` flyout). It SHALL show `颜色›` for non-callout blocks only, `类型›` and `同步块` for callout blocks only, and `标题行` `标题列` `均分列宽` for table blocks only. It SHALL include the common actions `评论` `剪切` `分享` `复制链接` `在下方添加›` on all blocks, and `翻译` on non-callout blocks only. Multi-option actions marked with `›` SHALL open a secondary submenu (flyout) to the right on pointer hover (no click required), with the same token styling as the parent menu.

#### Scenario: Multi-option action opens a submenu
- **WHEN** the user opens the block menu and points at the alignment action
- **THEN** a secondary submenu with the alignment/indent choices opens next to it

#### Scenario: Callout block menu exposes a type submenu
- **WHEN** the user opens the block menu on a callout block
- **THEN** the menu includes a type/color submenu rather than only generic actions

#### Scenario: Paragraph block menu has color and translate
- **WHEN** the block menu opens on a paragraph block
- **THEN** the panel items include `颜色›` and `翻译` and do NOT include `标题行`/`标题列`/`均分列宽`/`同步块`

#### Scenario: Callout block menu has no color/translate but has sync block
- **WHEN** the block menu opens on a callout block
- **THEN** the panel items include `同步块` and do NOT include `颜色›` `翻译`

#### Scenario: Table block menu has three table-specific toggles
- **WHEN** the block menu opens on a table block
- **THEN** the panel items include `标题行` (switch), `标题列` (switch), `均分列宽`; the table block is not a callout so `颜色›` and `翻译` remain available

#### Scenario: Hover "缩进和对齐›" opens flyout
- **WHEN** the pointer hovers the `缩进和对齐›` item
- **THEN** a flyout appears listing `左对齐` `居中对齐` `右对齐` `增加缩进` `减少缩进` with icons `LeftAlignmentOutlined` `CenterAlignmentOutlined` `RightAlignmentOutlined` `IncreaseIndentationOutlined` `ReduceIndentationOutlined`

#### Scenario: Hover "颜色›" opens unified color submenu
- **WHEN** the pointer hovers the `颜色›` item
- **THEN** a flyout appears with font-color A×8（默认 + 7 色，原型机读值） swatches, bg-color 16 swatches, and "恢复默认" button (per D6)

## REMOVED Requirements

### Requirement: Block handle stays visible while the pointer is on the block or handle

## ADDED Requirements

### Requirement: Block menu renders at 236px width, 32px item height, 12px font, top-aligned with block

The block menu SHALL have `min-width: 236px`, `padding: 5px`, `font-size: 13px`, `border-radius: 6px`, `box-shadow: rgba(0,0,0,.28) 0 8px 16px`. Each item SHALL have `height: 32px`, `padding: 0 8px`, `gap: 9px`, `border-radius: 4px`, `font-size: 12px`. The menu top SHALL align with the block top (±2px). The menu SHALL clamp/flip to stay within the viewport.

#### Scenario: Menu dimensions match tokens
- **WHEN** the block menu opens
- **THEN** `menu.offsetWidth ≥ 236`, each item `offsetHeight = 32`, computed `font-size = 12px`

#### Scenario: Menu top aligns with block top
- **WHEN** the block menu opens for a block at Y=150
- **THEN** `menu.getBoundingClientRect().top = 150` (±2px)

#### Scenario: Menu clamps/flips at viewport bottom
- **WHEN** the block menu opens for a block near viewport bottom such that `blockTop + menuHeight > innerHeight`
- **THEN** the menu flips upward so its bottom ≤ `innerHeight - 8`

### Requirement: Block menu action items show product keybindings (non-icon items)

Non-icon panel items SHALL display their keybinding from `keybindings.ts` (e.g., `复制 ⌘C`, `删除 ⌘⌫`) right-aligned; icon-grid items show no keybinding.

#### Scenario: Copy item shows ⌘C
- **WHEN** the block menu opens
- **THEN** the `复制` item shows `⌘C` (or platform equivalent) right-aligned

#### Scenario: Convert grid items show no keybinding
- **WHEN** the block menu convert grid is visible
- **THEN** the 10 icon items have no keybinding text

### Requirement: "在下方添加›" entry opens the shared insert menu

The `在下方添加›` item SHALL open the same insert menu used by slash and empty-line "+" (per `editor-insert-menu` spec), positioned as a flyout.

#### Scenario: "在下方添加›" hover opens insert menu
- **WHEN** the pointer hovers `在下方添加›` in the block menu
- **THEN** the insert menu (categorized list) appears as a flyout
