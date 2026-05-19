import { Page } from 'playwright';

import { SELECTORS } from '../selectors/selectors';

function normalizePrice(text: string | null): number | null {
  if (!text) return null;

  const cleaned = text
    .replace(/\u00A0/g, ' ')
    .replace(/[^\d.,-]/g, '');

  const normalized = cleaned.replace(',', '.');

  const num = Number(normalized);

  return Number.isFinite(num) ? num : null;
}

export const productExtractor = {
  async extractPdpPrice(page: Page): Promise<number | null> {
    for (const selector of SELECTORS.pdp.price) {
      try {
        const el = page.locator(selector).first();

        if (!(await el.count())) continue;

        const text = await el.textContent();
        const price = normalizePrice(text);

        if (price !== null) {
          return price;
        }
      } catch {
        continue;
      }
    }

    return null;
  },

  async clickAddToCart(page: Page): Promise<boolean> {
    try {
      const btn = page
        .locator(SELECTORS.actions.addToCartButton)
        .first();

      await btn.scrollIntoViewIfNeeded();

      // allow sticky UI / transitions to settle
      await page.waitForTimeout(300);

      await btn.click({
        timeout: 8000,
        force: true,
      });

      return true;
    } catch (e) {
      throw e;
    }
  },

  async extractCartPrice(page: Page): Promise<number | null> {
    try {
      const el = page
        .locator(SELECTORS.cart.price[0])
        .first();

      const text = await el.textContent();

      return normalizePrice(text);
    } catch {
      return null;
    }
  },
};
