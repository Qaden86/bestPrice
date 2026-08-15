/**
 * Crawler pipeline smoke (live site).
 *
 * CI-stable mode (default): navigation + PDP extraction + cart flow attempted.
 * Strict mode (CRAWL_SMOKE_STRICT=true): full OK with matching cart price.
 */

import { test, expect } from '@playwright/test';
import { chromium } from 'playwright';
import { crawl } from '../../crawler/crawl';
import type { CrawlResult } from '../../crawler/types/CrawlResult';
import { getTestConfig } from '../../config/testConfig';

const { productUrl: SMOKE_PRODUCT_URL } = getTestConfig();

const strictSmoke = process.env.CRAWL_SMOKE_STRICT === 'true';

function assertPipelineContract(result: CrawlResult): void {
  expect(result.url).toBe(SMOKE_PRODUCT_URL);
  expect(result.status).toMatch(/^(OK|FAIL)$/);
  expect(result.reason).toBeTruthy();
  expect(Array.isArray(result.trace)).toBe(true);

  expect(
    result.trace.some((t) => t.step === 'navigation' && t.status === 'OK'),
  ).toBe(true);
  expect(result.trace.some((t) => t.step === 'pdp.extract')).toBe(true);
  expect(result.pdpPrice).not.toBeNull();
  expect(result.trace.some((t) => t.step === 'cart.click')).toBe(true);
}

function assertStrictSuccess(result: CrawlResult): void {
  expect(result.status).toBe('OK');
  expect(result.cartPrice).not.toBeNull();
  expect(result.match).toBe(true);
  expect(result.trace.some((t) => t.step === 'cart.extract')).toBe(true);
  expect(result.trace.some((t) => t.step === 'validation')).toBe(true);
}

test('crawl e2e smoke', async () => {
  test.setTimeout(120_000);

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const result = await crawl(page, SMOKE_PRODUCT_URL);

    assertPipelineContract(result);

    if (strictSmoke) {
      assertStrictSuccess(result);
    } else if (result.status === 'FAIL') {
      await test.info().attach('crawl-fail-reason', {
        body: JSON.stringify(
          { reason: result.reason, trace: result.trace },
          null,
          2,
        ),
        contentType: 'application/json',
      });
    }
  } finally {
    await browser.close();
  }
});
