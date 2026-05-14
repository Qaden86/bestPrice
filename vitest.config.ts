import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

/**
 * Vitest configuration
 * - unit + business tests only
 * - crawler aliases
 * - node environment for fs/network logic
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',

    include: ['tests/unit/**', 'tests/business/**'],
    exclude: ['tests/e2e/**', 'tests/header/**'],
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
