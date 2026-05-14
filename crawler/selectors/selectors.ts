/**
 * SELECTOR STRATEGY LAYER
 *
 * This module stores all DOM selectors used across the crawler.
 *
 */

export const SELECTORS = {
  // PDP (product detail page) price selectors with fallback strategy
  pdpPrice: [
    'span.text-2xl.font-bold',
    '.product-price__big',
    'span:has-text("₴")',
  ],

  // Add-to-cart button selectors with multiple UI variations
  addToCart: [
    'button:has-text("Додати в кошик")',
    'button:has-text("Кошик")',
    'button:has-text("Купити")',
  ],

  // Cart price selectors (fallback strategy for different layouts)
  cartPrice: ['[data-slot="cart"] span', 'span.font-bold', 'div:has-text("₴")'],
};
