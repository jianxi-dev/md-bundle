## MODIFIED Requirements

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
