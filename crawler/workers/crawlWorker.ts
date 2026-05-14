/**
 * CRAWL WORKER
 *
 * Responsible for processing a single URL task.
 *
 * Each worker:
 * - takes a task
 * - creates a page
 * - runs crawl pipeline
 */

import { Browser } from 'playwright';
import { crawl } from '../crawl';

export async function crawlWorker(params: { browser: Browser; url: string }) {
  const { browser, url } = params;

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const result = await crawl(page, url);
    await context.close();

    return result;
  } catch (e: any) {
    await context.close();

    return {
      url,
      status: 'ERROR',
      reason: e.message,
    };
  }
}
