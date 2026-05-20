import { CrawlReason, TraceBucket } from '../types/CrawlResult';

export function classifyTrace(reason: CrawlReason): TraceBucket {
  switch (reason) {
    case 'NAVIGATION_FAILED':
    case 'SHUTDOWN':
      return 'NAVIGATION_FAILURE';

    case 'SELECTOR_NOT_FOUND':
      return 'DOM_DRIFT';

    case 'MISSING_PRICE':
      return 'EXTRACTION_FAILURE';

    case 'PRICE_IS_ZERO':
    case 'PRICE_MISMATCH':
      return 'BUSINESS_LOGIC_FAIL';

    case 'ADD_TO_CART_FAILED':
    case 'CART_NOT_READY':
      return 'BUSINESS_LOGIC_FAIL';

    case 'CRAWL_FAILED':
    case 'INTERNAL_ERROR':
      return 'INFRA_FAILURE';

    default:
      return 'UNKNOWN';
  }
}
