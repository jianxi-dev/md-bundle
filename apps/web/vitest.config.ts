import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Playwright specs live in test/ — keep them out of Vitest.
    exclude: ['test/**', 'node_modules/**', 'dist/**'],
  },
});