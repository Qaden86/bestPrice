import { describe, it, expect } from 'vitest';
import { pricesMatch } from '@crawler/utils/priceCompare';

describe('pricesMatch', () => {
  it('accepts exact match', () => {
    expect(pricesMatch(135, 135)).toBe(true);
  });

  it('rejects any difference between PDP and cart', () => {
    expect(pricesMatch(135, 148.5)).toBe(false);
    expect(pricesMatch(256, 281.6)).toBe(false);
    expect(pricesMatch(135, 200)).toBe(false);
  });
});
