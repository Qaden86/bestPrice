import type { PriceState } from '../types/price';

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

  const numeric = raw.replace(/[^\d.,\s-]/g, '').trim();

  if (!numeric) {
    return { status: 'MISSING', value: null };
  }

  const compactNoSpaces = numeric.replace(/\s/g, '');
  const hasDecimalComma = /,\d{1,2}$/.test(compactNoSpaces);

  let normalized: string;

  if (hasDecimalComma) {
    normalized = compactNoSpaces.replace(',', '.');
  } else {
    normalized = numeric.replace(/\s/g, '').replace(/,/g, '');
  }

  const value = Number(normalized);

  if (!Number.isFinite(value)) {
    return { status: 'FAILED_PARSE', value: null };
  }

  return { status: 'OK', value };
}

export function parsePriceNumber(input: unknown): number | null {
  const result = parsePrice(input);
  return result.status === 'OK' ? result.value : null;
}
