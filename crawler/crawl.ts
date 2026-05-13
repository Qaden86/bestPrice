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
    .replace(/\u00A0/g, ' ') // NBSP fix
    .replace(/[^\d]/g, '');

  const num = Number(cleaned);

  if (!Number.isFinite(num)) return null;

  return num;
}

export async function crawl(page: Page, url: string) {
  console.log('\n[CRAWL START]', url);

  const trace: TraceEvent[] = [];

  const add = (step: string, status: TraceEvent['status'], message?: string, data?: any) => {
    trace.push({ step, status, message, data, ts: Date.now() });
  };

  let loaded = false;

  for (let i = 1; i <= 3; i++) {
    try {
      console.log(`[GOTO ${i}]`, url);

      const res = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      });

      if (!res?.ok()) throw new Error('bad response');

      await page.waitForTimeout(1500);

      loaded = true;
      add('goto', 'OK');
      break;
    } catch (e: any) {
      add('goto', 'WARN', e.message);
    }
  }

  if (!loaded) {
    return { url, status: 'ERROR', reason: 'NAV_FAIL', trace };
  }

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

  const addBtn = page.locator('button').filter({
    hasText: /кошик|додати|купити/i,
  });

  let addOk = false;

  try {
    await addBtn.first().click({ timeout: 8000 });
    addOk = true;
    add('cart.click', 'OK');
  } catch (e: any) {
    add('cart.click', 'ERROR', e.message);
  }

  let cartPrice: number | null = null;

  if (addOk) {
    const cartPriceLocator = page
      .locator('span, div')
      .filter({
        hasText: /^\s*\d[\d\s\u00A0]*₴\s*$/
      });

    const cartCandidates = await cartPriceLocator.allTextContents();

    const cartText =
      cartCandidates
        .map(t => t.trim())
        .find(t => /^\d[\d\s\u00A0]*₴$/.test(t)) ?? null;

    cartPrice = normalizePrice(cartText);

    add('cart', 'OK', cartText ?? '');
  }

  return {
    url,
    status: addOk ? 'OK' : 'ERROR',
    pdpPrice,
    cartPrice,
    priceMatch: pdpPrice === cartPrice,
    addToCartSuccess: addOk,
    trace,
  };
}