import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import playwright from 'eslint-plugin-playwright';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

const typescriptFiles = ['**/*.ts'];
const playwrightTestFiles = [
  'tests/e2e/**/*.spec.ts',
  'tests/header/**/*.spec.ts',
  'tests/integration/**/*.spec.ts',
  'tests/api/**/*.api.spec.ts',
];

export default defineConfig([
  globalIgnores([
    'node_modules/',
    'data/',
    'output/',
    'tmp/',
    'coverage/',
    'dist/',
    'allure-results*/',
    'allure-report*/',
    'playwright-report/',
    'test-results/',
    'dashboard-ui/',
    '.idea/',
  ]),
  {
    files: typescriptFiles,
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: playwrightTestFiles,
    extends: [playwright.configs['flat/recommended']],
    rules: {
      'playwright/missing-playwright-await': 'error',
      'playwright/no-force-option': 'error',
      'playwright/no-wait-for-timeout': 'error',
    },
  },
  prettier,
]);
