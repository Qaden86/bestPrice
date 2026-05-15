import { Page } from 'playwright';

import { productExtractor } from './extractors/productExtractor';
import { validator } from './validation/validator';
import { retry } from './retry/retry';
import { takeScreenshot } from './utils/screenshot';
import { createLogger } from './utils/logger';
import { classifyTrace } from './observability/traceClassifier';

import { CrawlResult, TraceEvent } from './types/CrawlResult';

/**
 * CRAWL ORCHESTRATOR
 *
 * Single URL execution unit
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

  // ---------------- NAVIGATION ----------------

  try {
    await retry(
      () =>
        page.goto(url, {
          waitUntil: 'networkidle',
          timeout: 60000,
        }),
      {
        retries: 2,
        delay: 1000,
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

  // ---------------- CART CLICK ----------------

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
  } catch (e: any) {
    const shot = await takeScreenshot(page, 'cart-click-failed');

    logger.log({
      step: 'cart.click',
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
      reason: 'ADD_TO_CART_FAILED',
      trace,
    };
  }

  // ---------------- CART ----------------

  const cartPrice = await productExtractor.extractCartPrice(page, url);

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

  // ---------------- SAFETY GATE ----------------
  if (
    validation.status === 'OK' &&
    (
      pdpPrice == null ||
      cartPrice == null
    )
  ) {
    throw new Error(
      'INTERNAL_ERROR: INVALID_SUCCESS_STATE',
    );
  }

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