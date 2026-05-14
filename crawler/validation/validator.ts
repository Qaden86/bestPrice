/**
 * VALIDATION LAYER
 *
 * Responsible for validating extracted crawler data.
 *
 * Business rules:
 * - PDP price must exist
 * - Cart price must exist
 * - Add-to-cart must succeed
 * - PDP and cart prices must match
 */

/**
 * Strict price normalization.
 * This ensures stable comparison across extraction layers.
 */
function normalizePriceStrict(v: any): number | null {
  if (v == null) {
    return null;
  }

  const cleaned = String(v).replace(/[^\d]/g, '');

  const num = Number(cleaned);

  return Number.isFinite(num) ? num : null;
}

type ValidationInput = {
  url: string;

  pdpPrice: any;
  cartPrice: any;

  addToCartSuccess: boolean;
};

export const validator = {
  validate(input: ValidationInput) {
    const normalizedPdp = normalizePriceStrict(input.pdpPrice);

    const normalizedCart = normalizePriceStrict(input.cartPrice);

    /**
     * Stable cross-layer comparison.
     */
    const priceMatch =
      normalizedPdp !== null &&
      normalizedCart !== null &&
      normalizedPdp === normalizedCart;

    // ---------------- VALIDATION RULES ----------------

    if (normalizedPdp == null) {
      return {
        status: 'ERROR',
        reason: 'INVALID_PDP_PRICE',
        priceMatch: false,
      };
    }

    if (!input.addToCartSuccess) {
      return {
        status: 'ERROR',
        reason: 'ADD_TO_CART_FAILED',
        priceMatch: false,
      };
    }

    if (normalizedCart == null) {
      return {
        status: 'ERROR',
        reason: 'INVALID_CART_PRICE',
        priceMatch: false,
      };
    }

    if (!priceMatch) {
      return {
        status: 'ERROR',
        reason: 'PRICE_MISMATCH',
        priceMatch: false,
      };
    }

    // ---------------- SUCCESS ----------------

    return {
      status: 'OK',
      reason: 'OK',
      priceMatch: true,
    };
  },
};
