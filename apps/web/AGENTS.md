# @md-bundle/web — apps/web

## OVERVIEW
Browser-only React SPA (Vite MPA) for opening, editing, and exporting `.md` and `.mdpkg` files. No backend.

## STRUCTURE
```
src/
  App.tsx          — state machine hub (empty → md | mdpkg | error); last-opened wins via sequence counter
  main.tsx         — mount point
  index.css        — global styles
components/        — 9 thin views: Hero, Gallery, FileOpen, Toolbar, AssetPanel, ValidationPanel, ShareCard, BadgeToast, PreviewView
lib/               — 18 flat modules in 5 domains (document state, assets, exports, badges, share)
styles/themes.css  — editor token bridge (imports @md-bundle/editor/src/theme.css)
test/              — 18 Vitest + 14 Playwright + 8 fixtures
scripts/           — fixture/OG/smoke generators
public/            — examples + seo files
vendor/            — mdpkg-web.js + .d.ts
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Document state machine | `src/App.tsx` | 476-line hub; sequence counter decides last-opened |
| Open/read path | `src/lib/openFile.ts` → `mdpkg.ts` → `useDocument.ts` | Extension + ZIP-magic dispatch; typed vendor wrapper |
| Asset management | `src/lib/assets.ts`, `importImages.ts`, `dataUrl.ts` | paste/drag/select |
| Exports | `src/lib/export.ts`, `exportMdpkg.ts`, `exportHtml.ts`, `exportPng.ts` | .md, .mdpkg, HTML, PNG (SVG-foreignObject); HTML export is async (KaTeX font inlining) |
| Preview | `src/components/PreviewView.tsx` | `renderMarkdown` + `hydrateLazyFeatures` from `@md-bundle/renderer`; wraps in `.preview-content` div with `data-theme` |
| KaTeX fonts | `src/lib/katexFonts.ts` | `getKatexCssInlined()` async cache; `hasKatex()` detection |
| Save routing | `src/lib/save.ts` → `download.ts` | Decide between .md / .mdpkg download |
| Share card | `src/lib/shareCard.ts` | `renderMarkdown` from renderer; `getThemeColor`/`ThemeName` from editor; delegates to exportPng |
| Badges | `src/lib/badges.ts`, `useBadges.ts` | State machine + hook |
| PNG metadata/branding | `src/lib/pngMeta.ts`, `byline.ts` | byline is single source of truth for branding |
| UI components | `src/components/` | Shell (Hero/Gallery/FileOpen), workspace (Toolbar/AssetPanel/ValidationPanel), share/badges (ShareCard/BadgeToast) |

## CONVENTIONS
- **NEVER-throw contract:** every async boundary returns a discriminated-union result (`{ error }` or fallback). Corrupted badge data silently falls back to defaults.
- Pure logic in `lib/`, thin views in `components/`. App.tsx is the only wiring point.
- DI seams for tests: `createCanvas`/`makeImage`/`measureHeight` (exportPng), `copy` (shareCard), `createObjectUrl` (download), `storage` (badges), `confirm` (export).
- Named exports only (App is the sole default export). `import type` with verbatimModuleSyntax.
- Test-facing constants exported: `WARNING_EXPORT_MD`, `DEFAULT_MD_FILENAME`, `MAX_ASSET_BYTES`, `STORAGE_KEY`.
- Chinese task-numbered comments (`任务 3.1`); comments state responsibility + consumers.
- `data-testid` on interactive elements; `role=status` + aria-live for transient messages.
- Image refs always `![name](name.png)` (no `./` prefix); dataURLs always `data:<mime>;base64,<payload>`.

## ANTI-PATTERNS
- **NEVER** edit `vendor/mdpkg-web.js`; update `vendor/mdpkg-web.d.ts` on upstream API change.
- **NEVER** reimplement markdown sanitization (`renderMarkdown` SSOT is `@md-bundle/renderer`) or PNG rasterization (`exportPng`) in this package.
- **NEVER** inject byline into `.mdpkg` bytes; byline only in HTML footer / PNG corner / share card.
- NO `html2canvas` (exportPng is zero-new-deps); no local zip logic.
- **NEVER** throw from open wrappers; deterministic error states only.

## NOTES
- `App.tsx` (476 lines) is the known monolith. Extraction candidates: mdpkg asset extraction, export dispatch, image import handlers.
- Tests importing vendored `mdpkg-web.js` in node env MUST stub `document.createElement` BEFORE dynamic import (see `mdpkg.test.ts` pattern).
- Export tests use jsdom (default vitest env) — no `@vitest-environment node` needed since `@md-bundle/renderer` requires DOMPurify which needs `window`.
- Playwright specs run against dev server (not preview) to allow `await import('/src/lib/exportPng.ts')` in-page for real rasterization.
- Fixtures are generated: `node scripts/gen-fixtures.mjs` + `gen-img-fixtures.mjs` (regenerate, don't hand-edit).
- `themes.css` must import editor tokens via bare specifier `@md-bundle/editor/src/theme.css` (relative cross-package `@import` NOT resolvable by Tailwind v4).

---

Root workspace commands, CI, and monorepo conventions live in `../../AGENTS.md`.
