import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './test',
  // Vitest owns *.test.ts (mdpkg/openFile/validation) — Playwright only runs *.spec.ts.
  testMatch: /.*\.spec\.ts/,
  // 产物（trace/video/error-context）落在子目录，避免清空 test-results/ 根下提交的 QA 证据。
  outputDir: './test-results/playwright',
  fullyParallel: true,
  // CI：显式钉住并发上限。默认 workers = CPU/2 随 runner 规格浮动，CPU 饱和会直接
  // 拖慢 PNG 光栅化 / mdpkg 打包 / KaTeX 字体内联（P2 #187 的放大因素之一）。
  workers: process.env.CI ? 2 : undefined,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['json', { outputFile: 'test-results/playwright/e2e.json' }]] : 'list',
  // 显式 expect 预算：默认 5s 在 CI 负载下对瞬时元素（badge toast）偏紧，10s 留 2× 余量。
  expect: { timeout: 10_000 },
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