/* MD-Bundle Theme Tokens — TypeScript mirror of theme.css */

export const themeTokens = {
  dark: {
    primary: '#165DFF',
    bg: '#0d1117',
    'bg-secondary': '#161b22',
    text: '#e6edf3',
    'text-secondary': '#8b949e',
    border: '#30363d',
    'card-bg': '#161b22',
    'code-bg': '#161b22',
    'primary-fg': '#58a6ff',
    'border-fg': '#30363d',
  },
  light: {
    primary: '#165DFF',
    bg: '#ffffff',
    'bg-secondary': '#f6f8fa',
    text: '#1f2328',
    'text-secondary': '#656d76',
    border: '#d0d7de',
    'card-bg': '#ffffff',
    'code-bg': '#f6f8fa',
    'primary-fg': '#0969da',
    'border-fg': '#d0d7de',
  },
} as const;

export type ThemeName = keyof typeof themeTokens;
export type ThemeTokenNames = keyof (typeof themeTokens)[keyof typeof themeTokens];

export function getThemeColor(
  themeName: ThemeName,
  colorName: ThemeTokenNames,
): string {
  return (themeTokens[themeName] as Record<string, string>)[colorName];
}
