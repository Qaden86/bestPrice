import { defineConfig } from '@playwright/test';

const baseURL = process.env.API_BASE_URL ?? 'http://127.0.0.1:3100';
const parsedBaseURL = new URL(baseURL);
const startLocalServer = process.env.API_START_SERVER !== 'false';

if (parsedBaseURL.protocol !== 'http:' && parsedBaseURL.protocol !== 'https:') {
  throw new Error('API_BASE_URL must use http or https');
}

if (startLocalServer && !parsedBaseURL.port) {
  throw new Error(
    'API_BASE_URL must include a port when starting the local server',
  );
}

export default defineConfig({
  testDir: './tests/api',
  testMatch: '**/*.api.spec.ts',
  reporter: [['list'], ['allure-playwright']],
  timeout: 15_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL,
  },
  webServer: startLocalServer
    ? {
        command: 'tsx dashboard/server.ts',
        url: `${baseURL}/api/runs/active`,
        reuseExistingServer: false,
        timeout: 15_000,
        env: {
          DASHBOARD_HOST: parsedBaseURL.hostname,
          DASHBOARD_PORT: parsedBaseURL.port,
          BESTPRICE_DATA_DIR: `${process.cwd()}/tests/api/fixtures/dashboard-state`,
        },
      }
    : undefined,
});
