/**
 * E2E SMOKE TEST
 *
 * Verifies full crawler pipeline:
 * - real page navigation
 * - PDP price extraction
 * - Cart price extraction
 * - validation engine correctness
 * - final structured result shape
 *
 * NOTE:
 * This is NOT a UI test.
 * This is a crawler system integrity test.
 */

import { test, expect } from '@playwright/test';
import { chromium } from 'playwright';
import { crawl } from '../../crawler/crawl';

test('crawl e2e smoke', async () => {
  const browser = await chromium.launch({ headless: true });

  const context = await browser.newContext();
  const page = await context.newPage();

  const result = await crawl(
    page,
    'https://bestprice.com.ua/produkt/otvertka-49108-stal-sl5x75',
  );

  await browser.close();

  expect(result.status).toBe('OK');

  expect(result.pdpPrice).not.toBeNull();
  expect(result.cartPrice).not.toBeNull();

  expect(result.trace?.some((t) => t.step === 'pdp.extract')).toBe(true);
  expect(result.trace?.some((t) => t.step === 'cart.extract')).toBe(true);
  expect(result.trace?.some((t) => t.step === 'validation')).toBe(true);
}, 120000);
