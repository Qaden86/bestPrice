import { describe, it, expect } from 'vitest';
import { parsePriceNumber } from '@crawler/utils/parsePrice';

describe('parsePriceNumber', () => {
  it('parses simple UAH', () => {
    expect(parsePriceNumber('135 ₴')).toBe(135);
  });

  it('parses decimal comma', () => {
    expect(parsePriceNumber('148,50 ₴')).toBe(148.5);
  });

  it('parses thousands with spaces', () => {
    expect(parsePriceNumber('1 972 ₴')).toBe(1972);
    expect(parsePriceNumber('1 972,50 ₴')).toBe(1972.5);
  });
});
