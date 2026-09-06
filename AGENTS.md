# PROJECT KNOWLEDGE BASE

**Generated:** 2026-09-06
**Commit:** (Wave 6 doc finalization)
**Branch:** feat/layout-v2

## OVERVIEW

Browser-only web tool for opening, editing, and exporting `.md` files and self-contained `.mdpkg` Markdown packages. pnpm monorepo, TypeScript + React 18 + Vite + Vitest + Playwright. Pure frontend, no backend, no CLI.

## STRUCTURE

```
md-bundle/
├── apps/web/                  # Vite + React app (the user-facing product)
├── packages/editor/           # Shared editor component library
├── packages/renderer/         # Shared markdown rendering (renderMarkdown, readerCssText, hydrateLazyFeatures)
├── openspec/                  # Product spec and change records
├── .github/workflows/         # CI (ci.yml, pages.yml)
├── package.json               # Workspace root scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── eslint.config.js
├── vitest.config.ts
├── vercel.json
├── .prettierrc.json
├── *.md / *.png               # Chinese design/market docs (non-code clutter)
└── .omo/                      # Agent workspace — 94 session JSON files (operational noise, ignore)
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Web app product code | `apps/web/` | Vite MPA, React entry at `src/App.tsx` |
| Editor library | `packages/editor/` | Barrel entry `src/index.ts` |
| Renderer library | `packages/renderer/` | Barrel entry `src/index.ts` (renderMarkdown, readerCssText, calloutTypeMap, hydrateLazyFeatures) |
| Workspace orchestration | Root `package.json` scripts | `build`, `test`, `typecheck`, `lint`, `format` |
| Shared TS/ESLint/Prettier config | Root configs | Single source of truth |
| CI pipeline | `.github/workflows/` | ci.yml (build+test+typecheck+lint), pages.yml (GH Pages deploy) |
| Product specification | `openspec/specs/md-bundle-web/spec.md` | |
| Deployment | `vercel.json` + `.github/workflows/pages.yml` | Dual deploy: GH Pages + Vercel |
| Architecture decisions | `docs/adr/` | ADR-0001 (naming), ADR-0002 (editing paradigm + shared renderer) |

## CODE MAP

| Symbol | Type | Location | Refs | Role |
|--------|------|----------|------|------|
| `App.tsx` | Component | `apps/web/src/App.tsx` | 22 importers | Hub component, app state machine |
| `lib/assets.ts` | Module | `apps/web/src/lib/assets.ts` | 15 importers | Shared asset model |
| `lib/save.ts` | Module | `apps/web/src/lib/save.ts` | 7 importers | Save logic |
| `lib/badges.ts` | Module | `apps/web/src/lib/badges.ts` | 7 importers | Badge state machine + persistence |
| `lib/fsa.ts` | Module | `apps/web/src/lib/fsa.ts` | 5 importers | FSA capability layer (Chromium-only progressive enhancement) |
| `lib/sessionStore.ts` | Module | `apps/web/src/lib/sessionStore.ts` | 3 importers | IndexedDB session persistence |
| `lib/shareLink.ts` | Module | `apps/web/src/lib/shareLink.ts` | 2 importers | Invite link build/parse (?ref=invite&by=<nickname>) |
| `lib/nicknames.ts` | Module | `apps/web/src/lib/nicknames.ts` | 3 importers | Random nickname generator (injectable RNG) |
| `lib/themePreference.ts` | Module | `apps/web/src/lib/themePreference.ts` | 4 importers | Theme tri-state (system/dark/light) |
| `editor/theme.ts` | Module | `packages/editor/src/theme.ts` | ~21 importers | Dependency leaf (slash/preview/editor) |
| `editor/slash.ts` | Module | `packages/editor/src/slash.ts` | 24 re-exports via barrel | Highest re-export fan-in |
| `editor/getThemeColor` | Function | `packages/editor/src/theme.ts` | 16 callers | Theme color accessor |

**Entry chains:**
- Web app: `apps/web/index.html` → `src/main.tsx` → `src/App.tsx`
- Editor barrel: `packages/editor/src/index.ts` (ONLY public entry point)
- Renderer barrel: `packages/renderer/src/index.ts` (renderMarkdown, readerCssText, hydrateLazyFeatures, calloutTypeMap)

**Vendored engine:** `apps/web/vendor/mdpkg-web.js` (749KB, from jianxi-dev/mdpkg). Everything else wraps this.

## CONVENTIONS

- pnpm workspace, package scope `@md-bundle/*`. Cross-package imports via package name only (`@md-bundle/editor` via `workspace:*`), never relative paths across `apps/` ↔ `packages/`
- Workspace packages consumed source-direct: `main`/`types` → `./src/index.ts`, no build step between packages
- Single root shared config: `tsconfig.base.json` (strict, ES2022, moduleResolution bundler, noEmit, verbatimModuleSyntax, noUnusedLocals/Parameters), one root `eslint.config.js` flat (react-hooks, react-refresh, `argsIgnorePattern: '^_'`), root `.prettierrc.json` (no semi, single quote, width 100, trailing all). Vitest per-package but aggregated at root via `projects`
- NO path aliases anywhere — relative imports + package names only
- Test split by extension: `*.test.{ts,tsx}` = Vitest unit, `*.spec.ts` = Playwright e2e (enforced in configs)
- Vite MPA (`appType: 'mpa'`) with relative `base: './'` — same build works on GitHub Pages project page, domain root, Vercel. Entries: index, spec, about, examples/* (SEO pages)
- `apps/web/test-results/*.json` evidence files are COMMITTED (gitignore whitelists them); never `git restore` the whole test-results dir
- Playwright specs run against the dev server (not preview) so they can `await import('/src/lib/*.ts')` in-page

## ANTI-PATTERNS (THIS PROJECT)

- **NEVER** throw across open/save/export wrappers — deterministic `{ error }` result objects are the contract (spec: "MUST NOT crash or render a white screen")
- **NEVER** reimplement markdown sanitization — `@md-bundle/renderer` `renderMarkdown` is the single source of truth. Never reimplement PNG rasterization helpers (delegate to `lib/exportPng`)
- **NEVER** edit `apps/web/vendor/mdpkg-web.js` (byte-identical upstream bundle). Update `vendor/mdpkg-web.d.ts` on upstream API change
- **NEVER** modify the mdpkg manifest schema (closed `additionalProperties: false`). No local zip shim — reuse vendored `packMdpkg`
- **NEVER** inject byline/branding into `.mdpkg` file bytes (footer/PNG/share-card only)
- **NEVER** preset system directories (desktop/downloads/documents enumeration is forbidden) — FSA folder workspace is user-authorized only, Chromium-only progressive enhancement; non-FSA = v1-equivalent experience
- **NEVER** carry document payload in share links — invite links contain only `?ref=invite&by=<nickname>` (no lz-string, no document bytes, no server storage)
- No private markdown syntax. No third-party analytics. No backend/accounts/cloud/share-links/achievement persistence. No pure-WYSIWYG (milkdown/TipTap) — product OUT list
- Zero TODO/FIXME/HACK/placeholder/console.log and zero `as any`/`@ts-ignore`/`@ts-expect-error` in project code (enforced DEAD-CODE gate)

## UNIQUE STYLES

- Comments in Chinese in `apps/web` (task-numbered headers like `任务 3.1`), English in `packages/editor`
- Dependency-injection seams for tests (createCanvas/makeImage/copy/storage/confirm injectable; `randomNickname(rng?)`/`pickTemplate(rng?)` injectable RNG for deterministic share-card tests)
- `data-testid` on all interactive elements; `role=status`/`aria-live` for transient messages
- Tests write JSON evidence to `test-results/`; Playwright evidence specs use serial mode
- Vendored bundle referenced at top level of modules needs a `document.createElement` stub before dynamic import in node-env tests

## COMMANDS

```bash
pnpm install                 # install (CI: --frozen-lockfile)
pnpm -r build                # web: tsc --noEmit && vite build (MPA); editor: tsc --noEmit
pnpm -r test                 # Vitest unit suites (both packages); NOT e2e
pnpm --filter @md-bundle/web test:e2e   # Playwright e2e (dev server :4173)
pnpm -r typecheck
pnpm -r lint
pnpm format                  # prettier --write .
pnpm --filter @md-bundle/web dev         # Vite dev server
```

## NOTES

- mdpkg format engine vendored from upstream repo `jianxi-dev/mdpkg` (not in this monorepo)
- Dual deploy: GitHub Pages (pages.yml, primary) + Vercel (vercel.json, /spec + /about rewrites)
- Node >=22, pnpm pinned 10.32.1 via packageManager field; `pnpm.onlyBuiltDependencies: ["esbuild"]`
- `packages/editor/src/slash.ts` keymap must NOT use a custom CM6 `scope` (unreachable) — see package doc
- FSA degradation: `isFsaAvailable()` requires all three pickers (`showDirectoryPicker`/`showSaveFilePicker`/`showOpenFilePicker`); missing any → feature hidden, main flow stays v1-equivalent
- Invite link validation: `parseInviteParams()` returns `null` for malformed `ref`/`by` → falls back to normal landing page (no error)

## Agent skills

### Issue tracker

Issue 和 spec 统一以 GitHub issue 形式存在于 `jianxi-dev/md-bundle`。使用 `gh` CLI 进行创建、查看、列表、评论、标签和关闭操作。详见 `docs/agents/issue-tracker.md`。

### Triage labels

使用 5 个 canonical 标签：`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`。详见 `docs/agents/triage-labels.md`。

### Domain docs

单上下文仓库：探索前阅读根目录 `CONTEXT.md`（若不存在则以 `AGENTS.md` 替代）和 `docs/adr/`。详见 `docs/agents/domain.md`。
