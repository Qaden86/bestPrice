import { chromium } from 'playwright';

import type { BrowserPoolInstance, PoolContext } from '../browser/browserPool';
import { crawl, shutdownCrawlResult } from '../crawl';
import { isShuttingDown, isShutdownError } from '../engine/shutdown';
import type { CrawlResult } from '../types/CrawlResult';

const DEFAULT_JOB_TIMEOUT_MS = 120_000;

function jobTimeoutMs(): number {
  const parsed = Number(process.env.CRAWL_JOB_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed >= 30_000
    ? Math.floor(parsed)
    : DEFAULT_JOB_TIMEOUT_MS;
}

export async function crawlWorker(
  url: string,
  pool?: BrowserPoolInstance,
): Promise<CrawlResult> {
  if (isShuttingDown()) return shutdownCrawlResult(url);

  let lease: PoolContext | null = null;
  let local = false;
  let timedOut = false;
  let timeout: NodeJS.Timeout | undefined;

  try {
    if (pool) {
      lease = await pool.acquireContext();
    } else {
      local = true;
      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext();
      lease = { browser, context, _slotId: -1, leaseId: 1 };
    }

    timeout = setTimeout(() => {
      timedOut = true;
      void lease?.context.close().catch(() => {});
    }, jobTimeoutMs());

    const page = await lease.context.newPage();
    return await crawl(page, url);
  } catch (error) {
    if (isShuttingDown() || isShutdownError(error)) {
      return shutdownCrawlResult(url);
    }

    const message = timedOut
      ? `Crawl exceeded ${jobTimeoutMs()}ms`
      : error instanceof Error
        ? error.message
        : String(error);

    return {
      url,
      pdpPrice: null,
      cartPrice: null,
      match: false,
      status: 'FAIL',
      reason: timedOut ? 'INTERNAL_ERROR' : 'CRAWL_FAILED',
      detail: message,
      trace: [
        {
          step: 'worker',
          status: 'ERROR',
          message,
          bucket: 'INFRA_FAILURE',
          ts: Date.now(),
        },
      ],
    };
  } finally {
    if (timeout) clearTimeout(timeout);

    if (pool && lease) {
      await pool.releaseContext(lease).catch(() => {});
    } else if (local && lease) {
      await lease.context.close().catch(() => {});
      await lease.browser.close().catch(() => {});
    }
  }
}

export default crawlWorker;
