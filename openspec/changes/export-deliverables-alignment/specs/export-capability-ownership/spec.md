## ADDED Requirements

### Requirement: Export capability ownership boundary

The system SHALL own format-conversion exports (md/mdpkg/html/zip/docx) through the upstream mdpkg engine when the conversion MUST produce byte-identical results across CLI and Web entry points. The system SHALL own rendering/branding/interaction exports (HTML export via `@md-bundle/renderer`, PNG long-image, share cards, save routing, download triggers, menu UI, warning copy) locally. PDF SHALL fall back to browser print and SHALL NOT be provided as an export capability.

#### Scenario: Format conversion delegates to upstream engine
- **WHEN** the user exports to `.md`/`.mdpkg`/`.zip`/`.docx`
- **THEN** the system assembles a files Map (entry document + asset raw bytes + extraFiles) and delegates to the upstream engine (`toMarkdown`/`packMdpkg`/`toZip`/`toDocx`), wrapping only error handling and download triggering locally

#### Scenario: Rendering export stays local
- **WHEN** the user exports to HTML or PNG long-image
- **THEN** the system uses the local `@md-bundle/renderer` pipeline with theme resolution and byline branding, NOT the upstream engine's `toHtml`

#### Scenario: PDF is out of scope
- **WHEN** the user requests PDF export
- **THEN** the system offers browser print (`window.print()`) and SHALL NOT add PDF to the export menu

#### Scenario: New export format ownership is decided by criterion
- **WHEN** a new export format is proposed
- **THEN** the ownership decision follows the ADR-0003 criterion (cross-tool byte-identical conversion → upstream; rendering/branding/interaction → local) and is recorded in the ADR ownership list
