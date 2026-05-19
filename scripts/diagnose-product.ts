/**
 * One-off PDP/cart price diagnostic for a product URL.
 */
import { chromium } from 'playwright';

const url =
  process.argv[2] ??
  'https://bestprice.com.ua/produkt/otvertka-49108-stal-sl5x75';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });

  const dump = await page.evaluate(() => {
    const priceEls = Array.from(
      document.querySelectorAll(
        '[data-testid*="price"], [class*="price"], [itemprop="price"]',
      ),
    ).slice(0, 30);

    const allTestIds = Array.from(document.querySelectorAll('[data-testid]'))
      .map((el) => el.getAttribute('data-testid'))
      .filter((id) => id && /price|vat|total|amount/i.test(id));

    return {
      priceRelatedTestIds: [...new Set(allTestIds)],
      testIds: priceEls.map((el) => ({
        testid: el.getAttribute('data-testid'),
        text: (el.textContent || '').trim().slice(0, 80),
        tag: el.tagName,
      })),
      pdpSale: document
        .querySelector('[data-testid="product-detail-price-sale"]')
        ?.textContent?.trim(),
      pdpMain: document
        .querySelector('[data-testid="product-detail-price"]')
        ?.textContent?.trim(),
      pdpGross: document
        .querySelector('[data-testid="product-detail-price-gross"]')
        ?.textContent?.trim(),
      pdpWithVat: document
        .querySelector('[data-testid="product-detail-price-with-vat"]')
        ?.textContent?.trim(),
      addBtn: !!document.querySelector(
        '[data-testid="product-detail-add-to-cart"]',
      ),
    };
  });

  console.log('URL', url);
  console.log(JSON.stringify(dump, null, 2));

  await page.locator('[data-testid="product-detail-add-to-cart"]').first().click({
    timeout: 10_000,
    force: true,
  });

  try {
    await page.waitForSelector('[data-testid="cart-item-line-total"]', {
      timeout: 8_000,
    });
  } catch {
    const cartLink = page.locator('[data-testid="header-cart-link"]');
    if (await cartLink.count()) {
      await cartLink.click({ timeout: 5_000 }).catch(() => {});
      await page.waitForSelector('[data-testid="cart-item-line-total"]', {
        timeout: 12_000,
      }).catch(() => console.log('cart line total still not visible'));
    }
  }

  await page.waitForTimeout(500);

  const cart = await page.evaluate(() => ({
    lineTotal: document
      .querySelector('[data-testid="cart-item-line-total"]')
      ?.textContent?.trim(),
    unitPrice: document
      .querySelector('[data-testid="cart-item-unit-price"]')
      ?.textContent?.trim(),
    subtotal: document
      .querySelector('[data-testid="cart-subtotal"]')
      ?.textContent?.trim(),
    allCartTestIds: Array.from(
      document.querySelectorAll('[data-testid*="cart"]'),
    )
      .slice(0, 25)
      .map((el) => ({
        id: el.getAttribute('data-testid'),
        text: (el.textContent || '').trim().slice(0, 60),
      })),
  }));

  console.log('CART', JSON.stringify(cart, null, 2));

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
