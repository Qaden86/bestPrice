/**
 * Canonical crawler result and trace types.
 */

export type CrawlStatus = 'OK' | 'FAIL';

export type CrawlReason =
  | 'OK'
  | 'NAVIGATION_FAILED'
  | 'PDP_NOT_FOUND'
  | 'PDP_PRICE_MISSING'
  | 'PDP_PRICE_PARSE_FAILED'
  | 'CART_NOT_READY'
  | 'CART_PRICE_MISSING'
  | 'CART_PRICE_PARSE_FAILED'
  | 'ADD_TO_CART_FAILED'
  | 'PRICE_MISMATCH'
  | 'CRAWL_FAILED'
  | 'INTERNAL_ERROR';

export type TraceStep =
  | 'start'
  | 'navigation'
  | 'pdp.extract'
  | 'cart.click'
  | 'cart.wait'
  | 'cart.extract'
  | 'validation'
  | 'worker'
  | 'error'
  | 'retry';

export type TraceBucket =
  | 'INFRA_FAILURE'
  | 'NAVIGATION_FAILURE'
  | 'DOM_DRIFT'
  | 'EXTRACTION_FAILURE'
  | 'PARSE_ERROR'
  | 'BUSINESS_LOGIC_FAIL'
  | 'VALIDATION_FAIL'
  | 'UNKNOWN';

export type TraceStatus = 'INFO' | 'OK' | 'ERROR';

export type TraceEvent = {
  step: TraceStep;
  status: TraceStatus;
  message?: string;
  data?: unknown;
  bucket?: TraceBucket;
  ts: number;
};

export type CrawlResult = {
  url: string;
  pdpPrice: number | null;
  cartPrice: number | null;
  match: boolean;
  status: CrawlStatus;
  reason: CrawlReason;
  trace: TraceEvent[];
};
