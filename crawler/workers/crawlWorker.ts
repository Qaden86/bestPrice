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
 */
export async function crawlWorker(
  inputUrl: string | { url: string },
  pool: BrowserPool,
): Promise<CrawlResult> {
  const url = normalizeUrl(inputUrl);

  const browser = await pool.acquire();

  /**
   * Fresh isolated context per job
   */
  const context = await browser.newContext();

  try {
    const page = await context.newPage();

    const result = await crawl(page, url);

    if (!result) {
      return {
        url,
        pdpPrice: null,
        cartPrice: null,
        match: false,
        status: 'FAIL',
        reason: 'CRAWL_FAILED',
        trace: [],
      };
    }

    return result;
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
    /**
     * Dispose isolated session
     */
    await context.close();

    pool.release(browser);
  }
}