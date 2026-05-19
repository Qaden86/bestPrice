import { Page } from 'playwright';

import { productExtractor } from './extractors/productExtractor';
import { validator, type ValidationFail } from './validation/validator';
import { retry } from './retry/retry';
import { takeScreenshot } from './utils/screenshot';
import { createLogger } from './utils/logger';
import { classifyTrace } from './observability/traceClassifier';
import { waitForCartReady } from './utils/cartReady';
import { dismissOverlays } from './utils/dismissOverlays';
import { CrawlResult, TraceEvent } from './types/CrawlResult';
import { SELECTORS } from './selectors/selectors';
import type { PriceExtraction, AddToCartExtraction } from './types/extraction';

async function fail(
  page: Page,
  base: Omit<CrawlResult, 'screenshot' | 'trace'>,
  trace: TraceEvent[],
  screenshotName: string,
): Promise<CrawlResult> {
  const screenshot = await takeScreenshot(page, screenshotName);
  return { ...base, screenshot, trace };
}

function fromValidation(
  url: string,
  pdp: PriceExtraction,
  cart: PriceExtraction,
  v: ValidationFail,
): Omit<CrawlResult, 'screenshot' | 'trace'> {
  return {
    url,
    pdpPrice: pdp.price,
    cartPrice: cart.price,
    match: false,
    status: 'FAIL',
    reason: v.reason,
    selector: v.selector,
    detail: v.detail,
  };
}

export async function crawl(page: Page, url: string): Promise<CrawlResult> {
  const trace: TraceEvent[] = [];
  const logger = createLogger(trace);

  const emptyCart: PriceExtraction = {
    selector: SELECTORS.cart.price[0],
    selectorFound: false,
    price: null,
  };

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
          waitUntil: 'domcontentloaded',
          timeout: 45000,
        }),
      { retries: 1, delay: 500 },
    );

    await dismissOverlays(page);

    await page
      .waitForSelector(SELECTORS.pdp.price[0], { timeout: 15_000 })
      .catch(() => page.waitForSelector(SELECTORS.pdp.price[1], { timeout: 10_000 }));

    logger.log({ step: 'navigation', status: 'OK' });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);

    logger.log({
      step: 'navigation',
      status: 'ERROR',
      message,
    });

    return fail(
      page,
      {
        url,
        pdpPrice: null,
        cartPrice: null,
        match: false,
        status: 'FAIL',
        reason: 'NAVIGATION_FAILED',
      },
      trace,
      'navigation-failed',
    );
  }

  // ---------------- PDP ----------------

  const pdp = await productExtractor.extractPdpPrice(page);

  logger.log({
    step: 'pdp.extract',
    status: pdp.selectorFound && pdp.price != null ? 'OK' : 'ERROR',
    data: pdp,
  });

  const pdpFail = validator.checkPdp(pdp);
  if (pdpFail) {
    logger.log({
      step: 'validation',
      status: 'ERROR',
      message: pdpFail.reason,
      bucket: classifyTrace(pdpFail.reason),
    });
    return fail(
      page,
      fromValidation(url, pdp, emptyCart, pdpFail),
      trace,
      `validation-${pdpFail.reason.toLowerCase()}`,
    );
  }

  // ---------------- CART ----------------

  const addToCart = await productExtractor.extractAddToCart(page);

  logger.log({
    step: 'cart.click',
    status: addToCart.clicked ? 'OK' : 'ERROR',
    data: addToCart,
  });

  const addFail = validator.checkAddToCart(addToCart);
  if (addFail) {
    logger.log({
      step: 'validation',
      status: 'ERROR',
      message: addFail.reason,
      bucket: classifyTrace(addFail.reason),
    });
    return fail(
      page,
      fromValidation(url, pdp, emptyCart, addFail),
      trace,
      `validation-${addFail.reason.toLowerCase()}`,
    );
  }

  try {
    await waitForCartReady(page);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);

    logger.log({
      step: 'cart.wait',
      status: 'ERROR',
      message,
    });

    return fail(
      page,
      {
        url,
        pdpPrice: pdp.price,
        cartPrice: null,
        match: false,
        status: 'FAIL',
        reason: 'CART_NOT_READY',
      },
      trace,
      'cart-not-ready',
    );
  }

  // ---------------- CART EXTRACT ----------------

  const cart = await productExtractor.extractCartPrice(page);

  logger.log({
    step: 'cart.extract',
    status: cart.selectorFound && cart.price != null ? 'OK' : 'ERROR',
    data: cart,
  });

  // ---------------- VALIDATION ----------------

  const validation = validator.validate({
    url,
    pdp,
    cart,
    addToCart,
  });

  logger.log({
    step: 'validation',
    status: validation.status === 'OK' ? 'OK' : 'ERROR',
    message: validation.reason,
    bucket: classifyTrace(validation.reason),
  });

  const base: Omit<CrawlResult, 'screenshot' | 'trace'> = {
    url,
    pdpPrice: pdp.price,
    cartPrice: cart.price,
    match: validation.match,
    status: validation.status,
    reason: validation.reason,
    selector: validation.status === 'FAIL' ? validation.selector : undefined,
    detail: validation.status === 'FAIL' ? validation.detail : undefined,
  };

  if (validation.status === 'FAIL') {
    return fail(page, base, trace, `validation-${validation.reason.toLowerCase()}`);
  }

  return { ...base, trace };
}

export function shutdownCrawlResult(url: string): CrawlResult {
  return {
    url,
    pdpPrice: null,
    cartPrice: null,
    match: false,
    status: 'FAIL',
    reason: 'SHUTDOWN',
    trace: [],
  };
}
