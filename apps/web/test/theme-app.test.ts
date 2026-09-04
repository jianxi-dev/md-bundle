// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { themeTokens } from '@md-bundle/editor';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const themesCssPath = resolve(here, '../src/styles/themes.css');
const editorCssPath = resolve(here, '../../../packages/editor/src/theme.css');
const themesCss = readFileSync(themesCssPath, 'utf8');
const editorCss = readFileSync(editorCssPath, 'utf8');

function mdbTokenNames(css: string): string[] {
  return [...new Set([...css.matchAll(/--mdb-[\w-]+/g)].map((m) => m[0]))];
}

function blockTokens(css: string, selector: string): string[] {
  const start = css.indexOf(selector);
  expect(start).toBeGreaterThan(-1);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return mdbTokenNames(css.slice(open, close));
}

function resolveImportTarget(css: string, fromDir: string): string {
  const m = css.match(/@import\s+['"]([^'"]+)['"]/);
  expect(m, 'themes.css must @import the editor token source').toBeTruthy();
  const spec = m![1];
  if (isAbsolute(spec)) return spec;
  if (spec.startsWith('@md-bundle/')) return require.resolve(spec);
  return resolve(fromDir, spec);
}

describe('app theme wiring (themes.css)', () => {
  it('imports the editor token source and it resolves to the real file', () => {
    const target = resolveImportTarget(themesCss, dirname(themesCssPath));
    expect(target).toBe(editorCssPath);
    expect(readFileSync(target, 'utf8')).toBe(editorCss);
  });

  it('every --mdb token in the app surface is defined in editor theme.css', () => {
    const target = resolveImportTarget(themesCss, dirname(themesCssPath));
    const imported = readFileSync(target, 'utf8');
    const appSurface = mdbTokenNames(themesCss).concat(mdbTokenNames(imported));
    const editorTokens = new Set(mdbTokenNames(editorCss));
    for (const token of appSurface) {
      expect(editorTokens.has(token), `${token} must be defined in editor theme.css`).toBe(true);
    }
  });

  it('all theme.ts keys are declared in BOTH data-theme blocks of editor theme.css', () => {
    const dark = themeTokens.dark as Record<string, string>;
    const darkBlock = blockTokens(editorCss, ':root[data-theme="dark"]');
    const lightBlock = blockTokens(editorCss, ':root[data-theme="light"]');
    for (const key of Object.keys(dark)) {
      expect(darkBlock).toContain(`--mdb-${key}`);
      expect(lightBlock).toContain(`--mdb-${key}`);
    }
  });

  it('themes.css wires color-scheme: dark default + per-theme overrides', () => {
    expect(themesCss).toContain(':root:not([data-theme])');
    expect(themesCss).toContain('color-scheme: dark');
    expect(themesCss).toContain(":root[data-theme='light']");
    expect(themesCss).toContain('color-scheme: light');
  });

  it('theme.ts dark/light key sets stay identical at app level', () => {
    expect(Object.keys(themeTokens.dark).sort()).toEqual(
      Object.keys(themeTokens.light).sort(),
    );
  });
});