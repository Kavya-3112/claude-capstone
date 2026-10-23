import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  webServer: [
    {
      // Dev server: no CSP is injected here (inline HMR scripts would be blocked).
      command: 'npx vite --port 5173 --strictPort',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
    },
    {
      // Production build served as static files, with the build-only meta CSP.
      command: 'npm run build && npx vite preview --port 4173 --strictPort',
      url: 'http://localhost:4173',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
  use: { baseURL: 'http://localhost:5173' },
  // F-1 remediation (accessibility-assessment.md): run the existing suite under
  // both Chromium and Firefox so automated evidence (including axe-core) is not
  // collected under a single engine only. This adds the engine dimension only;
  // it does not change any test file, timeout, retry, or webServer behaviour.
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],
});
