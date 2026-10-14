import { defineConfig, devices } from '@playwright/test';

// End-to-end tests drive the built app through Nginx against a real gateway, scorer and database: by default
// the whole app at http://localhost:8088. Point E2E_BASE_URL at another deployment to test that one; the
// sign-in comes from E2E_EMAIL and E2E_PASSWORD.
export default defineConfig({
  testDir: 'e2e',
  // One stack, one database: tests run one after another
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  timeout: 60_000,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:8088',
    acceptDownloads: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
