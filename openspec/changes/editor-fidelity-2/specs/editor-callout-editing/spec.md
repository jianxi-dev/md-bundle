## MODIFIED Requirements

### Requirement: Callout type flyout shows deduplicated unique labels

The callout type submenu (opened from block menu `类型›` or insert menu callout styles) SHALL display a deduplicated set of callout types with unique labels. The renderer's `CALLOUT_TYPE_MAP` MAY retain aliases for backward compatibility, but the editor's displayed type list SHALL be `CALLOUT_EDIT_TYPES` with exactly 13 entries, each having a unique label.

#### Scenario: Callout type flyout has no duplicate labels
- **WHEN** the user opens the callout type flyout (via block menu `类型›` or insert menu callout styles)
- **THEN** the displayed labels are exactly: `注释` `信息` `摘要` `待办` `提示` `成功` `问题` `警告` `失败` `危险` `Bug` `示例` `引用` (13 items, no duplicates)

#### Scenario: Each type has distinct emoji and background token
- **WHEN** the callout type flyout renders
- **THEN** each item shows its emoji and a background color swatch matching its semantic token (e.g., `danger` → `rgba(242,150,44,.28)` amber)

### Requirement: Callout header emoji opens emoji picker

The callout block's header emoji SHALL be clickable. Clicking it SHALL open an emoji-mart style picker (search + recent + categories + bottom category bar). Selecting an emoji SHALL update the block's `data-callout-emoji` attribute and re-render the header.

#### Scenario: Click callout emoji opens picker
- **WHEN** the user clicks the emoji in a callout block header
- **THEN** an emoji picker overlay appears with search, recent, categories, and category bar

#### Scenario: Selecting emoji updates callout header
- **WHEN** the emoji picker is open and the user selects 🎉
- **THEN** the callout header emoji changes to 🎉 and the block's `data-callout-emoji` attribute is updated

### Requirement: Callout block menu contextually adapts (no color/translate, add sync block)

The callout block menu SHALL follow the context adaptation rules: NO `颜色›` NO `翻译`; ADD `同步块` (`LinkRecordOutlined`).

#### Scenario: Callout block menu lacks color and translate
- **WHEN** the block menu opens on a callout block
- **THEN** the panel items do NOT include `颜色›` or `翻译`

#### Scenario: Callout block menu has sync block
- **WHEN** the block menu opens on a callout block
- **THEN** the panel items include `同步块` with `LinkRecordOutlined` icon

### Requirement: Default callout inserts with 🎉 + amber background

A newly inserted callout block (via insert menu or slash) SHALL default to emoji 🎉 and background `rgba(242,150,44,.28)`.

#### Scenario: New callout has 🎉 and amber bg
- **WHEN** the user inserts a callout via any entry point
- **THEN** the callout renders with header emoji 🎉 and background `rgba(242,150,44,.28)`

## ADDED Requirements

### Requirement: Callout card supports inline editing without collapsing to source

Editing inside a callout block SHALL keep the card rendered (no collapse to `> [!NOTE]` source). The caret SHALL move freely within the card content. Typing after the last character SHALL continue inside the card.

#### Scenario: Typing in callout keeps card rendered
- **WHEN** the user clicks inside a callout block and types
- **THEN** the callout remains a rendered card; no source markup appears