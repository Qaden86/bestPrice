import { describe, expect, it } from 'vitest';

import { getAppConfig, parseBaseUrl } from '../../../config/appConfig';

describe('app configuration', () => {
  it('normalizes the configured URL to its origin', () => {
    expect(parseBaseUrl('https://stage.example.test/')).toBe(
      'https://stage.example.test',
    );
  });

  it('uses the local default when BASE_URL is absent', () => {
    expect(getAppConfig({}).baseUrl).toBe('https://bestprice.com.ua');
  });

  it('requires BASE_URL in CI', () => {
    expect(() => getAppConfig({ CI: 'true' })).toThrow(
      'BASE_URL is required in CI',
    );
  });

  it.each([
    'not-a-url',
    'ftp://example.test',
    'https://example.test/store',
    'https://example.test?source=test',
  ])('rejects an invalid site origin: %s', (value) => {
    expect(() => parseBaseUrl(value)).toThrow();
  });
});
