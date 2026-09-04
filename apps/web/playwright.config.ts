import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './test',
  // Vitest owns *.test.ts (mdpkg/openFile/validation) — Playwright only runs *.spec.ts.
  testMatch: /.*\.spec\.ts/,
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['json', { outputFile: 'test-results/e2e.json' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      // Full Chromium build with new headless mode — avoids the separate
      // headless-shell download (which stalls on some networks).
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
  ],
  // Dev server (not `vite preview`): serves TS modules directly, so specs can
  // `await import('/src/lib/exportPng.ts')` inside the page for real-browser
  // rasterization tests (Task 3.5). Same URL/port as preview — existing specs unaffected.
  webServer: {
    command: 'pnpm --filter @md-bundle/web dev --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});