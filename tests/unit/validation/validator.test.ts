import { describe, expect, it } from 'vitest';

import { validator } from '@crawler/validation/validator';

import {
  DEFAULT_ADD_TO_CART_SELECTOR,
  DEFAULT_CART_SELECTOR,
  DEFAULT_PDP_SELECTOR,
  DIFFERENT_PRICE,
  VALID_PRICE,
  ZERO_PRICE,
} from '../../helpers/constants';

import {
  createAddToCart,
  createPriceExtraction,
  createValidationInput,
} from '../../helpers/factories';

describe('validator.checkPdp', () => {
  it('returns SELECTOR_NOT_FOUND when pdp selector is missing', () => {
    const result = validator.checkPdp(
      createPriceExtraction({
        selectorFound: false,
      }),
    );

    expect(result).toEqual({
      status: 'FAIL',
      reason: 'SELECTOR_NOT_FOUND',
      match: false,
      selector: DEFAULT_PDP_SELECTOR,
      detail: 'pdp_price',
    });
  });

  it('returns MISSING_PRICE when price is null', () => {
    const result = validator.checkPdp(
      createPriceExtraction({
        price: null,
      }),
    );

    expect(result?.reason).toBe('MISSING_PRICE');
  });
});

describe('validator.checkAddToCart', () => {
  it('fails when selector is not found', () => {
    const result = validator.checkAddToCart(
      createAddToCart({
        selectorFound: false,
      }),
    );

    expect(result?.reason).toBe('SELECTOR_NOT_FOUND');
  });

  it('fails when click not triggered', () => {
    const result = validator.checkAddToCart(
      createAddToCart({
        clicked: false,
      }),
    );

    expect(result?.reason).toBe('ADD_TO_CART_FAILED');
  });

  it('passes when valid', () => {
    expect(
      validator.checkAddToCart(createAddToCart()),
    ).toBeNull();
  });
});

describe('validator.checkCart', () => {
  it('returns MISSING_PRICE when cart price is invalid', () => {
    const result = validator.checkCart(
      createPriceExtraction({
        price: null,
        selectorFound: true,
      }),
    );

    expect(result?.reason).toBe('MISSING_PRICE');
  });

  it('returns SELECTOR_NOT_FOUND when selector missing', () => {
    const result = validator.checkCart(
      createPriceExtraction({
        selectorFound: false,
      }),
    );

    expect(result?.reason).toBe('SELECTOR_NOT_FOUND');
  });

  it('passes valid cart', () => {
    expect(
      validator.checkCart(createPriceExtraction()),
    ).toBeNull();
  });
});

describe('validator.checkPrices', () => {
  it('returns PRICE_IS_ZERO when both prices are zero', () => {
    const result = validator.checkPrices(
      createPriceExtraction({ price: ZERO_PRICE }),
      createPriceExtraction({ price: ZERO_PRICE }),
    );

    expect(result?.reason).toBe('PRICE_IS_ZERO');
  });

  it('returns PRICE_MISMATCH when prices differ', () => {
    const result = validator.checkPrices(
      createPriceExtraction({ price: VALID_PRICE }),
      createPriceExtraction({ price: DIFFERENT_PRICE }),
    );

    expect(result?.reason).toBe('PRICE_MISMATCH');
  });

  it('returns null when prices match', () => {
    expect(
      validator.checkPrices(
        createPriceExtraction({ price: VALID_PRICE }),
        createPriceExtraction({ price: VALID_PRICE }),
      ),
    ).toBeNull();
  });
});

describe('validator.validate (integration flow)', () => {
  it('returns OK when everything is valid', () => {
    const result = validator.validate(createValidationInput());

    expect(result.status).toBe('OK');
  });

  it('prioritizes PDP errors first', () => {
    const result = validator.validate(
      createValidationInput({
        pdp: createPriceExtraction({ selectorFound: false }),
        addToCart: createAddToCart({ clicked: false }),
      }),
    );

    expect(result.reason).toBe('SELECTOR_NOT_FOUND');
    expect(result.selector).toBe(DEFAULT_PDP_SELECTOR);
  });

  it('prioritizes addToCart over cart', () => {
    const result = validator.validate(
      createValidationInput({
        addToCart: createAddToCart({ clicked: false }),
        cart: createPriceExtraction({ selectorFound: false }),
      }),
    );

    expect(result.reason).toBe('ADD_TO_CART_FAILED');
    expect(result.selector).toBe(DEFAULT_ADD_TO_CART_SELECTOR);
  });

  it('returns PRICE_MISMATCH when flow passes all checks', () => {
    const result = validator.validate(
      createValidationInput({
        pdp: createPriceExtraction({ price: VALID_PRICE }),
        cart: createPriceExtraction({ price: DIFFERENT_PRICE }),
      }),
    );

    expect(result.reason).toBe('PRICE_MISMATCH');
  });
});