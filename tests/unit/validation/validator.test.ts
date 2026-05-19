/**
 * VALIDATOR TESTS
 *
 * Verifies business validation rules:
 * - matching prices
 * - mismatching prices
 * - invalid prices
 * - add-to-cart failures
 */

import { describe, it, expect } from 'vitest';

import { validator } from '@crawler/validation/validator';

describe('validator', () => {
  it('should validate matching prices', () => {
    const result = validator.validate({
      url: 'https://test.com',
      pdpPrice: '1499 ₴',
      cartPrice: 1499,
      addToCartSuccess: true,
    });

    expect(result.status).toBe('OK');
    expect(result.match).toBe(true);
  });

  it('should detect price mismatch', () => {
    const result = validator.validate({
      url: 'https://test.com',
      pdpPrice: 1499,
      cartPrice: 1599,
      addToCartSuccess: true,
    });

    expect(result.status).toBe('FAIL');
    expect(result.reason).toBe('PRICE_MISMATCH');
  });

  it('should fail when add-to-cart fails', () => {
    const result = validator.validate({
      url: 'https://test.com',
      pdpPrice: 1499,
      cartPrice: 1499,
      addToCartSuccess: false,
    });

    expect(result.status).toBe('FAIL');
    expect(result.reason).toBe('ADD_TO_CART_FAILED');
  });

  it('should fail on invalid PDP price', () => {
    const result = validator.validate({
      url: 'https://test.com',
      pdpPrice: null,
      cartPrice: 1499,
      addToCartSuccess: true,
    });

    expect(result.status).toBe('FAIL');
    expect(result.reason).toBe('PDP_PRICE_MISSING');
  });
});
