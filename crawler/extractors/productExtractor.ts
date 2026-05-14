/**
 * EXTRACTION LAYER
 *
 * This module is responsible for extracting data from the DOM.
 *
 * Responsibilities:
 * - extract PDP price
 * - click "add to cart"
 * - extract cart price
 *
 */

import { Page } from 'playwright';
import { SELECTORS } from '../selectors/selectors';

function normalizePrice(text: string | null): number | null {
  if (!text) return null;

  const cleaned = text.replace(/\u00A0/g, ' ').replace(/[^\d]/g, '');
  const num = Number(cleaned);

  return Number.isFinite(num) ? num : null;
}

export const productExtractor = {
  async extractPdpPrice(page: Page) {
    for (const sel of SELECTORS.pdpPrice) {
      const loc = page.locator(sel);
      if ((await loc.count()) > 0) {
        const text = await loc.first().textContent();
        return normalizePrice(text);
      }
    }
    return null;
  },

  async clickAddToCart(page: Page) {
    try {
      const btn = page.locator(SELECTORS.addToCart.join(',')).first();
      await btn.click({ timeout: 8000 });
      return true;
    } catch {
      return false;
    }
  },

  async extractCartPrice(page: Page) {
    const loc = page.locator(SELECTORS.cartPrice.join(','));
    const texts = await loc.allTextContents();

    const match = texts.find((t) => /^\d[\d\s\u00A0]*₴$/.test(t.trim()));

    return normalizePrice(match ?? null);
  },
};
