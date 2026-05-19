import type { PriceState } from '../types/price';

/**
 * Normalized price parser (no business logic).
 */
export function parsePrice(input: unknown): PriceState {
  if (input == null) {
    return { status: 'MISSING', value: null };
  }

  if (typeof input === 'number') {
    return Number.isFinite(input)
      ? { status: 'OK', value: input }
      : { status: 'FAILED_PARSE', value: null };
  }

  if (typeof input !== 'string') {
    return { status: 'FAILED_PARSE', value: null };
  }

  const raw = input.replace(/\u00A0/g, ' ').trim();

  if (!raw) {
    return { status: 'MISSING', value: null };
  }

  const match = raw.match(/-?\d+([.,]\d+)?/);

  if (!match) {
    return { status: 'FAILED_PARSE', value: null };
  }

  const value = Number(match[0].replace(',', '.'));

  if (!Number.isFinite(value)) {
    return { status: 'FAILED_PARSE', value: null };
  }

  return { status: 'OK', value };
}

/**
 * Convenience for extractors that only need a numeric value or null.
 */
export function parsePriceNumber(input: unknown): number | null {
  const result = parsePrice(input);
  return result.status === 'OK' ? result.value : null;
}
