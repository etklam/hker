import { defineConfig, devices } from '@playwright/test';

if (process.env.DIRECTORY_ACCEPTANCE === '1' && process.env.DIRECTORY_E2E_FIXTURE !== '1') throw new Error('Acceptance fixture is required');
const acceptance = process.env.DIRECTORY_ACCEPTANCE === '1';
const baseUrl = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
export default defineConfig({
  testDir: './e2e',
  // Legacy product tests are retained as migration history, outside the active suite.
  testIgnore: '**/legacy/**',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : undefined },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  webServer: {
    command: acceptance ? 'node server.js' : 'npm run dev',
    cwd: acceptance ? '.next/standalone' : undefined,
    env: acceptance ? { HOSTNAME: '127.0.0.1', PORT: new URL(baseUrl).port || '3000' } : undefined,
    url: baseUrl,
    reuseExistingServer: !acceptance && !process.env.CI,
  },
});
