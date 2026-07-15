import { defineConfig, devices } from '@playwright/test';
import { getTestConfig } from './config/testConfig';

const testConfig = getTestConfig();

export default defineConfig({
  testDir: './tests',

  testMatch: [
    'e2e/**/*.spec.ts',
    'header/**/*.spec.ts',
    'integration/**/*.spec.ts',
  ],

  reporter: [['list'], ['allure-playwright']],

  retries: testConfig.retries,
  workers: testConfig.workers,

  use: {
    baseURL: testConfig.baseUrl,
    headless: true,
    actionTimeout: testConfig.actionTimeoutMs,
    navigationTimeout: testConfig.navigationTimeoutMs,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
