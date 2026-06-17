/**
 * Browser integration test for the full crawl pipeline (PDP + cart).
 * Requires Playwright browsers: npx playwright install chromium
 */

import { test, expect } from '@playwright/test';
import { crawl } from '../../crawler/crawl';
import { BASE_URL } from '../../config/env';

const base = BASE_URL.replace(/\/+$/, '');
const SAMPLE_PRODUCT_URL = `${base}/produkt/otvertka-49108-stal-sl5x75`;

test('crawl product page with matching PDP and cart prices', async ({
  page,
}) => {
  const result = await crawl(page, SAMPLE_PRODUCT_URL);

  expect(result).toMatchObject({
    status: 'OK',
    match: true,
    pdpPrice: expect.any(Number),
    cartPrice: expect.any(Number),
  });
});
