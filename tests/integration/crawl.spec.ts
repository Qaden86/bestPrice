/**
 * Browser integration test for the full crawl pipeline (PDP + cart).
 * Requires Playwright browsers: npx playwright install chromium
 */

import { test, expect } from '@playwright/test';
import { crawl } from '../../crawler/crawl';
import { getTestConfig } from '../../config/testConfig';

const { productUrl: SAMPLE_PRODUCT_URL } = getTestConfig();

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
