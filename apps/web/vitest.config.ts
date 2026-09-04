import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'test/**/*.test.{ts,tsx}'],
    // Playwright specs live in test/ (*.spec.ts) — the *.test.ts include pattern keeps them out of Vitest.
    exclude: ['node_modules/**', 'dist/**'],
    // 只处理 github-markdown-css：exportHtml 的 `?raw` 导入需要真实 CSS 文本
    // （css:false 默认会把 *.css?raw stub 成空串）。Tailwind 的 index.css 不在此列
    // —— vitest 配置没有 @tailwindcss/vite 插件，处理它会失败。
    css: { include: [/github-markdown-css/] },
  },
});