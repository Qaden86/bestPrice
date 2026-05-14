import { chromium } from 'playwright';

import { SmartQueue } from '../queue/smartQueue';
import { Backpressure } from '../queue/backpressure';
import { crawlWorker } from '../workers/crawlWorker';

import type { CrawlResult } from '../types/result';

/**
 * CONCURRENT ENGINE
 * - runs crawler in parallel
 * - normalizes output structure
 */
export async function runConcurrentEngine(params: {
  urls: any[];
  concurrency: number;
}): Promise<CrawlResult[]> {
  const queue = new SmartQueue(params.urls.map((u) => u.url));
  const backpressure = new Backpressure(params.concurrency);

  const browser = await chromium.launch({ headless: true });

  const results: CrawlResult[] = [];

  async function workerLoop(workerId: number) {
    while (queue.hasPending()) {
      if (!backpressure.canProcess()) {
        await new Promise((r) => setTimeout(r, 100));
        continue;
      }

      const task = queue.getNext();
      if (!task) break;

      backpressure.acquire();
      queue.markProcessing(task);

      console.log(`[Worker ${workerId}]`, task.url);

      try {
        const raw = await crawlWorker({
          browser,
          url: task.url,
        });

        /**
         * NORMALIZATION LAYER
         */
        const match = raw.pdpPrice === raw.cartPrice;

        const result: CrawlResult = {
          url: task.url,

          pdpPrice: raw.pdpPrice ?? null,
          cartPrice: raw.cartPrice ?? null,

          match,
          reason: match ? 'OK' : 'PRICE_MISMATCH',

          status: match ? 'OK' : 'FAIL',
        };

        queue.markSuccess(task);
        results.push(result);
      } catch (e: any) {
        queue.markFailed(task, e.message);

        const failResult: CrawlResult = {
          url: task.url,
          pdpPrice: null,
          cartPrice: null,
          match: false,
          reason: e.message,
          status: 'FAIL',
        };

        results.push(failResult);

        console.log(`[Worker ${workerId}] FAILED`, task.url, e.message);
      } finally {
        backpressure.release();
      }
    }
  }

  await Promise.all(
    Array.from({ length: params.concurrency }, (_, i) => workerLoop(i)),
  );

  await browser.close();

  console.log('[QUEUE STATS]', queue.getStats());

  return results;
}
