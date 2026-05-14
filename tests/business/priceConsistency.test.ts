import { expect } from 'vitest';
import { chromium } from 'playwright';
import { crawl } from '../../crawler/crawl';

test('price consistency check - verifies PDP price matches cart price after add-to-cart flow', async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const result = await crawl(
    page,
    'https://bestprice.com.ua/produkt/otvertka-49108-stal-sl5x75',
  );

  expect(result.pdpPrice).toBeDefined();
  expect(result.cartPrice).toBeDefined();
  expect(result.priceMatch).toBe(true);

  await browser.close();
});
