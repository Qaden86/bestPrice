import { Locator, Page } from 'playwright';

import { SELECTORS } from '../selectors/selectors';
import { parsePriceNumber } from '../utils/parsePrice';
import type { AddToCartExtraction, PriceExtraction } from '../types/extraction';

async function firstMatchingSelector(
  page: Page,
  selectors: string[],
  scope?: Locator,
): Promise<{ selector: string; found: boolean }> {
  const root: Page | Locator = scope ?? page;

  for (const selector of selectors) {
    const count = await root
      .locator(selector)
      .count()
      .catch(() => 0);
    if (count > 0) {
      return { selector, found: true };
    }
  }

  return { selector: selectors[0] ?? 'unknown', found: false };
}

export const productExtractor = {
  async extractPdpPrice(page: Page): Promise<PriceExtraction> {
    const root = page.locator(SELECTORS.pdp.root);
    const hasRoot = (await root.count()) > 0;
    const scope: Locator | undefined = hasRoot ? root : undefined;

    let { selector, found } = await firstMatchingSelector(
      page,
      SELECTORS.pdp.price,
      scope,
    );

    let priceScope: Page | Locator | undefined = scope;

    // Fall back to page-level search if the price isn't inside the PDP root
    // container — guards against DOM moves that hoist the price out of root.
    if (!found && scope) {
      const fallback = await firstMatchingSelector(page, SELECTORS.pdp.price);
      if (fallback.found) {
        selector = fallback.selector;
        found = true;
        priceScope = undefined;
      }
    }

    if (!found) {
      return { selector, selectorFound: false, price: null };
    }

    const priceLoc = priceScope
      ? priceScope.locator(selector).first()
      : page.locator(selector).first();
    const text = await priceLoc.textContent();
    return {
      selector,
      selectorFound: true,
      price: parsePriceNumber(text),
    };
  },

  async extractAddToCart(page: Page): Promise<AddToCartExtraction> {
    const candidates = [
      SELECTORS.actions.addToCartButton,
      SELECTORS.actions.stickyAddToCart,
    ];

    const { selector, found } = await firstMatchingSelector(page, candidates);

    if (!found) {
      return { selector, selectorFound: false, clicked: false };
    }

    const btn = page.locator(selector).first();

    try {
      if (!(await btn.isVisible().catch(() => false))) {
        return { selector, selectorFound: true, clicked: false };
      }

      await btn.scrollIntoViewIfNeeded();
      await btn.click({ timeout: 10_000, force: true });

      // The PDP can render and accept clicks before React hydrates the
      // add-to-cart handler — the click then fires no PUT and the cart
      // stays empty. cart-item is a persistent slot that exists even
      // when the cart is empty; only the line-total node renders for a
      // real item, so it's the truthy signal that the click landed. On
      // failure, surface clicked=false so the outer retry re-clicks
      // instead of waiting out the full waitForCartReady budget.
      const triggered = await page
        .waitForSelector(SELECTORS.cart.price[0], {
          state: 'attached',
          timeout: 3_000,
        })
        .then(() => true)
        .catch(() => false);

      return { selector, selectorFound: true, clicked: triggered };
    } catch {
      return { selector, selectorFound: true, clicked: false };
    }
  },

  async extractCartPrice(page: Page): Promise<PriceExtraction> {
    const itemSelector = SELECTORS.cart.item;
    const itemCount = await page
      .locator(itemSelector)
      .count()
      .catch(() => 0);

    if (itemCount === 0) {
      return {
        selector: itemSelector,
        selectorFound: false,
        price: null,
      };
    }

    const priceSelector = SELECTORS.cart.price[0];
    const priceLoc = page
      .locator(itemSelector)
      .first()
      .locator(priceSelector)
      .first();

    const priceCount = await priceLoc.count().catch(() => 0);

    if (priceCount === 0) {
      return {
        selector: priceSelector,
        selectorFound: false,
        price: null,
      };
    }

    const text = await priceLoc
      .textContent({ timeout: 5_000 })
      .catch(() => null);
    return {
      selector: priceSelector,
      selectorFound: true,
      price: parsePriceNumber(text),
    };
  },
};
