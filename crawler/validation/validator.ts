import { parsePrice } from '../utils/parsePrice';

type ValidationInput = {
  url: string;

  pdpPrice: unknown;
  cartPrice: unknown;

  addToCartSuccess: boolean;
};

export const validator = {
  validate(input: ValidationInput) {
    const pdp = parsePrice(input.pdpPrice);
    const cart = parsePrice(input.cartPrice);

    // ---------------- CART ----------------

    if (!input.addToCartSuccess) {
      return {
        status: 'FAIL',
        reason: 'ADD_TO_CART_FAILED',
        match: false,
      } as const;
    }

    // ---------------- PDP ----------------

    if (pdp.status === 'MISSING') {
      return {
        status: 'FAIL',
        reason: 'PDP_PRICE_MISSING',
        match: false,
      } as const;
    }

    if (pdp.status === 'FAILED_PARSE') {
      return {
        status: 'FAIL',
        reason: 'PDP_PRICE_PARSE_FAILED',
        match: false,
      } as const;
    }

    // ---------------- CART PRICE ----------------

    if (cart.status === 'MISSING') {
      return {
        status: 'FAIL',
        reason: 'CART_PRICE_MISSING',
        match: false,
      } as const;
    }

    if (cart.status === 'FAILED_PARSE') {
      return {
        status: 'FAIL',
        reason: 'CART_PRICE_PARSE_FAILED',
        match: false,
      } as const;
    }

    // ---------------- MATCH ----------------

    if (pdp.value !== cart.value) {
      return {
        status: 'FAIL',
        reason: 'PRICE_MISMATCH',
        match: false,
      } as const;
    }

    return {
      status: 'OK',
      reason: 'OK',
      match: true,
    } as const;
  },
};