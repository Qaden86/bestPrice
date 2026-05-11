export const SELECTORS = {

  // PDP PRICE
  pdpPrice: [
    'span.text-2xl.font-bold.text-primary-text',
    'span.font-bold.text-primary-text.text-sm'
  ],

  // ADD TO CART BUTTON
  addToCart: [
    'button:has-text("Додати в кошик")',
    'button:has-text("Купити")',
    'button:has-text("В кошик")'
  ],

  // CART MODAL PRICE
  cartPrice: [

    // selector
    'div.flex.items-center.justify-between.text-base.font-bold span:last-child',

    // fallback
    'span.text-primary-text',
    'div.font-bold span:last-child'
  ]
};