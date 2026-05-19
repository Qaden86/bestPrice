/**
 * Price extraction result model
 */
export type PriceState =
  | { status: 'OK'; value: number }
  | { status: 'MISSING'; value: null }
  | { status: 'FAILED_PARSE'; value: null };
