import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',

  testMatch: [
    'e2e/**/*.spec.ts',
    'header/**/*.spec.ts',
    'integration/**/*.spec.ts',
  ],

  reporter: [['list'], ['allure-playwright']],

  use: {
    baseURL: 'https://bestprice.com.ua/',
    headless: true,
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
