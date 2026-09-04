// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getThemeColor, themeTokens } from '../src/theme';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, '../src/theme.css'), 'utf8');

describe('themeTokens', () => {
  it('dark and light have identical key sets', () => {
    expect(Object.keys(themeTokens.dark).sort()).toEqual(
      Object.keys(themeTokens.light).sort(),
    );
  });

  it('both theme token maps are non-empty', () => {
    expect(Object.keys(themeTokens.dark).length).toBeGreaterThan(0);
    expect(Object.keys(themeTokens.light).length).toBeGreaterThan(0);
  });

  it('values differ between themes for at least one token', () => {
    const dark = themeTokens.dark as Record<string, string>;
    const light = themeTokens.light as Record<string, string>;
    const differing = Object.keys(dark).filter((k) => dark[k] !== light[k]);
    expect(differing.length).toBeGreaterThanOrEqual(1);
  });

  it('css contract: every token key appears as --mdb-{key} for both themes', () => {
    const dark = themeTokens.dark as Record<string, string>;
    for (const key of Object.keys(dark)) {
      expect(css).toContain(`--mdb-${key}`);
    }
    expect(css).toContain(':root[data-theme="dark"]');
    expect(css).toContain(':root[data-theme="light"]');
  });

  it('getThemeColor returns expected values', () => {
    expect(getThemeColor('dark', 'primary')).toBe('#165DFF');
    expect(getThemeColor('dark', 'bg')).toBe('#0d1117');
    expect(getThemeColor('light', 'bg')).toBe('#ffffff');
  });

  it('new tokens (3.2) exist in both themes', () => {
    const dark = themeTokens.dark as Record<string, string>;
    const light = themeTokens.light as Record<string, string>;
    const newTokens = [
      'primary-hover',
      'danger',
      'success',
      'warning',
      'selection',
      'focus-ring',
      'shadow',
      'surface',
      'muted',
    ];
    for (const key of newTokens) {
      expect(dark[key]).toBeTruthy();
      expect(light[key]).toBeTruthy();
    }
  });

  it('new tokens (3.2) differ between themes on at least one token', () => {
    const dark = themeTokens.dark as Record<string, string>;
    const light = themeTokens.light as Record<string, string>;
    const newTokens = [
      'primary-hover',
      'danger',
      'success',
      'warning',
      'selection',
      'focus-ring',
      'shadow',
      'surface',
      'muted',
    ];
    const differing = newTokens.filter((k) => dark[k] !== light[k]);
    expect(differing.length).toBeGreaterThanOrEqual(1);
  });

  it('css contract (3.2): new tokens declared in both data-theme blocks', () => {
    const dark = themeTokens.dark as Record<string, string>;
    const newTokens = [
      'primary-hover',
      'danger',
      'success',
      'warning',
      'selection',
      'focus-ring',
      'shadow',
      'surface',
      'muted',
    ];
    for (const key of newTokens) {
      expect(css).toContain(`--mdb-${key}`);
    }
    // every token key (old + new) must appear in BOTH blocks
    const darkBlock = css.slice(
      css.indexOf(':root[data-theme="dark"]'),
      css.indexOf(':root[data-theme="light"]'),
    );
    const lightBlock = css.slice(css.indexOf(':root[data-theme="light"]'));
    for (const key of Object.keys(dark)) {
      expect(darkBlock).toContain(`--mdb-${key}`);
      expect(lightBlock).toContain(`--mdb-${key}`);
    }
  });
});
