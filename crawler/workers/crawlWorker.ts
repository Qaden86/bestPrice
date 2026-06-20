import { BrowserContext } from 'playwright';

import { BrowserPool } from '../browser/browserPool';
import {
  createCrawlContext,
  parseBrowserRotateAfter,
} from '../browser/crawlContext';
import { crawl, shutdownCrawlResult } from '../crawl';
import { CrawlResult } from '../types/CrawlResult';
import { isShuttingDown, isShutdownError } from '../engine/shutdown';

function normalizeUrl(input: string | { url: string }): string {
  if (typeof input === 'string') return input;
  if (input?.url) return input.url;
  return 'unknown';
}

export async function crawlUrlInContext(
  context: BrowserContext,
  url: string,
): Promise<CrawlResult> {
  if (isShuttingDown()) {
    return shutdownCrawlResult(url);
  }

  let page;

  try {
    page = await context.newPage();
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
  } catch (e: unknown) {
    if (isShutdownError(e) || isShuttingDown()) {
      return shutdownCrawlResult(url);
    }

    const message = e instanceof Error ? e.message : 'CRAWL_FAILED';
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
    if (page) {
      await page.close().catch(() => {});
    }
    await context.clearCookies().catch(() => {});
  }
}

export type WorkerSession = {
  crawl: (inputUrl: string | { url: string }) => Promise<CrawlResult>;
};

/**
 * Reused browser + context per worker; new page per URL.
 * Rotates browser/context after CRAWL_BROWSER_ROTATE_AFTER jobs.
 */
export async function runWorkerSession(
  pool: BrowserPool,
  work: (session: WorkerSession) => Promise<void>,
): Promise<void> {
  const rotateAfter = parseBrowserRotateAfter();
  let browser = await pool.acquire();
  let context = await createCrawlContext(browser);
  let jobsOnSession = 0;

  const session: WorkerSession = {
    crawl: async (inputUrl) => {
      const url = normalizeUrl(inputUrl);

      if (jobsOnSession >= rotateAfter) {
        await context.close().catch(() => {});
        context = await createCrawlContext(browser);
        jobsOnSession = 0;
      }

      const result = await crawlUrlInContext(context, url);
      jobsOnSession++;
      return result;
    },
  };

  try {
    await work(session);
  } finally {
    await context.close().catch(() => {});
    pool.release(browser);
  }
}
