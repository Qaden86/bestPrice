import { describe, it, expect } from 'vitest';
import { parsePriceNumber } from '@crawler/utils/parsePrice';

describe('parsePriceNumber', () => {
  // ----------------------------
  // Basic valid cases
  // ----------------------------

  it('parses simple UAH price with symbol', () => {
    expect(parsePriceNumber('135 ₴')).toBe(135);
  });

  it('parses decimal comma format', () => {
    expect(parsePriceNumber('148,50 ₴')).toBe(148.5);
  });

  it('parses thousands with spaces', () => {
    expect(parsePriceNumber('1 972 ₴')).toBe(1972);
  });

  it('parses thousands with decimals and spaces', () => {
    expect(parsePriceNumber('1 972,50 ₴')).toBe(1972.5);
  });

  it('parses plain numeric string without currency', () => {
    expect(parsePriceNumber('1000')).toBe(1000);
  });

  // ----------------------------
  // Whitespace / formatting edge cases
  // ----------------------------

  it('handles non-breaking spaces', () => {
    expect(parsePriceNumber('1\u00A0500 ₴')).toBe(1500);
  });

  it('handles extra spaces around value', () => {
    expect(parsePriceNumber('   250   ₴   ')).toBe(250);
  });

  it('handles mixed formatting noise', () => {
    expect(parsePriceNumber(' ~ 2 500 грн ')).toBe(2500);
  });

  // ----------------------------
  // Invalid / empty input
  // ----------------------------

  it('returns null for empty string', () => {
    expect(parsePriceNumber('')).toBeNull();
  });

  it('returns null for whitespace only string', () => {
    expect(parsePriceNumber('   ')).toBeNull();
  });

  it('returns null for null input', () => {
    expect(parsePriceNumber(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(parsePriceNumber(undefined)).toBeNull();
  });

  it('returns null for completely invalid string', () => {
    expect(parsePriceNumber('abc xyz')).toBeNull();
  });

  it('returns null for random symbols only', () => {
    expect(parsePriceNumber('!!! ###')).toBeNull();
  });

  // ----------------------------
  // Numeric edge cases
  // ----------------------------

  it('handles number input directly', () => {
    expect(parsePriceNumber(123)).toBe(123);
  });

  it('returns null for NaN', () => {
    expect(parsePriceNumber(Number.NaN)).toBeNull();
  });

  it('returns null for Infinity', () => {
    expect(parsePriceNumber(Infinity)).toBeNull();
  });

  it('handles negative values', () => {
    expect(parsePriceNumber('-100')).toBe(-100);
  });
});