/**
 * ORCHESTRATOR LAYER
 *
 * This module is responsible for controlling the execution flow of the crawl pipeline.
 *
 * It coordinates:
 * - extraction layer (data scraping)
 * - validation layer (business rules)
 * - logging layer (observability / trace)
 *
 */

import { Page } from 'playwright';
import { ProductExtractor } from '../extractors/productExtractor';
import { Validator } from '../validation/validator';
import { TraceLogger } from '../types/trace';

export async function runCrawlFlow(params: {
  page: Page;
  url: string;
  extractor: ProductExtractor;
  validator: Validator;
  logger: TraceLogger;
}) {
  const { page, url, extractor, validator, logger } = params;

  logger.log({ step: 'start', status: 'INFO', data: url });

  await page.goto(url, { waitUntil: 'networkidle' });

  const pdpPrice = await extractor.extractPdpPrice(page);
  logger.log({ step: 'pdp', status: 'OK', data: pdpPrice });

  const addOk = await extractor.clickAddToCart(page);
  logger.log({ step: 'cart.click', status: addOk ? 'OK' : 'ERROR' });

  if (!addOk) {
    return { url, status: 'ERROR', reason: 'ADD_TO_CART_FAILED' };
  }

  const cartPrice = await extractor.extractCartPrice(page);
  logger.log({ step: 'cart.price', status: 'OK', data: cartPrice });

  const result = validator.validate({
    url,
    pdpPrice,
    cartPrice,
    addToCartSuccess: addOk,
  });

  logger.log({ step: 'final', status: result.status, data: result.reason });

  return {
    url,
    pdpPrice,
    cartPrice,
    addToCartSuccess: addOk,
    ...result,
  };
}
