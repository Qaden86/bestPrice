/**
 * SELECTOR STRATEGY LAYER
 *
 * Centralized DOM selectors.
 * Must be stable across UI changes.
 */

export const SELECTORS = {
  pdp: {
    /**
     * Primary PDP price selector(s)
     */
    price: ['span.text-2xl.font-bold.text-primary-text'],

    /**
     * Add to cart button selector
     */
    addToCartButton: 'button:has-text("Додати в кошик")',
  },

  cart: {
    /**
     * fallback selectors (NOT used globally anymore)
     */
    itemLink: 'a[href*="/produkt/"]',
  },
};
