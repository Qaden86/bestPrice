import { Page } from 'playwright';

import { productExtractor } from './extractors/productExtractor';
import { validator } from './validation/validator';
import { retry } from './retry/retry';
import { takeScreenshot } from './utils/screenshot';
import { createLogger } from './utils/logger';
import { classifyTrace } from './observability/traceClassifier';
import { waitForCartReady } from './utils/cartReady';
import { CrawlResult, TraceEvent } from './types/CrawlResult';

/**
 * CRAWL ORCHESTRATOR
 */
export async function crawl(
  page: Page,
  url: string,
): Promise<CrawlResult> {
  const trace: TraceEvent[] = [];
  const logger = createLogger(trace);

  logger.log({
    step: 'start',
    status: 'INFO',
    message: url,
  });

  // ---------------- NAVIGATION----------------

  try {
    await retry(
      () =>
        page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 45000,
        }),
      {
        retries: 1,
        delay: 500,
      },
    );

    logger.log({
      step: 'navigation',
      status: 'OK',
    });
  } catch (e: any) {
    const shot = await takeScreenshot(page, 'navigation-failed');

    logger.log({
      step: 'navigation',
      status: 'ERROR',
      message: e.message,
      data: { screenshot: shot },
    });

    return {
      url,
      pdpPrice: null,
      cartPrice: null,
      match: false,
      status: 'FAIL',
      reason: 'NAVIGATION_FAILED',
      trace,
    };
  }

  // ---------------- PDP ----------------

  const pdpPrice = await productExtractor.extractPdpPrice(page);

  logger.log({
    step: 'pdp.extract',
    status: pdpPrice != null ? 'OK' : 'ERROR',
    data: pdpPrice,
  });

  // FAIL
  if (pdpPrice == null) {
    return {
      url,
      pdpPrice: null,
      cartPrice: null,
      match: false,
      status: 'FAIL',
      reason: 'PDP_NOT_FOUND',
      trace,
    };
  }

  // ---------------- CART ----------------

  let addToCartSuccess = false;

  try {
    addToCartSuccess = await retry(
      () => productExtractor.clickAddToCart(page),
      { retries: 2, delay: 500 },
    );

    logger.log({
      step: 'cart.click',
      status: addToCartSuccess ? 'OK' : 'ERROR',
    });

    if (!addToCartSuccess) {
      throw new Error('Add to cart failed');
    }

    await waitForCartReady(page);
  } catch (e: any) {
    const shot = await takeScreenshot(page, 'cart-not-ready');

    logger.log({
      step: 'cart.wait',
      status: 'ERROR',
      message: e.message,
      data: { screenshot: shot },
    });

    return {
      url,
      pdpPrice,
      cartPrice: null,
      match: false,
      status: 'FAIL',
      reason: 'CART_NOT_READY',
      trace,
    };
  }

  // ---------------- CART EXTRACT ----------------

  const cartPrice = await productExtractor.extractCartPrice(page);

  logger.log({
    step: 'cart.extract',
    status: cartPrice != null ? 'OK' : 'ERROR',
    data: cartPrice,
  });

  // ---------------- VALIDATION ----------------

  const validation = validator.validate({
    url,
    pdpPrice,
    cartPrice,
    addToCartSuccess,
  });

  logger.log({
    step: 'validation',
    status: validation.status === 'OK' ? 'OK' : 'ERROR',
    message: validation.reason,
    bucket: classifyTrace(validation.reason),
  });

  // ---------------- FINAL RESULT ----------------

  return {
    url,
    pdpPrice,
    cartPrice,
    match: validation.match,
    status: validation.status,
    reason: validation.reason,
    trace,
  };
}