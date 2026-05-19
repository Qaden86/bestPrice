import { Page } from 'playwright';
import { SELECTORS } from '../selectors/selectors';
import { parsePriceNumber } from './parsePrice';

const LINE_TOTAL = SELECTORS.cart.price[0];

export async function waitForCartReady(page: Page): Promise<string> {
  await ensureCartPanelVisible(page);

  await page.waitForSelector(LINE_TOTAL, { timeout: 20_000 });

  let lastValue = '';
  let stableReads = 0;

  for (let i = 0; i < 24; i++) {
    const value = await page
      .locator(SELECTORS.cart.item)
      .first()
      .locator(LINE_TOTAL)
      .textContent()
      .catch(() => '');

    const trimmed = (value || '').trim();
    const parsed = parsePriceNumber(trimmed);

    if (parsed !== null && trimmed && trimmed === lastValue) {
      stableReads++;
      if (stableReads >= 2) {
        return trimmed;
      }
    } else {
      stableReads = 0;
    }

    lastValue = trimmed;
    await page.waitForTimeout(200);
  }

  throw new Error('Cart price not stable');
}

async function ensureCartPanelVisible(page: Page): Promise<void> {
  const inCart = await page
    .locator(SELECTORS.cart.item)
    .first()
    .locator(LINE_TOTAL)
    .isVisible()
    .catch(() => false);

  if (inCart) {
    return;
  }

  const cartLink = page.locator(SELECTORS.cart.openDrawer).first();

  if (await cartLink.isVisible().catch(() => false)) {
    await cartLink.click({ timeout: 8_000 }).catch(() => {});
    await page.waitForTimeout(400);
  }
}
