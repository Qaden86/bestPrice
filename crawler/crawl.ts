/**
 * CRAWL ORCHESTRATOR (EXECUTION UNIT)
 *
 * This module represents a single-page execution pipeline.
 *
 * IMPORTANT ROLE IN ARCHITECTURE:
 * - It does NOT control concurrency
 * - It does NOT manage queues or workers
 * - It executes business logic for ONE URL only
 *
 * It is called by:
 * - crawlWorker.ts (inside concurrent engine)
 *
 * RESPONSIBILITIES:
 * - navigation
 * - data extraction (PDP + cart)
 * - retry handling
 * - validation
 * - structured logging
 * - failure screenshots
 */

import { Page } from 'playwright';

import { productExtractor } from './extractors/productExtractor';
import { validator } from './validation/validator';
import { retry } from './retry/retry';
import { takeScreenshot } from './utils/screenshot';
import { createLogger } from './utils/logger';

/**
 * Trace event structure used for debugging and observability.
 * This allows reconstructing full execution timeline per URL.
 */
type TraceEvent = {
  step: string;
  status: 'INFO' | 'OK' | 'ERROR';
  message?: string;
  data?: any;
  ts: number;
};

/**
 * Executes full crawling pipeline for a single URL.
 *
 * @param page - Playwright page instance (provided by worker)
 * @param url - Target product URL
 */
export async function crawl(page: Page, url: string) {
  const trace: TraceEvent[] = [];

  // Structured logger writes into trace array
  const logger = createLogger(trace);

  logger.log({
    step: 'start',
    status: 'INFO',
    message: url,
  });

  // ---------------- NAVIGATION ----------------
  // Responsible for loading the page reliably with retry policy
  try {
    await retry(
      () =>
        page.goto(url, {
          waitUntil: 'networkidle',
          timeout: 60000,
        }),
      { retries: 2, delay: 1000 },
    );

    logger.log({
      step: 'navigation',
      status: 'OK',
    });
  } catch (e: any) {
    // Capture screenshot for debugging failed navigation
    const shot = await takeScreenshot(page, 'navigation-failed');

    logger.log({
      step: 'navigation',
      status: 'ERROR',
      message: e.message,
      data: { screenshot: shot },
    });

    return {
      url,
      status: 'ERROR',
      reason: 'NAVIGATION_FAILED',
      trace,
    };
  }

  // ---------------- PDP EXTRACTION ----------------
  // Extract product page price (source of truth)
  const pdpPrice = await productExtractor.extractPdpPrice(page);

  logger.log({
    step: 'pdp.extract',
    status: 'OK',
    data: pdpPrice,
  });

  // ---------------- ADD TO CART ----------------
  // Validates interaction reliability (critical ecommerce flow step)
  let addToCartSuccess = false;

  try {
    addToCartSuccess = await retry(
      () => productExtractor.clickAddToCart(page),
      { retries: 2, delay: 800 },
    );

    logger.log({
      step: 'cart.click',
      status: addToCartSuccess ? 'OK' : 'ERROR',
    });

    // Capture failure state for debugging UI changes or bot blocks
    if (!addToCartSuccess) {
      const shot = await takeScreenshot(page, 'cart-click-failed');

      logger.log({
        step: 'cart.click',
        status: 'ERROR',
        data: { screenshot: shot },
      });
    }
  } catch (e: any) {
    const shot = await takeScreenshot(page, 'cart-click-exception');

    logger.log({
      step: 'cart.click',
      status: 'ERROR',
      message: e.message,
      data: { screenshot: shot },
    });

    return {
      url,
      status: 'ERROR',
      reason: 'ADD_TO_CART_FAILED',
      pdpPrice,
      trace,
    };
  }

  // If interaction failed, stop pipeline early
  if (!addToCartSuccess) {
    return {
      url,
      status: 'ERROR',
      reason: 'ADD_TO_CART_FAILED',
      pdpPrice,
      trace,
    };
  }

  // ---------------- CART EXTRACTION ----------------
  // Extract price from cart modal / sidebar
  const cartPrice = await productExtractor.extractCartPrice(page);

  logger.log({
    step: 'cart.extract',
    status: 'OK',
    data: cartPrice,
  });

  // ---------------- VALIDATION ----------------
  // Business rules validation layer
  const result = validator.validate({
    url,
    pdpPrice,
    cartPrice,
    addToCartSuccess,
  });

  logger.log({
    step: 'validation',
    status: result.status,
    message: result.reason,
  });

  // ---------------- FINAL RESULT ----------------
  // Returns normalized structured output for engine aggregation
  return {
    url,
    pdpPrice,
    cartPrice,
    addToCartSuccess,
    ...result,
    trace,
  };
}
