import { CrawlReason, TraceBucket } from '../types/CrawlResult';

export function classifyTrace(reason: CrawlReason): TraceBucket {
  switch (reason) {
    // infra / network
    case 'NAVIGATION_FAILED':
      return 'NAVIGATION_FAILURE';

    // extraction layer
    case 'PDP_NOT_FOUND':
    case 'PDP_PRICE_MISSING':
    case 'CART_PRICE_MISSING':
      return 'EXTRACTION_FAILURE';

    case 'PDP_PRICE_PARSE_FAILED':
    case 'CART_PRICE_PARSE_FAILED':
      return 'PARSE_ERROR';

    // DOM / selector related (future-proof)
    case 'CRAWL_FAILED':
      return 'DOM_DRIFT';

    // business logic
    case 'PRICE_MISMATCH':
      return 'BUSINESS_LOGIC_FAIL';

    // cart / flow
    case 'ADD_TO_CART_FAILED':
    case 'CART_NOT_READY':
      return 'BUSINESS_LOGIC_FAIL';

    // fallback
    case 'INTERNAL_ERROR':
      return 'INFRA_FAILURE';

    default:
      return 'UNKNOWN';
  }
}