import type { PriceState } from '../types/price';

/**
 * Normalized price parser (NO business logic here)
 */
export function parsePrice(input: unknown): PriceState {
  if (input == null) {
    return { status: 'MISSING', value: null };
  }

  if (typeof input !== 'string' && typeof input !== 'number') {
    return { status: 'INVALID_TYPE', value: null };
  }

  const raw = String(input).trim();

  if (!raw) {
    return { status: 'MISSING', value: null };
  }

  const match = raw.match(/-?\d+([.,]\d+)?/);

  if (!match) {
    return { status: 'NO_NUMBER_FOUND', value: null };
  }

  const value = Number(match[0].replace(',', '.'));

  if (!Number.isFinite(value)) {
    return { status: 'INVALID_NUMBER', value: null };
  }

  return {
    status: 'OK',
    value,
  };
}
