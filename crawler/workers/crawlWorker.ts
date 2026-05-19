import { BrowserContext } from 'playwright';

import { BrowserPool } from '../browser/browserPool';
import { crawl } from '../crawl';
import { CrawlResult } from '../types/CrawlResult';

/**
 * Normalize URL input into strict string format.
 */
function normalizeUrl(input: string | { url: string }): string {
  if (typeof input === 'string') {
    return input;
  }

  if (input && typeof input.url === 'string') {
    return input.url;
  }

  return 'unknown';
}

/**
 * Single crawl execution unit
 *
 * IMPORTANT:
 * - browsers are reused
 * - contexts are NOT reused
 * - each job gets isolated clean session
 *
 * `newContext` lives inside the try block so a throw there still releases
 * the browser back to the pool — otherwise the pool drains and deadlocks
 * at `concurrency=N` after N failures.
 */
export async function crawlWorker(
  inputUrl: string | { url: string },
  pool: BrowserPool,
): Promise<CrawlResult> {
  const url = normalizeUrl(inputUrl);

  const browser = await pool.acquire();
  let context: BrowserContext | null = null;

  try {
    context = await browser.newContext({
      locale: 'uk-UA',
      viewport: { width: 1280, height: 900 },
      userAgent:
        'Mozilla/5.0 (compatible; BestPriceCrawler/1.0; +https://bestprice.com.ua)',
    });

    const page = await context.newPage();
    const result = await crawl(page, url);

    return (
      result ?? {
        url,
        pdpPrice: null,
        cartPrice: null,
        match: false,
        status: 'FAIL',
        reason: 'CRAWL_FAILED',
        trace: [],
      }
    );
  } catch (e: any) {
    console.error('[WORKER ERROR]', url, e);

    return {
      url,
      pdpPrice: null,
      cartPrice: null,
      match: false,
      status: 'FAIL',
      reason: e?.message || 'CRAWL_FAILED',
      trace: [
        {
          step: 'worker',
          status: 'ERROR',
          message: e?.message || 'UNKNOWN_ERROR',
          ts: Date.now(),
        },
      ],
    };
  } finally {
    if (context) {
      await context.close().catch(() => {
        /* best-effort */
      });
    }
    pool.release(browser);
  }
}
