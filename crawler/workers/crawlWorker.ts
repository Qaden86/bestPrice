/**
 * crawler/workers/crawlWorker.ts
 *
 * Purpose
 * - Crawl a product detail page (PDP), detect the product price on the PDP,
 *   attempt to add the product to the cart using multiple strategies, then
 *   read the cart total (in-page or by fetching `/cart`) and return a
 *   structured `CrawlResult`.
 *
 * Exports
 * - `crawlWorker(url: string, pool?: BrowserPoolInstance): Promise<CrawlResult>`
 *   Performs the full flow and returns a `CrawlResult` object (see types).
 *
 * Key helpers and responsibilities
 * - parsePrice(text: string | null): number | null
 *   Safely normalizes and parses human-facing price text into a number.
 *
 * - elementVisibleText(page, sel): Promise<string | null>
 *   Attempts to read visible text or common attributes from a DOM element
 *   matched by `sel`. Returns trimmed string or `null`.
 *
 * - fetchCartTotalFromCartPage(page, cartUrl): Promise<string | null>
 *   Fetches the `/cart` page HTML via `fetch` inside the page context and
 *   tries to parse a cart total using configured cart selectors or JSON-LD
 *   offers as a fallback.
 *
 * - robustAddToCart(page, trace): Promise<boolean>
 *   A progressive set of strategies to add an item to cart:
 *     1. Click visible add-to-cart buttons (`SELECTORS.actions.*`)
 *        - normal click, then programmatic dispatch of a MouseEvent
 *     2. Submit closest form programmatically (collects inputs and POSTs)
 *     3. Programmatic POSTs using product id / data attributes and common
 *        cart endpoints (e.g. `/cart/add.js`, `/cart/add`, `/cart`)
 *     4. Try opening cart drawer (`SELECTORS.cart.openDrawer`) and look inside
 *     5. Polling fallbacks to detect cart changes rendered asynchronously
 *
 * Selectors used (sourced from `SELECTORS` module)
 * - PDP price selectors: `SELECTORS.pdp.price`  (PDP_SELECTORS)
 * - Add-to-cart selectors: `SELECTORS.actions.addToCartButton`,
 *   `SELECTORS.actions.stickyAddToCart`  (ADD_TO_CART_SELECTORS)
 * - Cart price selectors: `SELECTORS.cart.price`  (CART_PRICE_SELECTORS)
 * - Cart item selector: `SELECTORS.cart.item`  (CART_ITEM_SELECTOR)
 * - Cart open/drawer selector: `SELECTORS.cart.openDrawer`  (CART_OPEN_SELECTOR)
 *
 * Tracing / TRACE events
 * - This worker records structured trace events (objects) into `trace: any[]`
 *   instead of plain strings so the dashboard can render a consistent table.
 *   Each trace event uses the shape:
 *     { step: string, status: 'INFO'|'ERROR'|'OK', ts: ISOString, message?: string, data?: any, bucket?: string }
 *
 * - Common `step` values produced by the worker (non-exhaustive):
 *     acquired_pool_context
 *     launched_local_browser
 *     new_page
 *     goto_error
 *     no_response
 *     loaded
 *     pdp_selector
 *     pdp_selector_err
 *     pdp_jsonld
 *     pdp_jsonld_err
 *     pdp_parsed
 *     no_add_selector
 *     add_click_success
 *     add_click_no_cartchange
 *     add_dispatch_success
 *     add_dispatch_no_cartchange
 *     add_click_err
 *     add_via_form
 *     add_via_form_no_cartchange
 *     no_form_found
 *     add_form_err
 *     add_programmatic_success
 *     add_programmatic_no_cart
 *     add_programmatic_err
 *     no_product_id_found
 *     productid_err
 *     cart_drawer_opened_and_detected
 *     cart_drawer_opened_no_price
 *     cart_open_selector_missing
 *     cart_open_err
 *     add_late_detected
 *     add_to_cart_failed_all_strategies
 *     added_to_cart
 *     cart_item_price_selector
 *     cart_selector
 *     fetch_cart
 *     cart_from_cart_page
 *     cart_parsed
 *     cart_fetch_err
 *     cart_read_err
 *     error
 *
 * - Example trace event:
 *     {
 *       step: 'pdp_parsed',
 *       status: 'INFO',
 *       ts: '2026-06-22T12:34:56.789Z',
 *       message: '799',
 *       data: { raw: '799 ₴' }
 *     }
 *
 * Behavior and return
 * - The worker tries to use a shared `pool` when provided; otherwise it launches
 *   a local headless `chromium` instance and closes it on completion.
 * - Final `CrawlResult` fields set:
 *     url, status ('OK'|'ERROR'), reason (string), selector (used PDP selector or null),
 *     detail ('added_to_cart' when added successfully), pdpPrice (number|null),
 *     cartPrice (number|null), match (boolean), screenshot (currently null),
 *     trace (array of structured events)
 *
 * Dashboard considerations
 * - Dashboard expects structured trace objects. Do not revert trace entries to
 *   plain strings. Add new trace steps via `pushTrace(trace, ...)` helper.
 *
 * Notes / maintenance
 * - Keep `SELECTORS` in sync with target site structure. If a site changes
 *   markup, adapt selector arrays in `selectors/selectors.ts`.
 * - `parsePrice` aims to be forgiving but may need adjustments for unusual
 *   localized formats.
 */
import type { CrawlResult } from '../types/CrawlResult';
import type { BrowserPoolInstance, PoolContext } from '../browser/browserPool';
import { chromium } from 'playwright';
import { SELECTORS } from '../selectors/selectors';

function parsePrice(text: string | null): number | null {
  if (!text) return null;
  const cleaned = text
    .replace(/\u00A0/g, ' ')
    .replace(/[^\d,.\-]/g, '')
    .replace(/,+(?=\d{3}\b)/g, '')
    .replace(',', '.')
    .match(/-?\d+(?:[.]\d+)?/);
  if (!cleaned) return null;
  const n = Number(cleaned[0]);
  return Number.isFinite(n) ? n : null;
}

async function elementVisibleText(
  page: any,
  sel: string,
): Promise<string | null> {
  try {
    const el = await page.$(sel);
    if (!el) return null;
    const txt = await el.evaluate((node: any) => {
      const v =
        (node.innerText && node.innerText.trim()) ||
        (node.textContent && node.textContent.trim()) ||
        (node.getAttribute &&
          (node.getAttribute('data-price') ||
            node.getAttribute('content') ||
            node.getAttribute('aria-label') ||
            node.getAttribute('title'))) ||
        null;
      return typeof v === 'string' && v.trim() ? v.trim() : null;
    });
    return typeof txt === 'string' ? txt : null;
  } catch {
    return null;
  }
}

const PDP_SELECTORS = SELECTORS.pdp.price || [];
const ADD_TO_CART_SELECTORS = [
  SELECTORS.actions.addToCartButton,
  SELECTORS.actions.stickyAddToCart,
].filter(Boolean) as string[];
const CART_PRICE_SELECTORS = SELECTORS.cart.price || [];
const CART_ITEM_SELECTOR = SELECTORS.cart.item || null;
const CART_OPEN_SELECTOR = SELECTORS.cart.openDrawer || null;

async function fetchCartTotalFromCartPage(
  page: any,
  cartUrl: string,
): Promise<string | null> {
  try {
    const html = await page.evaluate(
      async (arg: { url: string }) => {
        try {
          const r = await fetch(arg.url, {
            credentials: 'same-origin',
            cache: 'no-cache',
          });
          return r.ok ? await r.text() : null;
        } catch {
          return null;
        }
      },
      { url: cartUrl },
    );
    if (!html) return null;
    const txt = await page.evaluate(
      (arg: { h: string; selectors: string[] }) => {
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(arg.h, 'text/html');
          for (const s of arg.selectors) {
            try {
              const el = doc.querySelector(s);
              if (el) {
                const v = (el.textContent || '').trim();
                if (v) return v;
              }
            } catch {}
          }
          const scripts = Array.from(
            doc.querySelectorAll('script[type="application/ld+json"]'),
          );
          for (const s of scripts) {
            try {
              const j = JSON.parse(s.textContent || '{}');
              if (
                j &&
                j.offers &&
                (j.offers.price || j.offers.priceSpecification?.price)
              ) {
                return String(
                  j.offers.price || j.offers.priceSpecification?.price,
                );
              }
            } catch {}
          }
        } catch {}
        return null;
      },
      { h: html, selectors: CART_PRICE_SELECTORS },
    );
    return typeof txt === 'string' ? txt : null;
  } catch {
    return null;
  }
}

async function robustAddToCart(page: any, trace: any[]): Promise<boolean> {
  const knownCartPatterns = [
    '/cart',
    '/cart/add',
    '/cart/add.js',
    '/cart_items',
    'add-to-cart',
    'add_to_cart',
    '/basket',
  ];
  const clickTimeout = 4000;

  async function pollForCartPrice(retries = 8, delay = 400): Promise<boolean> {
    for (let i = 0; i < retries; i++) {
      try {
        if (CART_PRICE_SELECTORS.length) {
          const found = await page
            .$(CART_PRICE_SELECTORS.join(','))
            .catch(() => null);
          if (found) return true;
        }
        if (CART_ITEM_SELECTOR) {
          const item = await page.$(CART_ITEM_SELECTOR).catch(() => null);
          if (item) {
            const price = await item
              .$(CART_PRICE_SELECTORS.join(','))
              .catch(() => null);
            if (price) return true;
          }
        }
      } catch {}
      await page.waitForTimeout(delay).catch(() => {});
    }
    return false;
  }

  // Try clicking visible add-to-cart buttons with progressive strategies
  for (const sel of ADD_TO_CART_SELECTORS) {
    if (!sel) continue;
    try {
      const handle = await page.$(sel);
      if (!handle) {
        pushTrace(trace, 'no_add_selector', 'INFO', sel);
        continue;
      }

      // make visible and scroll
      await handle.evaluate((el: any) => {
        el.scrollIntoView({
          block: 'center',
          inline: 'center',
          behavior: 'instant',
        });
      });
      // try normal click
      const resp = page
        .waitForResponse(
          (r: any) => {
            const url = r.url();
            return knownCartPatterns.some((p) => url.includes(p));
          },
          { timeout: clickTimeout },
        )
        .catch(() => null);
      await Promise.all([handle.click().catch(() => {}), resp]);
      // short wait then poll
      await page.waitForTimeout(400).catch(() => {});
      if (await pollForCartPrice(6, 300)) {
        pushTrace(trace, 'add_click_success', 'INFO', sel);
        return true;
      }
      pushTrace(trace, 'add_click_no_cartchange', 'INFO', sel);

      // try dispatch click via evaluate if normal click didn't work
      const resp2 = page
        .waitForResponse(
          (r: any) => {
            const url = r.url();
            return knownCartPatterns.some((p) => url.includes(p));
          },
          { timeout: clickTimeout },
        )
        .catch(() => null);
      await page.evaluate((s: string) => {
        const el = document.querySelector(s) as HTMLElement | null;
        if (!el) return;
        const ev = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          composed: true,
        });
        el.dispatchEvent(ev);
      }, sel);
      await Promise.all([resp2, page.waitForTimeout(300)]);
      if (await pollForCartPrice(6, 300)) {
        pushTrace(trace, 'add_dispatch_success', 'INFO', sel);
        return true;
      }
      pushTrace(trace, 'add_dispatch_no_cartchange', 'INFO', sel);
    } catch (e: any) {
      pushTrace(trace, 'add_click_err', 'ERROR', String(e?.message ?? e), {
        selector: sel,
      });
    }
  }

  // Try submitting surrounding form programmatically
  try {
    const formData = await page.evaluate(() => {
      const btn = document.querySelector(
        '[data-testid="product-detail-add-to-cart"], button[type="submit"], input[type="submit"]',
      ) as HTMLElement | null;
      if (!btn) return null;
      const f = btn.closest('form') as HTMLFormElement | null;
      if (!f) return null;
      const action = f.action || location.pathname;
      const inputs: Record<string, string> = {};
      Array.from((f.elements || []) as any).forEach((el: any) => {
        try {
          if (el.name && !el.disabled) inputs[el.name] = el.value ?? '';
        } catch {}
      });
      return { action, inputs };
    });
    if (formData && formData.action) {
      await page.evaluate(
        async (arg: { action: string; inputs: Record<string, string> }) => {
          try {
            await fetch(arg.action, {
              method: 'POST',
              body: new URLSearchParams(arg.inputs),
              credentials: 'same-origin',
              headers: { 'X-Requested-With': 'XMLHttpRequest' },
            });
          } catch {}
        },
        { action: formData.action, inputs: formData.inputs },
      );
      await page.waitForTimeout(600).catch(() => {});
      if (await pollForCartPrice(8, 300)) {
        pushTrace(trace, 'add_via_form', 'INFO');
        return true;
      }
      pushTrace(trace, 'add_via_form_no_cartchange', 'INFO');
    } else {
      pushTrace(trace, 'no_form_found', 'INFO');
    }
  } catch (e: any) {
    pushTrace(trace, 'add_form_err', 'ERROR', String(e?.message ?? e));
  }

  // Try programmatic add using product id or data attributes
  try {
    const productId = await page.evaluate(() => {
      const scripts = Array.from(
        document.querySelectorAll('script[type="application/ld+json"]'),
      );
      for (const s of scripts) {
        try {
          const j = JSON.parse(s.textContent || '{}');
          if (
            j &&
            j.offers &&
            (j.offers.sku || j.offers.identifier || j.offers.productID)
          ) {
            return (
              j.offers.sku || j.offers.identifier || j.offers.productID || null
            );
          }
        } catch {}
      }
      const byAttr = document.querySelector(
        '[data-product-id], [data-id], input[name="id"]',
      ) as HTMLElement | null;
      if (byAttr) {
        return (
          (byAttr.getAttribute &&
            (byAttr.getAttribute('data-product-id') ||
              byAttr.getAttribute('data-id') ||
              (byAttr as HTMLInputElement).value)) ||
          null
        );
      }
      return null;
    });
    if (productId) {
      const tryEndpoints = ['/cart/add.js', '/cart/add', '/cart'];
      for (const ep of tryEndpoints) {
        try {
          await page.evaluate(
            async (arg: { endpoint: string; id: string }) => {
              try {
                const url = arg.endpoint.startsWith('http')
                  ? arg.endpoint
                  : arg.endpoint;
                if (arg.endpoint.endsWith('.js')) {
                  await fetch(url, {
                    method: 'POST',
                    body: JSON.stringify({ id: arg.id }),
                    credentials: 'same-origin',
                    headers: {
                      'Content-Type': 'application/json',
                      'X-Requested-With': 'XMLHttpRequest',
                    },
                  });
                } else {
                  await fetch(url, {
                    method: 'POST',
                    body: new URLSearchParams({ id: arg.id }),
                    credentials: 'same-origin',
                    headers: { 'X-Requested-With': 'XMLHttpRequest' },
                  });
                }
              } catch {}
            },
            { endpoint: ep, id: String(productId) },
          );
          await page.waitForTimeout(600).catch(() => {});
          if (await pollForCartPrice(8, 300)) {
            pushTrace(trace, 'add_programmatic_success', 'INFO', ep);
            return true;
          }
          pushTrace(trace, 'add_programmatic_no_cart', 'INFO', ep);
        } catch (e: any) {
          pushTrace(
            trace,
            'add_programmatic_err',
            'ERROR',
            String(e?.message ?? e),
            { endpoint: ep },
          );
        }
      }
    } else {
      pushTrace(trace, 'no_product_id_found', 'INFO');
    }
  } catch (e: any) {
    pushTrace(trace, 'productid_err', 'ERROR', String(e?.message ?? e));
  }

  // If cart drawer opening selector exists, try to open and read inside
  if (CART_OPEN_SELECTOR) {
    try {
      const openEl = await page.$(CART_OPEN_SELECTOR);
      if (openEl) {
        await openEl.click().catch(() => {});
        await page.waitForTimeout(400).catch(() => {});
        if (await pollForCartPrice(8, 300)) {
          pushTrace(trace, 'cart_drawer_opened_and_detected', 'INFO');
          return true;
        }
        pushTrace(trace, 'cart_drawer_opened_no_price', 'INFO');
      } else {
        pushTrace(trace, 'cart_open_selector_missing', 'INFO');
      }
    } catch (e: any) {
      pushTrace(trace, 'cart_open_err', 'ERROR', String(e?.message ?? e));
    }
  }

  // last resort: wait a bit and then return failure (caller will try /cart fetch)
  await page.waitForTimeout(1000).catch(() => {});
  if (await pollForCartPrice(12, 500)) {
    pushTrace(trace, 'add_late_detected', 'INFO');
    return true;
  }

  pushTrace(trace, 'add_to_cart_failed_all_strategies', 'ERROR');
  return false;
}

export async function crawlWorker(
  url: string,
  pool?: BrowserPoolInstance,
): Promise<CrawlResult> {
  const trace: any[] = [];
  let slot: PoolContext | null = null;
  let usedLocalBrowser = false;

  const base = {
    url,
    status: 'FAIL' as 'OK' | 'FAIL',
    reason: 'INIT' as string,
    selector: null as string | null,
    detail: null as string | null,
    pdpPrice: null as number | null,
    cartPrice: null as number | null,
    match: false,
    screenshot: null as string | null,
    trace,
  };

  try {
    if (pool) {
      slot = await pool.acquireContext();
      pushTrace(trace, 'acquired_pool_context', 'INFO');
    } else {
      usedLocalBrowser = true;
      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext();
      slot = { browser, context, _slotId: -1 } as unknown as PoolContext;
      pushTrace(trace, 'launched_local_browser', 'INFO');
    }

    const page = await slot.context.newPage();
    pushTrace(trace, 'new_page', 'INFO');

    const resp = await page
      .goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
      .catch((e) => {
        pushTrace(trace, 'goto_error', 'ERROR', String(e));
        return null;
      });
    if (!resp) {
      base.status = 'FAIL';
      base.reason = 'NAVIGATION_FAILED';
      pushTrace(trace, 'no_response', 'ERROR');
      return base as unknown as CrawlResult;
    }
    pushTrace(
      trace,
      'loaded',
      'INFO',
      String(
        typeof resp.status === 'function'
          ? resp.status()
          : (resp.status ?? 'unknown'),
      ),
    );

    // PDP price detection
    let pdpText: string | null = null;
    let usedSelector: string | null = null;
    for (const sel of PDP_SELECTORS) {
      try {
        pdpText = await elementVisibleText(page, sel);
        if (pdpText) {
          usedSelector = sel;
          pushTrace(trace, 'pdp_selector', 'INFO', sel);
          break;
        }
      } catch (e: any) {
        pushTrace(trace, 'pdp_selector_err', 'ERROR', String(e?.message ?? e), {
          selector: sel,
        });
      }
    }

    // JSON-LD fallback
    if (!pdpText) {
      try {
        const jsonLdPrice = await page.$$eval(
          'script[type="application/ld+json"]',
          (nodes: any[]) => {
            for (const n of nodes) {
              try {
                const j = JSON.parse(n.textContent || '{}');
                if (
                  j &&
                  j.offers &&
                  (j.offers.price || j.offers.priceSpecification?.price)
                ) {
                  return j.offers.price || j.offers.priceSpecification?.price;
                }
              } catch {}
            }
            return null;
          },
        );
        if (jsonLdPrice) {
          pdpText = String(jsonLdPrice).trim();
          pushTrace(trace, 'pdp_jsonld', 'INFO', String(jsonLdPrice));
        }
      } catch (e: any) {
        pushTrace(trace, 'pdp_jsonld_err', 'ERROR', String(e?.message ?? e));
      }
    }

    const pdpPrice = parsePrice(pdpText);
    pushTrace(trace, 'pdp_parsed', 'INFO', String(pdpPrice), { raw: pdpText });

    // try to add to cart
    const added = await robustAddToCart(page, trace);
    pushTrace(
      trace,
      'added_to_cart',
      added ? 'INFO' : 'ERROR',
      added ? 'true' : 'false',
    );

    // Try reading cart price in-page first
    let cartText: string | null = null;
    try {
      if (CART_ITEM_SELECTOR) {
        const item = await page.$(CART_ITEM_SELECTOR).catch(() => null);
        if (item) {
          for (const s of CART_PRICE_SELECTORS) {
            const pEl = await item.$(s).catch(() => null);
            if (pEl) {
              const txt = await pEl
                .evaluate((n: any) =>
                  (n.innerText || n.textContent || '').trim(),
                )
                .catch(() => null);
              if (txt) {
                cartText = txt;
                pushTrace(trace, 'cart_item_price_selector', 'INFO', s);
                break;
              }
            }
          }
        }
      }
      if (!cartText && CART_PRICE_SELECTORS.length) {
        for (const s of CART_PRICE_SELECTORS) {
          const txt = await elementVisibleText(page, s);
          if (txt) {
            cartText = txt;
            pushTrace(trace, 'cart_selector', 'INFO', s);
            break;
          }
        }
      }
    } catch (e: any) {
      pushTrace(trace, 'cart_read_err', 'ERROR', String(e?.message ?? e));
    }

    // Fallback: fetch /cart page and parse
    if (!cartText) {
      try {
        const cartUrl = new URL('/cart', url).toString();
        pushTrace(trace, 'fetch_cart', 'INFO', cartUrl);
        const fromCart = await fetchCartTotalFromCartPage(page, cartUrl);
        if (fromCart) {
          cartText = fromCart;
          pushTrace(trace, 'cart_from_cart_page', 'INFO', String(fromCart));
        }
      } catch (e: any) {
        pushTrace(trace, 'cart_fetch_err', 'ERROR', String(e?.message ?? e));
      }
    }

    const cartPrice = parsePrice(cartText);
    pushTrace(trace, 'cart_parsed', 'INFO', String(cartPrice), {
      raw: cartText,
    });

    const match =
      pdpPrice != null && cartPrice != null
        ? Math.abs(cartPrice - pdpPrice) < 0.01
        : false;

    base.status = 'FAIL';
    base.reason = 'INTERNAL_ERROR';
    base.selector = usedSelector;
    base.detail = added ? 'added_to_cart' : null;
    base.pdpPrice = pdpPrice;
    base.cartPrice = cartPrice;
    base.match = match;

    if (pdpPrice == null) {
      base.reason = 'MISSING_PRICE';
      base.detail = 'pdp';
      base.selector = usedSelector ?? PDP_SELECTORS[0] ?? null;
      pushTrace(trace, 'validation', 'ERROR', 'MISSING_PRICE', {
        detail: 'pdp',
      });
    } else if (!added) {
      base.reason = 'ADD_TO_CART_FAILED';
      base.detail = 'add_to_cart';
      pushTrace(trace, 'validation', 'ERROR', 'ADD_TO_CART_FAILED');
    } else if (cartPrice == null) {
      base.reason = 'MISSING_PRICE';
      base.detail = 'cart';
      base.selector = CART_PRICE_SELECTORS[0] ?? null;
      pushTrace(trace, 'validation', 'ERROR', 'MISSING_PRICE', {
        detail: 'cart',
      });
    } else if (!match) {
      base.reason = 'PRICE_MISMATCH';
      base.detail = 'cart';
      pushTrace(trace, 'validation', 'ERROR', 'PRICE_MISMATCH', {
        pdpPrice,
        cartPrice,
      });
    } else {
      base.status = 'OK';
      base.reason = 'OK';
      base.detail = 'added_to_cart';
      pushTrace(trace, 'validation', 'OK', 'OK');
    }

    return base as unknown as CrawlResult;
  } catch (err: any) {
    pushTrace(trace, 'error', 'ERROR', String(err?.message ?? err));
    base.status = 'FAIL';
    base.reason = 'CRAWL_FAILED';
    base.detail = String(err?.message ?? err);
    return base as unknown as CrawlResult;
  } finally {
    if (pool && slot) {
      await pool.releaseContext(slot).catch(() => {});
    } else if (slot && usedLocalBrowser) {
      await slot.context.close().catch(() => {});
      await slot.browser.close().catch(() => {});
    }
  }
}

export default crawlWorker;

/**
 * Helper: push structured trace event
 */
function pushTrace(
  trace: any[],
  step: string,
  status: 'INFO' | 'ERROR' | 'OK' = 'INFO',
  message?: string | null,
  data?: any,
  bucket?: string,
) {
  const ev: any = { step, status, ts: new Date().toISOString() };
  if (message !== undefined && message !== null) ev.message = message;
  if (data !== undefined) ev.data = data;
  if (bucket !== undefined) ev.bucket = bucket;
  trace.push(ev);
}
