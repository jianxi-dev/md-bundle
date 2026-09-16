## ADDED Requirements

### Requirement: Table fills available width

The preview table SHALL fill the full width of its container (`.table-wrap`), regardless of content length. Column widths are distributed by content (default `table-layout: auto`), but the table total width MUST equal 100% of the container.

#### Scenario: Short-content table fills full width
- **WHEN** a markdown table with short cell content is rendered in preview mode
- **THEN** the table width equals 100% of the `.table-wrap` container width

#### Scenario: Long-content table fills full width
- **WHEN** a markdown table with long cell content is rendered in preview mode
- **THEN** the table width equals 100% of the `.table-wrap` container width

### Requirement: Table cell content wraps

The preview table cells (`th`, `td`) SHALL wrap long content within the cell instead of expanding the table width. The wrapping MUST use `overflow-wrap: anywhere` to handle unbreakable strings (long URLs, continuous characters).

#### Scenario: Long URL wraps within cell
- **WHEN** a table cell contains a long URL exceeding the column width
- **THEN** the URL wraps within the cell without expanding the table width

#### Scenario: Continuous characters wrap within cell
- **WHEN** a table cell contains a continuous string of characters exceeding the column width
- **THEN** the string wraps within the cell without expanding the table width

### Requirement: Table container provides horizontal scroll fallback

The `.table-wrap` container SHALL provide `overflow-x: auto` as a fallback for extremely long unbreakable content that cannot wrap even with `overflow-wrap: anywhere`.

#### Scenario: Extremely long unbreakable content triggers scroll
- **WHEN** a table cell contains an extremely long unbreakable string that cannot wrap
- **THEN** the `.table-wrap` container provides horizontal scrolling instead of breaking the page layout

### Requirement: Both light and dark themes apply table width adaptation

The table width adaptation rules (width: 100%, overflow-wrap: anywhere) SHALL apply to both light and dark themes in the preview.

#### Scenario: Light theme table fills width
- **WHEN** a markdown table is rendered in light theme preview
- **THEN** the table width equals 100% of the container and cell content wraps

#### Scenario: Dark theme table fills width
- **WHEN** a markdown table is rendered in dark theme preview
- **THEN** the table width equals 100% of the container and cell content wraps
