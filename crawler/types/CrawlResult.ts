import { TraceData } from './TraceTypes';
import { TraceBucket } from './TraceBuckets';
import { TraceStep } from './TraceSteps';

/**
 * SINGLE SOURCE OF TRUTH
 *
 * Canonical crawler result model.
 */

export type CrawlStatus =
  | 'OK'
  | 'FAIL';

export type CrawlReason =
  | 'OK'

  // navigation
  | 'NAVIGATION_FAILED'

  // extraction
  | 'PDP_PRICE_MISSING'
  | 'PDP_PRICE_PARSE_FAILED'

  | 'CART_PRICE_MISSING'
  | 'CART_PRICE_PARSE_FAILED'

  // cart
  | 'ADD_TO_CART_FAILED'

  // validation
  | 'PRICE_MISMATCH'

  // system
  | 'CRAWL_FAILED'
  | 'INTERNAL_ERROR';

export type TraceStatus =
  | 'INFO'
  | 'OK'
  | 'ERROR';

export type TraceEvent = {
  step: TraceStep;

  status: TraceStatus;

  message?: string;

  data?: TraceData;

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