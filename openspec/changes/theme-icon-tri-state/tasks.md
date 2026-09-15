## 1. Icon Assets

- [ ] 1.1 Add `themeLight` (sun), `themeDark` (moon), `themeSystem` (existing half-moon) to `ICON` object in `Toolbar.tsx`

## 2. Toolbar Component

- [ ] 2.1 Add `themeProp` prop to `ToolbarProps` interface (`'system' | 'dark' | 'light'`)
- [ ] 2.2 Update `themeBtn` to render icon based on `themeProp` value
- [ ] 2.3 Update `themeBtn` `title` and `aria-label` to reflect current state and next action

## 3. App Integration

- [ ] 3.1 Pass `themePref` from App state to `<Toolbar>` as `themeProp` prop

## 4. Tests

- [ ] 4.1 Add test: light mode renders sun icon
- [ ] 4.2 Add test: dark mode renders moon icon
- [ ] 4.3 Add test: system mode renders half-moon icon
- [ ] 4.4 Add test: icon updates after click triggers prop change

## 5. Verification

- [ ] 5.1 Run `pnpm -r typecheck` — zero errors
- [ ] 5.2 Run `pnpm -r test` — all tests pass
- [ ] 5.3 Run `pnpm -r lint` — zero warnings
