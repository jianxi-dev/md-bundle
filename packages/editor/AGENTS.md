# @md-bundle/editor — packages/editor

## OVERVIEW
CodeMirror 6 Markdown editor consumed source-direct by apps/web. Sanitization and preview live in `@md-bundle/renderer`.

## PUBLIC API (the contract)
- `src/index.ts` is the ONLY public entry (`main`/`types` → `./src/index.ts`); NEVER import from deep paths
- Value exports: createMarkdownEditor (CM6 factory), MarkdownEditor (React controlled wrapper), themeTokens + getThemeColor (design tokens), slashKeymap + insertSlashChar + slashMenuApply/Close/SelectNext/SelectPrev + defaultCommands (slash menu)
- Type exports: MarkdownEditorOptions, MarkdownEditorHandle, MarkdownEditorComponentProps, ThemeName, ThemeTokenNames, SlashCommand
- `test/public-api.test.ts` pins the FULL export surface — new exports MUST be added there (curtain test)

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Editor core | src/editor.ts | createMarkdownEditor, options/handle types |
| React wrapper | src/MarkdownEditor.tsx | controlled value/onChange; onMount test seam |
| Slash command menu | src/slash.ts | 330 lines; keymap + menu state |
| Theme tokens | src/theme.ts + src/theme.css | theme.ts as const; theme.css CSS mirror — MUST stay in sync (theme.test.ts enforces) |

## CONVENTIONS
- Sanitization SSOT is now `@md-bundle/renderer` (renderMarkdown + DOMPurify); editor no longer handles preview or sanitization
- No exceptions thrown: slash functions return `boolean` (`false` = menu closed no-op, CM6 keymap falls through); destroy() idempotent-safe; one try/catch swallows jsdom coordsAtPos layout failures only
- Controlled component invariants: onChange fires ONLY on user edits (never mount-time initial value); prop identity changes NEVER remount the editor; setValue no-ops on identical docs (cursor preserved)
- CM6 keymap: slashKeymap() must return Prec.high(...); bindings MUST NOT use a custom `scope` (CM6 default keydown handler only runs 'editor' scope — custom scope makes bindings unreachable)
- Comments in English, explain "why" (ordering constraints, rationale)
- Tests: jsdom + polyfills for requestAnimationFrame/ResizeObserver (CM6 requirement); theme.test.ts opts into node env and reads theme.css from disk; slash tests drive EditorView directly (no DOM events)

## ANTI-PATTERNS
- NEVER export from deep paths (src/editor.ts etc.) — index.ts only
- NEVER reimplement sanitization in consumers (delegate to `@md-bundle/renderer` renderMarkdown)
- NEVER break theme.ts ↔ theme.css key parity (add tokens to BOTH; theme.test.ts enforces)
- NEVER use a custom keymap scope or non-high precedence for slashKeymap
- NEVER throw from public API surface

## NOTES
- No build step: consumed as raw TS source (main/types → src/index.ts); `build` script is tsc --noEmit only
- preview.tsx, githubCss.ts, marked, and github-markdown-css were decommissioned (Wave 1 Task 1.5); preview/sanitization/CSS now lives in `@md-bundle/renderer`
