## MODIFIED Requirements

### Requirement: Callout type is selectable

The callout SHALL expose a type/style selector via a secondary submenu (in the callout block menu) so the user can pick among the supported callout types, plus a background color and an emoji option. The renderer's `CALLOUT_TYPE_MAP` MAY retain aliases for backward compatibility, but the editor's displayed type list SHALL be `CALLOUT_EDIT_TYPES` with exactly 13 entries, each having a unique label: `注释` `信息` `摘要` `待办` `提示` `成功` `问题` `警告` `失败` `危险` `Bug` `示例` `引用`.

#### Scenario: Choose a callout type
- **WHEN** the user inserts a callout and picks the danger type
- **THEN** the source uses the corresponding `> [!DANGER]`-style marker and the preview renders the danger style

#### Scenario: Choose a callout type from the submenu
- **WHEN** the user opens the callout block menu and picks the danger type from the type submenu
- **THEN** the source uses the corresponding `> [!DANGER]`-style marker and the preview renders the danger style

#### Scenario: Change the callout emoji
- **WHEN** the user opens the callout emoji option and picks an emoji
- **THEN** the callout header shows that emoji and the source is updated

#### Scenario: Callout type flyout has no duplicate labels
- **WHEN** the user opens the callout type flyout (via block menu `类型›` or insert menu callout styles)
- **THEN** the displayed labels are exactly `注释` `信息` `摘要` `待办` `提示` `成功` `问题` `警告` `失败` `危险` `Bug` `示例` `引用` (13 items, no duplicates)

#### Scenario: Each type has distinct emoji and background token
- **WHEN** the callout type flyout renders
- **THEN** each item shows its emoji and a background color swatch matching its semantic token (e.g., `danger` → `rgba(242,150,44,.28)` amber)

### Requirement: Callout is editable from its rendered state

A rendered callout card SHALL be editable inline: the caret is placed inside the card and typing updates the callout source, without ever switching the whole block to raw `> [!TYPE]` source. The card form SHALL be preserved while editing, and typing after the last character SHALL continue inside the card.

#### Scenario: Click to edit a callout
- **WHEN** the user clicks a rendered callout card
- **THEN** the raw callout source is revealed with the caret inside it and typing updates the source

#### Scenario: Edit inside the card
- **WHEN** the user clicks a rendered callout card and types
- **THEN** the card stays rendered and the typed text updates the callout source

#### Scenario: No collapse to raw callout source
- **WHEN** the caret is inside a callout block
- **THEN** the block does not turn into a `> [!TYPE]` raw source block

#### Scenario: Typing in callout keeps card rendered
- **WHEN** the user clicks inside a callout block and types
- **THEN** the callout remains a rendered card; no source markup appears

## ADDED Requirements

### Requirement: Callout header emoji opens emoji picker

The callout block's header emoji SHALL be clickable. Clicking it SHALL open an emoji-mart style picker (search + recent + categories + bottom category bar). Selecting an emoji SHALL update the block's `data-callout-emoji` attribute and re-render the header.

#### Scenario: Click callout emoji opens picker
- **WHEN** the user clicks the emoji in a callout block header
- **THEN** an emoji picker overlay appears with search, recent, categories, and category bar

#### Scenario: Selecting emoji updates callout header
- **WHEN** the emoji picker is open and the user selects 🎉
- **THEN** the callout header emoji changes to 🎉 and the block's `data-callout-emoji` attribute is updated

### Requirement: Default callout inserts with 🎉 + amber background

A newly inserted callout block (via insert menu or slash) SHALL default to emoji 🎉 and background `rgba(242,150,44,.28)`.

#### Scenario: New callout has 🎉 and amber bg
- **WHEN** the user inserts a callout via any entry point
- **THEN** the callout renders with header emoji 🎉 and background `rgba(242,150,44,.28)`

### Requirement: Callout block menu contextually adapts (no color/translate, add sync block)

The callout block menu SHALL follow the context adaptation rules: NO `颜色›` and NO `翻译`; it SHALL ADD `同步块` (`LinkRecordOutlined`). The `类型›` flyout SHALL be available for the callout type selection.

#### Scenario: Callout block menu lacks color and translate
- **WHEN** the block menu opens on a callout block
- **THEN** the panel items do NOT include `颜色›` or `翻译`

#### Scenario: Callout block menu has sync block
- **WHEN** the block menu opens on a callout block
- **THEN** the panel items include `同步块` with `LinkRecordOutlined` icon

#### Scenario: Callout block menu has type flyout
- **WHEN** the block menu opens on a callout block
- **THEN** the panel items include `类型›` which opens the deduplicated callout type flyout on hover
