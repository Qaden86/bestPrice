import { test, expect } from '@playwright/test';
import {
  formatSitemapFailureMessage,
  runSitemapPriceCheck,
} from '../../crawler/sitemap/runSitemapPriceCheck';

test.describe('Sitemap @smoke', () => {
  test.setTimeout(15 * 60 * 1000);

  test('product pages expose a positive JSON-LD offer price', async () => {
    const summary = await runSitemapPriceCheck();

    expect(summary.failures, formatSitemapFailureMessage(summary)).toEqual([]);
  });
});

test.describe('Sitemap @regression', () => {
  test.skip(
    () => process.env.SITEMAP_FULL !== '1',
    'Set SITEMAP_FULL=1 to run the full sitemap price check',
  );

  test.setTimeout(60 * 60 * 1000);

  test('every product in sitemap exposes a positive JSON-LD offer price', async () => {
    const summary = await runSitemapPriceCheck({ limit: null });

    expect(summary.failures, formatSitemapFailureMessage(summary)).toEqual([]);
  });
});
