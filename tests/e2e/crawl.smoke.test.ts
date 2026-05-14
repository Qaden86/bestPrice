/**
 * E2E SMOKE TEST
 *
 * Verifies:
 * - real page navigation
 * - real extraction
 * - cart interaction
 * - validation pipeline
 *
 * This test validates the full crawler system.
 */

import { describe, it, expect } from 'vitest';
import { chromium } from 'playwright';

import { crawl } from '../../crawler/crawl';

describe('crawl e2e smoke', () => {
  it('should successfully crawl real product page', async () => {
    const browser = await chromium.launch({
      headless: true,
    });

    const context = await browser.newContext();

    const page = await context.newPage();

    const result = await crawl(
      page,
      'https://bestprice.com.ua/produkt/otvertka-49108-stal-sl5x75',
    );

    await browser.close();

    // ---------------- ASSERTIONS ----------------

    expect(result.status).toBe('OK');

    expect(result.pdpPrice).not.toBeNull();

    expect(result.cartPrice).not.toBeNull();

    expect(result.priceMatch).toBe(true);
  }, 120000);
});
