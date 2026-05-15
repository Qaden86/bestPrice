/**
 * TRACE ERROR CLASSIFICATION
 *
 * Used for:
 * - observability
 * - dashboard analytics
 * - debugging
 * - failure grouping
 */

export type TraceErrorType =
  | 'NAVIGATION_TIMEOUT'
  | 'NAVIGATION_FAILED'
  | 'SELECTOR_NOT_FOUND'
  | 'ELEMENT_NOT_VISIBLE'
  | 'EXTRACTION_NULL'
  | 'INVALID_PRICE_FORMAT'
  | 'CLICK_BLOCKED'
  | 'VALIDATION_FAILED'
  | 'UNKNOWN_ERROR';

/**
 * Structured trace payload
 */
export type TracePayload = {
  errorType?: TraceErrorType;

  screenshot?: string;

  selector?: string;

  rawValue?: unknown;

  normalizedValue?: number | null;

  retryAttempt?: number;

  stack?: string;
};