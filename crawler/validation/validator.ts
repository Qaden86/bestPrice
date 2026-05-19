import type { AddToCartExtraction, PriceExtraction } from '../types/extraction';
import { parsePrice } from '../utils/parsePrice';

export type ValidationInput = {
  url: string;
  pdp: PriceExtraction;
  cart: PriceExtraction;
  addToCart: AddToCartExtraction;
};

type FailReason =
  | 'SELECTOR_NOT_FOUND'
  | 'MISSING_PRICE'
  | 'PRICE_IS_ZERO'
  | 'PRICE_MISMATCH'
  | 'ADD_TO_CART_FAILED';

export type ValidationFail = {
  status: 'FAIL';
  reason: FailReason;
  match: false;
  detail?: string;
  selector?: string;
};

export type ValidationOutput =
  | { status: 'OK'; reason: 'OK'; match: true }
  | ValidationFail;

function fail(
  reason: FailReason,
  opts?: { selector?: string; detail?: string },
): ValidationFail {
  return {
    status: 'FAIL',
    reason,
    match: false,
    selector: opts?.selector,
    detail: opts?.detail,
  };
}

function checkPdp(pdp: PriceExtraction): ValidationFail | null {
  if (!pdp.selectorFound) {
    return fail('SELECTOR_NOT_FOUND', {
      selector: pdp.selector,
      detail: 'pdp_price',
    });
  }

  const parsed = parsePrice(pdp.price);

  if (parsed.status === 'MISSING' || parsed.status === 'FAILED_PARSE') {
    return fail('MISSING_PRICE', {
      selector: pdp.selector,
      detail: 'pdp',
    });
  }

  return null;
}

function checkAddToCart(addToCart: AddToCartExtraction): ValidationFail | null {
  if (!addToCart.selectorFound) {
    return fail('SELECTOR_NOT_FOUND', {
      selector: addToCart.selector,
      detail: 'add_to_cart',
    });
  }

  if (!addToCart.clicked) {
    return fail('ADD_TO_CART_FAILED', { selector: addToCart.selector });
  }

  return null;
}

function checkCart(cart: PriceExtraction): ValidationFail | null {
  if (!cart.selectorFound) {
    return fail('SELECTOR_NOT_FOUND', {
      selector: cart.selector,
      detail: 'cart_price',
    });
  }

  const parsed = parsePrice(cart.price);

  if (parsed.status === 'MISSING' || parsed.status === 'FAILED_PARSE') {
    return fail('MISSING_PRICE', {
      selector: cart.selector,
      detail: 'cart',
    });
  }

  return null;
}

function checkPrices(pdp: PriceExtraction, cart: PriceExtraction): ValidationFail | null {
  const pdpValue = parsePrice(pdp.price).value!;
  const cartValue = parsePrice(cart.price).value!;

  if (pdpValue === 0 && cartValue === 0) {
    return fail('PRICE_IS_ZERO');
  }

  if (pdpValue !== cartValue) {
    return fail('PRICE_MISMATCH');
  }

  return null;
}

export const validator = {
  validate(input: ValidationInput): ValidationOutput {
    return (
      checkPdp(input.pdp) ??
      checkAddToCart(input.addToCart) ??
      checkCart(input.cart) ??
      checkPrices(input.pdp, input.cart) ?? {
        status: 'OK',
        reason: 'OK',
        match: true,
      }
    );
  },

  checkPdp,
  checkAddToCart,
  checkCart,
  checkPrices,
};
