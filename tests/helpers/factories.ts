import type {
  AddToCartExtraction,
  PriceExtraction,
} from '../../crawler/types/extraction';

import type { ValidationInput } from '../../crawler/validation/validator';

import {
  DEFAULT_ADD_TO_CART_SELECTOR,
  DEFAULT_CART_SELECTOR,
  DEFAULT_PDP_SELECTOR,
  DEFAULT_URL,
  VALID_PRICE,
} from './constants';

export function createPriceExtraction(
  overrides: Partial<PriceExtraction> = {},
): PriceExtraction {
  return {
    selectorFound: true,
    selector: DEFAULT_PDP_SELECTOR,
    price: VALID_PRICE,
    ...overrides,
  };
}

export function createAddToCart(
  overrides: Partial<AddToCartExtraction> = {},
): AddToCartExtraction {
  return {
    selectorFound: true,
    selector: DEFAULT_ADD_TO_CART_SELECTOR,
    clicked: true,
    ...overrides,
  };
}

export function createValidationInput(
  overrides: Partial<ValidationInput> = {},
): ValidationInput {
  return {
    url: DEFAULT_URL,
    pdp: createPriceExtraction(),
    cart: {
      selectorFound: true,
      selector: DEFAULT_CART_SELECTOR,
      price: VALID_PRICE,
    },
    addToCart: createAddToCart(),
    ...overrides,
  };
}