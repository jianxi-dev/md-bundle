# editor-design-tokens Specification

## Purpose
TBD - created by archiving change editor-fidelity-2. Update Purpose after archive.
## Requirements
### Requirement: Design token ledger matches prototype token table

The editor SHALL expose a design token ledger (CSS custom properties under `:root` or a theme module) that matches the prototype token table exactly. The ledger SHALL include at minimum:

| Token | Prototype Value | Usage |
|---|---|---|
| `--bg-canvas` / `--paper-bg` | `#212121` (dark) / `#fbfaf8` (light) | Editor & preview canvas background |
| `--surface` / `--surface-2` / `--surface-3` | `#292929` / `#2f2f2f` / `#363636` | Menu, flyout, panel backgrounds |
| `--border` / `--border-soft` | `#35373a` / `#3d3f42` | Handle border, cell borders, dividers |
| `--text` / `--muted` / `--faint` | `#ebebeb` / `#9a9a9a` / `#6f7276` | Primary / secondary / disabled text |
| `--brand` / `--brand-soft` | `#547cff` / `rgba(84,124,255,.18)` | Primary actions, selection highlight |
| `--hover` / `--hover-strong` | `rgba(235,235,235,.08)` / `.14` | Menu item hover, hotspot highlight |
| `--danger` / `--amber` / `--green` | `#f2555a` / `#f2962c` / `#37c05a` | Destructive, warning, success |
| `--radius-xl` / `--radius-lg` / `--radius-md` / `--radius-sm` | `12px` / `8px` / `6px` / `4px` | Panel / menu / item / badge radii |
| `--shadow-elevated` | `rgba(0,0,0,.28) 0 8px 16px` | Menu, flyout, palette shadows |
| `--spacing-unit` | `4px` | Base spacing unit (all spacing = N×4) |
| `--font-size-menu` / `--font-size-item` / `--font-size-icon` | `13px` / `12px` / `18px` | Menu title / item label / icon |
| `--handle-width` / `--handle-height` | `42px` / `26px` | Block handle pill dimensions |
| `--menu-min-width` / `--menu-item-height` | `236px` / `32px` | Block menu dimensions |
| `--palette-item-height` / `--palette-font-size` | `32px` / `12px` | Command palette dimensions |

#### Scenario: Token ledger values match prototype
- **WHEN** the page loads in edit mode
- **THEN** `getComputedStyle(document.documentElement).getPropertyValue('--handle-width')` = `42px`, `--menu-item-height` = `32px`, `--spacing-unit` = `4px`, etc. (all tokens present with prototype values)

#### Scenario: All spacing in UI is multiple of 4px
- **WHEN** any menu, panel, handle, or toolbar is measured
- **THEN** all padding, gap, margin, border-radius values are multiples of 4px

### Requirement: Icon naming convention enforced (data-icon ∈ ICON_MAP)

All SVG icons in the editor SHALL use `data-icon` attribute with values drawn exclusively from the `ICON_MAP` (block-type icons + action icons). No raw characters, no ad-hoc SVG, no non-standard names.

#### Scenario: Every icon element has data-icon from ICON_MAP
- **WHEN** the editor renders any icon (handle, menu, toolbar, palette, table, callout, columns)
- **THEN** the icon element is `<svg data-icon="XxxOutlined" viewBox="0 0 24 24" fill="currentColor">` and `XxxOutlined` ∈ `ICON_MAP` values

#### Scenario: No raw character icons remain
- **WHEN** the editor renders the insert menu, block menu convert grid, or floating toolbar
- **THEN** no item uses a raw character (e.g., `#`, `>`, `*`, `-`, `◫`, `▦`) as its icon

### Requirement: Conformance.json exists and passes cw-tickets-check.sh

The change SHALL produce `openspec/changes/editor-fidelity-2/conformance.json` with:
- Top-level `requirements` array
- Each requirement `{id: "R-<n>", ...}` with ≥1 anchor
- Each anchor `{id: "A-<n>.<m>", assert: "<string with concrete token>", source: "<non-empty>", type: "exact|state-machine|perceptual"}`
- Coverage for: handle 42×26, data-icon names, menu 236/32/10-grid, insert menu /f3 + categorized list + 3 entry points, table hotspot hover-gating + boundary not covering cell center, font A×8 exact colors + bg 16, callout flyout labels unique, palette item 32/12, edit bg === preview bg (state-machine), scroll dismiss (state-machine), leave-stack dismiss (state-machine)

#### Scenario: conformance.json passes machine check
- **WHEN** `python3 -c "import json; json.load(open('openspec/changes/editor-fidelity-2/conformance.json'))"` runs
- **THEN** no JSON parse error; `cw-tickets-check.sh` validates anchors ≥1 per requirement, assert contains concrete token, source non-empty, type valid

### Requirement: Baseline screenshots generated from prototype and hash-locked

The change SHALL include a `baseline/` directory with programmatic screenshots of the prototype (`.lavish/doubao-editor-spec-v2.html`) for: handle, block menu, insert menu, table hotspots, color swatches, callout flyout, command palette, editor canvas. Each screenshot SHALL have a SHA-256 hash recorded in `baseline/manifest.json`.

#### Scenario: Baseline manifest exists with hashes
- **WHEN** `openspec/changes/editor-fidelity-2/baseline/manifest.json` is read
- **THEN** it contains entries for each baseline image with `file`, `sha256`, `sourceUrl`, `timestamp`

#### Scenario: Baseline images match prototype
- **WHEN** the baseline images are visually compared to the prototype
- **THEN** they are pixel-perfect matches (perceptual diff ≤ 0.1%)

### Requirement: E2E assertion skeleton covers token/icon/geometry/hover/state-machine

The change SHALL add `apps/web/test/fidelity/*.spec.ts` with test skeletons (passing or TODO) asserting:
- Token values (computed style equals prototype)
- Icon `data-icon` names (exact match ICON_MAP)
- Geometry (handle 42×26, menu 236×32, palette 32px row)
- Hover gating (hotspots hidden until hover, menu opens on handle hover only)
- State machines (scroll dismiss, leave-stack dismiss, viewport clamp/flip)

#### Scenario: Fidelity test file exists with assertions
- **WHEN** `apps/web/test/fidelity/` is listed
- **THEN** it contains spec files for `handle`, `block-menu`, `insert-menu`, `table`, `color`, `callout`, `palette`, `choreography`, `base-bg` with at least one `test()`/`expect()` per anchor in conformance.json

### Requirement: CW consumer wiring (gitignore + change-workflow.conf)

The change SHALL update:
- `.gitignore` to whitelist `state-coverage.json` (allow commit)
- `.change-workflow.conf` to add `LABEL_UI_SURFACE=ui-surface`, `UI_PATH_GLOB=apps/web/test/fidelity/**/*.spec.ts`, `CMD_FIDELITY=pnpm --filter @md-bundle/web test:e2e --project=chromium --reporter=line`

#### Scenario: gitignore whitelists state-coverage.json
- **WHEN** `.gitignore` is read
- **THEN** it contains `!**/state-coverage.json` (or equivalent whitelist)

#### Scenario: change-workflow.conf has fidelity config
- **WHEN** `.change-workflow.conf` is read
- **THEN** it contains `LABEL_UI_SURFACE`, `UI_PATH_GLOB`, `CMD_FIDELITY` keys with correct values

