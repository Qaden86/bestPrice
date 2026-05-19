import { describe, it, expect } from 'vitest';

import { validator } from '@crawler/validation/validator';

const pdpOk = {
  selector: '[data-testid="product-detail-price"]',
  selectorFound: true,
  price: 100,
};

const cartOk = {
  selector: '[data-testid="cart-item-line-total"]',
  selectorFound: true,
  price: 100,
};

const addOk = {
  selector: '[data-testid="product-detail-add-to-cart"]',
  selectorFound: true,
  clicked: true,
};

describe('validator', () => {
  it('accepts matching prices', () => {
    const result = validator.validate({
      url: 'https://test.com',
      pdp: pdpOk,
      cart: cartOk,
      addToCart: addOk,
    });

    expect(result.status).toBe('OK');
    expect(result.match).toBe(true);
  });

  it('reports SELECTOR_NOT_FOUND for PDP', () => {
    const result = validator.validate({
      url: 'https://test.com',
      pdp: { ...pdpOk, selectorFound: false },
      cart: cartOk,
      addToCart: addOk,
    });

    expect(result.status).toBe('FAIL');
    if (result.status === 'FAIL') {
      expect(result.reason).toBe('SELECTOR_NOT_FOUND');
      expect(result.selector).toBe(pdpOk.selector);
    }
  });

  it('reports MISSING_PRICE', () => {
    const result = validator.validate({
      url: 'https://test.com',
      pdp: { ...pdpOk, price: null },
      cart: cartOk,
      addToCart: addOk,
    });

    if (result.status === 'FAIL') {
      expect(result.reason).toBe('MISSING_PRICE');
      expect(result.detail).toBe('pdp');
    }
  });

  it('reports PRICE_IS_ZERO', () => {
    const result = validator.validate({
      url: 'https://test.com',
      pdp: { ...pdpOk, price: 0 },
      cart: { ...cartOk, price: 0 },
      addToCart: addOk,
    });

    expect(result.reason).toBe('PRICE_IS_ZERO');
  });

  it('reports PRICE_MISMATCH', () => {
    const result = validator.validate({
      url: 'https://test.com',
      pdp: pdpOk,
      cart: { ...cartOk, price: 2 },
      addToCart: addOk,
    });

    expect(result.reason).toBe('PRICE_MISMATCH');
  });
});
