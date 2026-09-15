## 1. Wire upstream toZip for `.zip` export

- [ ] 1.1 Replace the `case 'zip'` branch in `App.tsx` `handleExport`: remove the `exportMdpkg(...)` + `downloadBlob(..., 'application/zip')` self-rolled path; assemble a files Map (`document.md` from `activeTab.source` + each asset `name` → `dataUrlToBytes` + `extraFiles`) and call upstream `toZip(files, { readme })`, wrapping the `Uint8Array` in a `Blob` (`application/zip`) handed to `downloadBlob` with filename `${docBase}.zip`.

## 2. Wire upstream toMarkdown for `.md` export

- [ ] 2.1 Replace the `case 'md'` branch in `App.tsx` `handleExport`: remove the `exportMd(activeTab.source, {...})` byte-identical path; assemble the same files Map as zip and call upstream `toMarkdown(files, { include: true })`, handing the returned string to `downloadText` with filename `${docBase}.md`. Keep the image-loss warning (`hasImages` confirm) before the engine call.

## 3. Update export menu labels and entry copy

- [ ] 3.1 In `Toolbar.tsx` `EXPORT_ITEMS`: rename `.md` → `Markdown 单文件 (.md)`, `.mdpkg` → `自包含包 (.mdpkg)`, `HTML` → `网页 (.html)`, `PNG 长图` → `长图 (.png)`, `.zip` → `压缩包 (.zip)`. Keep `Word (.docx)`.
- [ ] 3.2 In `Toolbar.tsx`: update the export button `title`/`aria-label` from `导出` → `导出交付物`; update the mobile `more-menu` section header text from `导出` → `导出交付物`.

## 4. Rewrite tests for real zip/md byte assertions

- [ ] 4.1 Rewrite zip export tests: assert the exported bytes are a valid ZIP (`PK\x03\x04`), contain a `README.md`, contain no `manifest.json`, and (for include-bearing fixtures) have includes expanded. Drop any assertion that zip bytes equal mdpkg bytes.
- [ ] 4.2 Rewrite md export tests: assert the exported text is a single UTF-8 file; for include-bearing fixtures assert includes are inlined; assert the image-loss warning still fires and cancels correctly.
- [ ] 4.3 Update e2e export-menu text assertions (`export-md`, `more-export-md`, `export-zip`, `more-export-zip` testids and visible labels) to match the new copy.

## 5. Sync spec.md and spec.zh.md

- [ ] 5.1 In `openspec/specs/md-bundle-web/spec.md`: update the "Format-driven export" requirement header + first paragraph from five to six formats; ensure the `.md` and `.zip` behavior text matches the delta spec (scenario text already aligned in the delta).
- [ ] 5.2 Mirror the same changes in `openspec/specs/md-bundle-web/spec.zh.md`.

## 6. Add ADR-0003

- [ ] 6.1 Create `docs/adr/0003-export-capability-ownership.md`: record the ownership criterion (cross-tool byte-identical conversion → upstream; rendering/branding/interaction → local), the capability ownership list (md/mdpkg/html/zip/docx upstream; HTML-export/PNG/share-cards/save-routing local; PDF browser-print out-of-scope), the semantic model (保存 = 存取工作文档, 导出 = 生成交付物), and the doc-reference to upstream `packages/mdpkg/docs/md-bundle-integration.md`.

## 7. Verify and close

- [ ] 7.1 Run `pnpm -r typecheck && pnpm -r lint && ppnpm -r test` (unit) and `pnpm --filter @md-bundle/web test:e2e` — all green.
- [ ] 7.2 Confirm `openspec status --change export-deliverables-alignment --json` shows all tasks complete.
