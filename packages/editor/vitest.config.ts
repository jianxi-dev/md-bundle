import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    css: true,
    include: ['test/**/*.test.{ts,tsx}'],
  },
});