export const SELECTORS = {
  pdp: {
    root: '[data-testid="product-detail"]',
    price: [
      '[data-testid="product-detail-price-sale"]',
      '[data-testid="product-detail-price"]',
    ],
  },

  cart: {
    item: '[data-testid="cart-item"]',
    openDrawer: '[data-testid="header-cart-link"]',
    price: ['[data-testid="cart-item-line-total"]'],
  },

  actions: {
    addToCartButton: '[data-testid="product-detail-add-to-cart"]',
    stickyAddToCart: '[data-testid="sticky-cta-add-to-cart"]',
  },
};
