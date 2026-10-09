import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  globalTimeout: 15 * 60_000,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  webServer: {
    // Enable optional funnel analytics only inside E2E so consent enforcement can be verified.
    command: 'NODE_ENV=test KLAR_TEST_SAFETY_MODE=allow ENABLE_FUNNEL_ANALYTICS=true CONSENT_AUDIT_SECRET=playwright-only-consent-audit-secret-2026-not-for-production npm run dev:lokal',
    url: 'http://127.0.0.1:3000/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

});
