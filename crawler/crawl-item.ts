export async function crawlItem(
  page: any,
  url: string
): Promise<CrawlResult> {

  let pdpPrice: number | null = null;
  let cartPrice: number | null = null;

  try {

    // ---------------- PDP ----------------
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    const pdpText = await safeText(page, SELECTORS.pdpPrice);
    console.log('[PDP RAW TEXT]', pdpText);

    pdpPrice = parsePrice(pdpText);
    console.log('[PDP PARSED PRICE]', pdpPrice);

    if (!pdpPrice) {
      return {
        url,
        pdpPrice,
        cartPrice: null,
        finalOk: null,
        reason: 'INVALID_PDP_PRICE'
      };
    }

    // ---------------- ADD TO CART ----------------
    const btn = page.locator(SELECTORS.addToCart[0]).first();

    if (await btn.count()) {
      await btn.click().catch(() => {});
    }

    // ---------------- CART MODAL ----------------
    await page.waitForFunction(() => {
      return document.body.innerText.includes('Кошик');
    }, { timeout: 10000 });

    await page.waitForTimeout(1000);

    // ---------------- CART PRICE ----------------
    const cartText = await safeText(page, SELECTORS.cartPrice);
    console.log('[CART RAW TEXT]', cartText);

    cartPrice = parsePrice(cartText);
    console.log('[CART PARSED PRICE]', cartPrice);

    if (!cartPrice) {
      return {
        url,
        pdpPrice,
        cartPrice: null,
        finalOk: null,
        reason: 'INVALID_CART_PRICE'
      };
    }

    // ---------------- COMPARE ----------------
    if (pdpPrice !== cartPrice) {
      return {
        url,
        pdpPrice,
        cartPrice,
        finalOk: false,
        reason: 'PRICE_MISMATCH'
      };
    }

    return {
      url,
      pdpPrice,
      cartPrice,
      finalOk: true,
      reason: 'OK'
    };

  } catch (e: any) {

    return {
      url,
      pdpPrice,
      cartPrice,
      finalOk: null,
      reason: e?.message ?? 'ERROR'
    };
  }
}