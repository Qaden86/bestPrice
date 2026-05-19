export type CrawlStatus = 'OK' | 'FAIL';

export type CrawlReason =
  | 'OK'
  | 'NAVIGATION_FAILED'
  | 'CART_NOT_READY'
  | 'SELECTOR_NOT_FOUND'
  | 'MISSING_PRICE'
  | 'PRICE_IS_ZERO'
  | 'PRICE_MISMATCH'
  | 'ADD_TO_CART_FAILED'
  | 'CRAWL_FAILED'
  | 'SHUTDOWN'
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
  /** Selector from SELECTORS when reason is SELECTOR_NOT_FOUND */
  selector?: string;
  /** Extra context: pdp | cart | add_to_cart */
  detail?: string;
  screenshot?: string | null;
  trace: TraceEvent[];
};
