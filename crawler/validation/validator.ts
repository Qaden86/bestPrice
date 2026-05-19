import { parsePrice } from '../utils/parsePrice';
import { pricesMatch } from '../utils/priceCompare';

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

    if (!input.addToCartSuccess) {
      return {
        status: 'FAIL',
        reason: 'ADD_TO_CART_FAILED',
        match: false,
      } as const;
    }

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

    if (!pricesMatch(pdp.value, cart.value)) {
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