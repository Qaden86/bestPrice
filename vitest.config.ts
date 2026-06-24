import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',

    include: ['tests/unit/**/*.test.ts'],

    exclude: ['tests/e2e/**', 'tests/header/**', 'tests/integration/**'],

    reporters: [
      'default',
      [
        'allure-vitest/reporter',
        {
          resultsDir: 'allure-results-vitest',
        },
      ],
    ],
  },

  resolve: {
    alias: {
      /**
       * Production-grade aliasing:
       * prevents fragile relative imports like ../../../../
       */
      '@crawler': resolve(__dirname, './crawler'),
      '@tests': resolve(__dirname, './tests'),
    },
  },
});
