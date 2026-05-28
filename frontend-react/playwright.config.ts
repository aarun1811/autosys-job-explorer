import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config for end-to-end tests that drive the React dev server
 * against the live rectrace backend on :6088 and live RecViz backend on
 * :8000. Assumes both backends + the Oracle/ES stack are running locally.
 *
 * Run: `pnpm exec playwright test` from frontend-react/.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.RECTRACE_E2E_ORIGIN ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
