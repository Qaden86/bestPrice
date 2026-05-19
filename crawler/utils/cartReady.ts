import { Page } from 'playwright';

export async function waitForCartReady(page: Page) {
  const priceSelector = '[data-testid="cart-item-line-total"]';

  // 1. wait for element
  await page.waitForSelector(priceSelector, { timeout: 15000 });

  // 2. wait for stable numeric value (no waitForFunction DOM polling loop)
  let lastValue = '';

  for (let i = 0; i < 20; i++) {
    const value = await page.$eval(priceSelector, el =>
      (el.textContent || '').trim()
    ).catch(() => '');

    if (value && /\d/.test(value) && value === lastValue) {
      return value;
    }

    lastValue = value;
    await page.waitForTimeout(250);
  }

  throw new Error('Cart not stable');
}