import { Page } from 'playwright';

function normalizePrice(text: string | null): number | null {
  if (!text) return null;

  const cleaned = text.replace(/\u00A0/g, ' ').replace(/[^\d.,-]/g, '');

  const num = Number(cleaned);

  return Number.isFinite(num) ? num : null;
}

export const productExtractor = {
  async extractPdpPrice(page: Page): Promise<number | null> {
    const el = page
      .locator('span.text-2xl.font-bold.text-primary-text')
      .first();

    const text = await el.textContent();

    return normalizePrice(text);
  },

  async clickAddToCart(page: Page): Promise<boolean> {
    try {
      const btn = page
        .locator('button:has-text("Додати в кошик")')
        .first();

      await btn.click({ timeout: 8000 });

      return true;
    } catch (e) {
      throw e;
    }
  },

  async extractCartPrice(page: Page): Promise<number | null> {
    try {
      const el = page
        .locator('span.font-bold.text-primary-text')
        .filter({ hasText: /₴/ })
        .last();

      const text = await el.textContent();

      return normalizePrice(text);
    } catch {
      return null;
    }
  },
};
