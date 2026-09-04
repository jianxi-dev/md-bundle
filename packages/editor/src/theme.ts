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
    'primary-hover': '#3b7bff',
    danger: '#f85149',
    success: '#3fb950',
    warning: '#d29922',
    selection: 'rgba(22, 93, 255, 0.3)',
    'focus-ring': 'rgba(22, 93, 255, 0.4)',
    shadow: 'rgba(0, 0, 0, 0.4)',
    surface: '#21262d',
    muted: '#6e7681',
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
    'primary-hover': '#0e42d2',
    danger: '#cf222e',
    success: '#1a7f37',
    warning: '#9a6700',
    selection: 'rgba(22, 93, 255, 0.18)',
    'focus-ring': 'rgba(22, 93, 255, 0.4)',
    shadow: 'rgba(140, 149, 159, 0.2)',
    surface: '#f6f8fa',
    muted: '#6e7781',
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
