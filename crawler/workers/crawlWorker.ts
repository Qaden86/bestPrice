import { chromium } from 'playwright';

import type { BrowserPoolInstance, PoolContext } from '../browser/browserPool';
import { crawl, shutdownCrawlResult } from '../crawl';
import { isShuttingDown, isShutdownError } from '../engine/shutdown';
import type { CrawlResult } from '../types/CrawlResult';

const DEFAULT_JOB_TIMEOUT_MS = 120_000;

class CrawlTimeoutError extends Error {}

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

  try {
    if (pool) {
      lease = await pool.acquireContext();
    } else {
      local = true;
      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext();
      lease = { browser, context, _slotId: -1, leaseId: 1 };
    }

    const timeoutMs = jobTimeoutMs();
    const page = await lease.context.newPage();
    return await runWithDeadline(crawl(page, url), timeoutMs, () => {
      timedOut = true;
      void lease?.context.close().catch(() => {});
    });
  } catch (error) {
    if (isShuttingDown() || isShutdownError(error)) {
      return shutdownCrawlResult(url);
    }

    const message = timedOut
      ? error instanceof Error
        ? error.message
        : `Crawl exceeded ${jobTimeoutMs()}ms`
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
    if (pool && lease) {
      await pool.releaseContext(lease).catch(() => {});
    } else if (local && lease) {
      await lease.context.close().catch(() => {});
      await lease.browser.close().catch(() => {});
    }
  }
}

export function runWithDeadline<T>(
  operation: Promise<T>,
  timeoutMs: number,
  onTimeout: () => void,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      onTimeout();
      reject(new CrawlTimeoutError(`Crawl exceeded ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([operation, deadline]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export default crawlWorker;
