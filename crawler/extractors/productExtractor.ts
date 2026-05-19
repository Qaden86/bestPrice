import { Page } from 'playwright';

import { SELECTORS } from '../selectors/selectors';
import { parsePriceNumber } from '../utils/parsePrice';

export const productExtractor = {
  async extractPdpPrice(page: Page): Promise<number | null> {
    const root = page.locator(SELECTORS.pdp.root);

    for (const selector of SELECTORS.pdp.price) {
      try {
        const el = root.locator(selector).first();
        if ((await el.count()) === 0) continue;

        const text = await el.textContent();
        const price = parsePriceNumber(text);

        if (price !== null) {
          return price;
        }
      } catch {
        continue;
      }
    }

    for (const selector of SELECTORS.pdp.price) {
      try {
        const el = page.locator(selector).first();
        if ((await el.count()) === 0) continue;

        const text = await el.textContent();
        const price = parsePriceNumber(text);

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
    const buttons = [
      page.locator(SELECTORS.actions.addToCartButton).first(),
      page.locator(SELECTORS.actions.stickyAddToCart).first(),
    ];

    for (const btn of buttons) {
      try {
        if ((await btn.count()) === 0) continue;
        if (!(await btn.isVisible().catch(() => false))) continue;

        await btn.scrollIntoViewIfNeeded();
        await page.waitForTimeout(200);

        await btn.click({ timeout: 10_000, force: true });

        return true;
      } catch {
        continue;
      }
    }

    return false;
  },

  async extractCartPrice(page: Page): Promise<number | null> {
    try {
      const el = page
        .locator(SELECTORS.cart.item)
        .first()
        .locator(SELECTORS.cart.price[0])
        .first();

      const text = await el.textContent({ timeout: 5_000 });
      return parsePriceNumber(text);
    } catch {
      return null;
    }
  },
};
