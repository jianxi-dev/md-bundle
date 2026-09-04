import { defineConfig } from 'vitest/config';

// Root workspace runner: `vitest run` at the repo root executes every
// package's suite through its own vitest config.
export default defineConfig({
  test: {
    projects: ['apps/web/vitest.config.ts', 'packages/editor/vitest.config.ts'],
  },
});