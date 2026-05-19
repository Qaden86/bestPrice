/**
 * SELECTOR STRATEGY LAYER
 *
 * Centralized DOM selectors.
 * Must be stable across UI changes.
 *
 * RULE:
 * Prefer data-testid > semantic selectors > CSS classes
 */

export const SELECTORS = {
  pdp: {
    /**
     * Primary PDP price selector
     */
    price: [
      '[data-testid="product-detail-price-sale"]',
      '[data-testid="product-detail-price"]',
    ],
  },

  cart: {
    /**
     * Cart price selector
     */
    price: [
      '[data-testid="cart-item-line-total"]',
    ],
  },

  actions: {
    /**
     * Add to cart button
     */
    addToCartButton:
      '[data-testid="product-detail-add-to-cart"]',
  },
};