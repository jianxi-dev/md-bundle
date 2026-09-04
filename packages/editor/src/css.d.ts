/* Allow side-effect CSS imports (github-markdown-css, theme.css) under tsc noEmit. */
declare module '*.css';

/* Allow vite `?raw` imports (githubCss.ts inlines the CSS text for export). */
declare module '*?raw';
