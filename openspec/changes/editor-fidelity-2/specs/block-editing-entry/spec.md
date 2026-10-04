## MODIFIED Requirements

### Requirement: Block handle renders as a 42×26 two-segment pill with block-type icon and drag handle

The block handle SHALL render as a 42px wide × 26px high rounded pill (radius 6px) containing two segments: a left block-type icon (22×22, 18px SVG) and a right drag handle (16×22, 12px SVG `DragOutlined`), with a 1px `var(--border-soft)` border and `var(--surface)` background.

#### Scenario: Handle geometry matches spec
- **WHEN** the user hovers any block row in edit mode
- **THEN** the handle appears at `left: 0; top: 2px` relative to the block left gutter and its `getBoundingClientRect()` returns `{width: 42, height: 26}` (±1px)

#### Scenario: Block-type icon switches per block type
- **WHEN** the handle appears on a paragraph / heading / list / table / callout / code / quote / hr / image block
- **THEN** the left segment shows `data-icon` = `TextOutlined` / `H1Outlined`–`H3Outlined` / `DisorderListOutlined` / `DataSheetOutlined` / `CalloutOutlined` / `CodeblockOutlined` / `ReferenceOutlined` / `DividerOutlined` / `ImageOutlined` respectively (per ICON_MAP)

#### Scenario: Drag handle always shows DragOutlined
- **WHEN** the handle appears on any block
- **THEN** the right segment shows `data-icon = DragOutlined`

### Requirement: Block handle appears on hover with entry delay and position threshold

The block handle SHALL fade in when the pointer hovers the block row, but SHALL NOT open the block menu until the pointer enters the handle itself and dwells ≥120ms or moves ≥8px within the handle.

#### Scenario: Hovering block text does not open menu
- **WHEN** the pointer hovers the block text content (not the handle) for 500ms
- **THEN** the handle is visible but the block menu remains closed

#### Scenario: Hovering handle opens menu after delay
- **WHEN** the pointer moves onto the handle and stays ≥120ms
- **THEN** the block menu opens and the block receives the selected highlight

### Requirement: Empty line shows "+" button aligned with handle gutter

The empty-line insertion button SHALL render at the same gutter X coordinate as the block handle (difference < 2px), using `AddOutlined` icon, 20×20 size.

#### Scenario: Empty line "+" X matches handle X
- **WHEN** the user hovers an empty line
- **THEN** the "+" button appears and its `left` coordinate differs from the block handle's `left` by < 2px

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

### Requirement: Block menu "Convert" section shows 10-item icon grid (two rows)

The "转为" section SHALL render a 2-row icon grid (6 + 4 items) with no labels, using SVG icons from ICON_MAP. The current block type SHALL have a `var(--brand-soft)` background highlight.

#### Scenario: Convert grid shows 10 items with correct icons
- **WHEN** the block menu opens on a paragraph block
- **THEN** the grid shows exactly 10 items in order: `TextOutlined` `H1Outlined` `H2Outlined` `H3Outlined` `OrderListOutlined` `DisorderListOutlined` / `TodoOutlined` `CodeblockOutlined` `ReferenceOutlined` `CalloutOutlined`; the `TextOutlined` item has blue background

### Requirement: Block menu contextually adapts per block type

The block menu panel items SHALL differ by block type:
- Paragraph/List: show `缩进和对齐›` `颜色›` `评论` `剪切` `复制` `翻译` `删除` `分享` `复制链接` `在下方添加›`
- Callout: show `同步块` `缩进和对齐›` `评论` `剪切` `复制` `删除` `分享` `复制链接` `在下方添加›` (NO `颜色›` `翻译`)
- Table: show `缩进和对齐›` `剪切` `复制` `删除` `分享` `复制链接` `标题行` `标题列` `均分列宽` `在下方添加›`

#### Scenario: Paragraph block menu has color and translate
- **WHEN** the block menu opens on a paragraph block
- **THEN** the panel items include `颜色›` and `翻译` and do NOT include `标题行`/`标题列`/`均分列宽`/`同步块`

#### Scenario: Callout block menu has no color/translate but has sync block
- **WHEN** the block menu opens on a callout block
- **THEN** the panel items include `同步块` and do NOT include `颜色›` `翻译`

#### Scenario: Table block menu has three table-specific toggles
- **WHEN** the block menu opens on a table block
- **THEN** the panel items include `标题行` (switch), `标题列` (switch), `均分列宽` and do NOT include `颜色›` `翻译`

### Requirement: Block menu submenus open as flyouts on hover

Items marked with `›` SHALL open a flyout panel to the right on pointer hover (no click required), with the same token styling as the parent menu.

#### Scenario: Hover "缩进和对齐›" opens flyout
- **WHEN** the pointer hovers the `缩进和对齐›` item
- **THEN** a flyout appears listing `左对齐` `居中对齐` `右对齐` `增加缩进` `减少缩进` with icons `LeftAlignmentOutlined` `CenterAlignmentOutlined` `RightAlignmentOutlined` `IncreaseIndentationOutlined` `ReduceIndentationOutlined`

#### Scenario: Hover "颜色›" opens unified color submenu
- **WHEN** the pointer hovers the `颜色›` item
- **THEN** a flyout appears with font-color A×8（默认 + 7 色，原型机读值） swatches, bg-color 16 swatches, and "恢复默认" button (per D6)

### Requirement: Block menu action items show product keybindings (non-icon items)

Non-icon panel items SHALL display their keybinding from `keybindings.ts` (e.g., `复制 ⌘C`) right-aligned; icon-grid items show no keybinding.

#### Scenario: Copy item shows ⌘C
- **WHEN** the block menu opens
- **THEN** the `复制` item shows `⌘C` (or platform equivalent) right-aligned

## ADDED Requirements

### Requirement: "在下方添加›" entry opens the shared insert menu

The `在下方添加›` item SHALL open the same insert menu used by slash and empty-line "+" (per `editor-insert-menu` spec), positioned as a flyout.

#### Scenario: "在下方添加›" hover opens insert menu
- **WHEN** the pointer hovers `在下方添加›` in the block menu
- **THEN** the insert menu (categorized list) appears as a flyout