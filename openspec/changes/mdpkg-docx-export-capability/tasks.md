## 1. Re-vendor upstream engine

- [x] 1.1 Per upstream plan `jianxi-dev/mdpkg/plans/mdpkg-docx-export-capability.md`: merge PR #6 (`feat/lenient-open`, docx wave 2/3, v0.3.0.0) into upstream `main` via `gh pr merge 6 --merge` (matches repo merge-commit convention) — if not permitted, fall back to building from PR #6 head commit as-is; then in a FRESH temp clone/worktree (NEVER touch `/Users/mason/ToHighs/mdpkg` working tree — it has uncommitted work; read `docs/agents/incident-uncommitted-work-loss.md` first), run upstream's `build:web` (esbuild ESM + IIFE, output `packages/mdpkg/web/mdpkg-web.js`), verify the built bundle contains `toDocx` + wave 2/3 markers, run upstream docx tests (target 281), and byte-replace `apps/web/vendor/mdpkg-web.js` with the ESM build (do NOT hand-edit); record the exact upstream commit hash
- [x] 1.2 Record the pinned upstream commit (header comment in `apps/web/vendor/mdpkg-web.d.ts` and/or a docs note) so the vendored version is traceable

## 2. Align type declarations

- [x] 2.1 Update `apps/web/vendor/mdpkg-web.d.ts` to declare the upstream web entry's new exports: `toDocx(files: Map<string, Uint8Array>, opts?: DocxOptions, onWarning?: (msg: string) => void): Uint8Array`, `DocxOptions` (`symbols?`, `imageWidthEmu?`, `imageHeightEmu?`), plus `toZip`/`toMarkdown` and `ZipExportOptions`/`MarkdownExportOptions` types (declared only, not wired) — mirroring upstream `packages/mdpkg/web/mdpkg-web.ts`
- [x] 2.2 Verify `pnpm --filter @md-bundle/web typecheck` passes with the updated declarations (existing modules unaffected)

## 3. Rewrite exportDocx as upstream thin wrapper

- [x] 3.1 Rewrite `apps/web/src/lib/exportDocx.ts`: keep `ExportDocxOptions` (`markdown/title/assets/download/filename`) and `exportDocx(opts)` signature plus `DEFAULT_DOCX_FILENAME`; strip YAML frontmatter; assemble a files `Map` (`document.md` from markdown bytes + each asset `name` → `dataUrlToBytes`); call upstream `toDocx(files, { symbols: true }, onWarning?)`; wrap the `Uint8Array` in a `Blob` (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`) and hand it to the injected `download` seam; never throw across the wrapper (`{ error }`-style deterministic path; catch unexpected errors and return/surface them)
- [x] 3.2 Remove the now-dead internal `buildDocxDocument` export and the hand-rolled `parseMarkdown`/`parseInline`/`inlineToRuns`/`blockToParagraphs` parsers; ensure `lib/mdpkg.ts` and other modules keep compiling (grep for stale imports of removed symbols)

## 4. Rewrite tests for real docx bytes

- [x] 4.1 Rewrite `apps/web/test/exportDocx.test.ts`: assert the exported bytes are a valid ZIP (`PK\x03\x04` magic), contain `[Content_Types].xml` and `word/document.xml`, contain a `word/media/` entry when an image asset is present, produce a valid non-empty docx from empty markdown, honor the `filename` option/default, and exercise frontmatter stripping; reuse the existing `document.createElement` stub pattern from `mdpkg.test.ts`/`exportMdpkg.test.ts` for the vendored bundle in node env; drop all `Packer`/`buildDocxDocument` references
- [x] 4.2 Run `pnpm --filter @md-bundle/web test` — all unit suites green (existing docx tests replaced, no other suite regressed)

## 5. Remove docx dependency and verify the workspace

- [x] 5.1 Remove `docx` (`^9.7.1`) from `apps/web/package.json` and update the lockfile (`pnpm install`); grep the repo to confirm no remaining `from 'docx'` imports
- [x] 5.2 Run full verification: `pnpm -r build` + `pnpm -r test` + `pnpm -r typecheck` + `pnpm -r lint` all pass

## 6. Sync spec to main + UI copy

- [x] 6.1 After implementation passes review, apply the delta spec to `openspec/specs/md-bundle-web/spec.md` (five export formats incl. Word `.docx`, docx scenarios incl. SVG degradation and deterministic failure; hero format-range line `md·Word·HTML·PNG`) and mirror the corresponding sections in `spec.zh.md`
- [x] 6.2 Grep `apps/web/src` (Landing.tsx and elsewhere) for the hero format-range copy (`导出 md·HTML·PNG` or equivalent); if the literal string exists, update it to include Word (`.docx`) and adjust any related Playwright assertions/selectors that reference the old copy

## 7. Sync stale tracking docs

- [x] 7.1 Update `docs/agents/defect-status-report.md` (lines ~130-134) and `docs/agents/bug-registry-260907.md` (Bug #1 "导出不支持 docx") to reflect docx export being implemented via the upstream engine (and close/link GitHub issue `jianxi-dev/md-bundle#1` via `gh` if applicable), keeping the triage label conventions in `docs/agents/triage-labels.md`

## 8. E2E smoke

- [x] 8.1 Run `pnpm --filter @md-bundle/web test:e2e` — existing specs (export menu, toolbar, diag-export) stay green with the updated copy in 6.2; docx item remains selectable via `export-docx`/`more-export-docx` testids