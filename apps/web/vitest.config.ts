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
  },
});