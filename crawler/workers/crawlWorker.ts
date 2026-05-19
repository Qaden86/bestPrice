import { BrowserContext } from 'playwright';

import { BrowserPool } from '../browser/browserPool';
import { crawl, shutdownCrawlResult } from '../crawl';
import { CrawlResult } from '../types/CrawlResult';
import { isShuttingDown, isShutdownError } from '../engine/shutdown';

function normalizeUrl(input: string | { url: string }): string {
  if (typeof input === 'string') return input;
  if (input?.url) return input.url;
  return 'unknown';
}

export async function crawlWorker(
  inputUrl: string | { url: string },
  pool: BrowserPool,
): Promise<CrawlResult> {
  const url = normalizeUrl(inputUrl);

  if (isShuttingDown()) {
    return shutdownCrawlResult(url);
  }

  const browser = await pool.acquire();
  let context: BrowserContext | null = null;

  try {
    if (isShuttingDown()) {
      return shutdownCrawlResult(url);
    }

    context = await browser.newContext({
      locale: 'uk-UA',
      viewport: { width: 1280, height: 900 },
      userAgent:
        'Mozilla/5.0 (compatible; BestPriceCrawler/1.0; +https://bestprice.com.ua)',
    });

    const page = await context.newPage();
    return await crawl(page, url);
  } catch (e: unknown) {
    if (isShutdownError(e) || isShuttingDown()) {
      return shutdownCrawlResult(url);
    }

    const message = e instanceof Error ? e.message : String(e);
    console.error('[WORKER ERROR]', url, message);

    return {
      url,
      pdpPrice: null,
      cartPrice: null,
      match: false,
      status: 'FAIL',
      reason: 'CRAWL_FAILED',
      trace: [
        {
          step: 'worker',
          status: 'ERROR',
          message,
          ts: Date.now(),
        },
      ],
    };
  } finally {
    if (context) {
      await context.close().catch(() => {});
    }
    pool.release(browser);
  }
}
