import { describe, expect, it } from 'vitest';

import { getTestConfig } from '../../../config/testConfig';

describe('Playwright test configuration', () => {
  it('builds product data from the configured origin and slug', () => {
    const config = getTestConfig({
      BASE_URL: 'https://stage.example.test',
      TEST_ENV: 'stage',
      TEST_PRODUCT_SLUG: 'test-product-42',
    });

    expect(config.productUrl).toBe(
      'https://stage.example.test/produkt/test-product-42',
    );
    expect(config).toMatchObject({ retries: 1, workers: 2 });
  });

  it('applies the production profile', () => {
    expect(getTestConfig({ TEST_ENV: 'prod' })).toMatchObject({
      environment: 'prod',
      retries: 2,
      workers: 1,
      testTimeoutMs: 90_000,
      actionTimeoutMs: 20_000,
      navigationTimeoutMs: 60_000,
    });
  });

  it('supports validated Playwright overrides', () => {
    expect(
      getTestConfig({
        PW_RETRIES: '3',
        PW_WORKERS: '4',
        PW_TEST_TIMEOUT_MS: '45000',
        PW_ACTION_TIMEOUT_MS: '10000',
        PW_NAVIGATION_TIMEOUT_MS: '30000',
      }),
    ).toMatchObject({
      retries: 3,
      workers: 4,
      testTimeoutMs: 45_000,
      actionTimeoutMs: 10_000,
      navigationTimeoutMs: 30_000,
    });
  });

  it.each([
    ['TEST_ENV', 'qa'],
    ['TEST_PRODUCT_SLUG', 'product/with/path'],
    ['PW_RETRIES', '-1'],
    ['PW_WORKERS', '1.5'],
    ['PW_ACTION_TIMEOUT_MS', '500'],
    ['PW_TEST_TIMEOUT_MS', '500'],
  ])('rejects invalid %s', (name, value) => {
    expect(() => getTestConfig({ [name]: value })).toThrow();
  });

  it('requires explicit test data in CI', () => {
    expect(() =>
      getTestConfig({
        CI: 'true',
        BASE_URL: 'https://stage.example.test',
      }),
    ).toThrow('TEST_PRODUCT_SLUG is required in CI');
  });

  it('rejects a test timeout that cannot contain navigation', () => {
    expect(() =>
      getTestConfig({
        PW_TEST_TIMEOUT_MS: '30000',
        PW_NAVIGATION_TIMEOUT_MS: '45000',
      }),
    ).toThrow(
      'PW_TEST_TIMEOUT_MS must be greater than PW_NAVIGATION_TIMEOUT_MS',
    );
  });
});
