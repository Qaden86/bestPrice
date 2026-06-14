import { describe, it, expect } from 'vitest';
import { normalizePrice } from '@crawler/utils/normalizePrice';

describe('normalizePrice', () => {
  // ----------------------------
  // Numeric input
  // ----------------------------

  it('keeps integer number as is', () => {
    expect(normalizePrice(100)).toBe(100);
  });

  it('rounds float to 2 decimals', () => {
    expect(normalizePrice(100.126)).toBe(100.13);
  });

  it('handles negative numbers', () => {
    expect(normalizePrice(-50)).toBe(-50);
  });

  it('returns null for NaN', () => {
    expect(normalizePrice(Number.NaN)).toBeNull();
  });

  it('returns null for Infinity', () => {
    expect(normalizePrice(Infinity)).toBeNull();
  });

  // ----------------------------
  // String formats
  // ----------------------------

  it('parses simple numeric string', () => {
    expect(normalizePrice('100')).toBe(100);
  });

  it('parses spaced thousands format', () => {
    expect(normalizePrice('1 500')).toBe(1500);
  });

  it('parses comma decimal format', () => {
    expect(normalizePrice('100,50')).toBe(100.5);
  });

  it('parses dot decimal format', () => {
    expect(normalizePrice('100.50')).toBe(100.5);
  });

  it('removes currency symbols', () => {
    expect(normalizePrice('100 ₴')).toBe(100);
  });

  it('handles mixed currency text', () => {
    expect(normalizePrice('~ 2 500 грн')).toBe(2500);
  });

  it('handles NBSP spaces', () => {
    expect(normalizePrice('1\u00A0500')).toBe(1500);
  });

  // ----------------------------
  // Fallback / garbage input
  // ----------------------------

  it('returns null for empty string', () => {
    expect(normalizePrice('')).toBeNull();
  });

  it('returns null for whitespace only', () => {
    expect(normalizePrice('   ')).toBeNull();
  });

  it('returns null for completely invalid string', () => {
    expect(normalizePrice('abc xyz')).toBeNull();
  });

  it('extracts digits from noisy input', () => {
    expect(normalizePrice('price: ~ 1 200 UAH!!!')).toBe(1200);
  });

  it('handles weird mixed format safely', () => {
    expect(normalizePrice('UAH 1.200,50 text')).toBe(1200.5);
  });
});