/* MD-Bundle Theme Tokens — TypeScript mirror of theme.css */

export const themeTokens = {
  dark: {
    primary: '#7b86ea',
    bg: '#08090b',
    'bg-secondary': '#0e0f12',
    text: '#f5f6f8',
    'text-secondary': '#858b96',
    border: 'rgba(255,255,255,0.08)',
    'card-bg': '#0e0f12',
    'code-bg': '#0e0f12',
    'primary-fg': '#9aa4f8',
    'border-fg': 'rgba(255,255,255,0.08)',
    'primary-hover': '#6671e0',
    danger: '#f0616d',
    success: '#3fb950',
    warning: '#e3b341',
    selection: 'rgba(123, 134, 234, 0.3)',
    'focus-ring': 'rgba(123, 134, 234, 0.4)',
    shadow: 'rgba(0, 0, 0, 0.5)',
    surface: '#1a1b20',
    muted: '#5d626b',
  },
  light: {
    primary: '#4f5ad1',
    bg: '#ffffff',
    'bg-secondary': '#f0f0f3',
    text: '#191a1e',
    'text-secondary': '#6b6f78',
    border: 'rgba(0,0,0,0.10)',
    'card-bg': '#ffffff',
    'code-bg': '#f0f0f3',
    'primary-fg': '#3d47b8',
    'border-fg': 'rgba(0,0,0,0.10)',
    'primary-hover': '#5a66d8',
    danger: '#cf222e',
    success: '#1a7f37',
    warning: '#9a6700',
    selection: 'rgba(79, 90, 209, 0.18)',
    'focus-ring': 'rgba(79, 90, 209, 0.4)',
    shadow: 'rgba(24, 26, 40, 0.12)',
    surface: '#e9e9ee',
    muted: '#8b8f99',
  },
} as const

export type ThemeName = keyof typeof themeTokens
export type ThemeTokenNames = keyof (typeof themeTokens)[keyof typeof themeTokens]

export function getThemeColor(themeName: ThemeName, colorName: ThemeTokenNames): string {
  return (themeTokens[themeName] as Record<string, string>)[colorName]
}
