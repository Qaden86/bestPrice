import { describe, it, expect } from 'vitest';
import { pricesMatch } from '@crawler/utils/priceCompare';

describe('pricesMatch', () => {
  it('accepts exact match', () => {
    expect(pricesMatch(135, 135)).toBe(true);
  });

  it('accepts PDP + 10% VAT gross in cart', () => {
    expect(pricesMatch(135, 148.5)).toBe(true);
    expect(pricesMatch(256, 281.6)).toBe(true);
  });

  it('rejects unrelated prices', () => {
    expect(pricesMatch(135, 200)).toBe(false);
  });
});
