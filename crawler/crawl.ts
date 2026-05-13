import { Page } from 'playwright';

type TraceEvent = {
  step: string;
  status: 'INFO' | 'OK' | 'WARN' | 'ERROR';
  message?: string;
  data?: any;
  ts: number;
};

function normalizePrice(text: string | null): number | null {
  if (!text) return null;

  const cleaned = text
    .replace(/\u00A0/g, ' ')
    .replace(/[^\d]/g, '');

  const num = Number(cleaned);

  if (!Number.isFinite(num)) return null;

  return num;
}

export async function crawl(page: Page, url: string) {
  console.log('\n[CRAWL START]', url);

  const trace: TraceEvent[] = [];

  const add = (
    step: string,
    status: TraceEvent['status'],
    message?: string,
    data?: any
  ) => {
    trace.push({
      step,
      status,
      message,
      data,
      ts: Date.now(),
    });
  };

  let loaded = false;

  for (let i = 1; i <= 3; i++) {
    try {
      console.log(`[GOTO ${i}]`, url);

      const res = await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 60000,
      });

      if (!res?.ok()) {
        throw new Error(`HTTP ${res?.status()}`);
      }

      loaded = true;

      add('goto', 'OK');

      break;
    } catch (e: any) {
      console.log('[NAV ERROR]', e.message);

      add('goto', 'WARN', e.message, {
        name: e.name,
        stack: e.stack,
      });
    }
  }

  if (!loaded) {
    return {
      url,
      status: 'ERROR',
      reason: 'NAV_FAIL',
      trace,
    };
  }

  // ---------------- PDP PRICE ----------------

  const priceLocators = [
    'span.text-2xl.font-bold',
    '.product-price__big',
    'span:has-text("₴")',
  ];

  let pdpPrice: number | null = null;

  for (const sel of priceLocators) {
    const count = await page.locator(sel).count();

    if (count > 0) {
      const txt = await page.locator(sel).first().textContent();

      pdpPrice = normalizePrice(txt);

      add('pdp', 'OK', txt ?? '');

      break;
    }
  }

  // ---------------- ADD TO CART ----------------

  const addBtn = page.locator('button').filter({
    hasText: /кошик|додати|купити/i,
  });

  let addOk = false;

  try {
    await addBtn.first().click({
      timeout: 8000,
    });

    addOk = true;

    add('cart.click', 'OK');
  } catch (e: any) {
    add('cart.click', 'ERROR', e.message);
  }

  // ---------------- WAIT CART ----------------

  let cartOpened = false;

  if (addOk) {
    try {
      await Promise.race([
        page.waitForSelector('[data-slot="sheet-title"]', {
          timeout: 8000,
        }),

        page.waitForSelector('h2:has-text("Кошик")', {
          timeout: 8000,
        }),
      ]);

      cartOpened = true;

      add('cart.modal', 'OK');
    } catch (e: any) {
      add('cart.modal', 'ERROR', e.message);
    }
  }

  // ---------------- CART PRICE ----------------

  let cartPrice: number | null = null;

  if (cartOpened) {
    const cartPriceLocator = page
      .locator('span, div')
      .filter({
        hasText: /^\s*\d[\d\s\u00A0]*₴\s*$/,
      });

    const cartCandidates =
      await cartPriceLocator.allTextContents();

    const cartText =
      cartCandidates
        .map(t => t.trim())
        .find(t =>
          /^\d[\d\s\u00A0]*₴$/.test(t)
        ) ?? null;

    cartPrice = normalizePrice(cartText);

    add('cart.price', 'OK', cartText ?? '');
  }

  // ---------------- VALIDATION ----------------

  const priceMatch =
    pdpPrice != null &&
    cartPrice != null &&
    pdpPrice === cartPrice;

  let reason = 'OK';
  let status = 'OK';

  if (pdpPrice == null) {
    status = 'ERROR';
    reason = 'INVALID_PDP_PRICE';
  } else if (!addOk) {
    status = 'ERROR';
    reason = 'ADD_TO_CART_FAILED';
  } else if (cartPrice == null) {
    status = 'ERROR';
    reason = 'INVALID_CART_PRICE';
  } else if (!priceMatch) {
    status = 'ERROR';
    reason = 'PRICE_MISMATCH';
  }

  add('final', 'INFO', reason);

  return {
    url,

    status,
    reason,

    pdpPrice,
    cartPrice,

    priceMatch,
    addToCartSuccess: addOk,

    trace,
  };
}