/**
 * Browser integration test for the full crawl pipeline (PDP + cart).
 * Requires Playwright browsers: npx playwright install chromium
 */

import { describe, it, expect } from 'vitest';
import { chromium } from 'playwright';
import { crawl } from '../../crawler/crawl';
import { BASE_URL } from '../../config/env';

const base = BASE_URL.replace(/\/+$/, '');
const SAMPLE_PRODUCT_URL = `${base}/produkt/otvertka-49108-stal-sl5x75`;

describe('crawl integration @integration', () => {
  it('crawls a real product page with matching PDP and cart prices', async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
      const result = await crawl(page, SAMPLE_PRODUCT_URL);

      expect(result).toMatchObject({
        status: 'OK',
        match: true,
        pdpPrice: expect.any(Number),
        cartPrice: expect.any(Number),
      });
    } finally {
      await browser.close();
    }
  }, 120_000);
});
