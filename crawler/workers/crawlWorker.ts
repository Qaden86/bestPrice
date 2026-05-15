import { chromium } from 'playwright';
import { crawl } from '../crawl';
import { CrawlResult } from '../types/CrawlResult';

/**
 * WORKER LAYER
 *
 * Responsibilities:
 * - browser lifecycle management
 * - isolation per crawl
 * - error containment (NO silent failures)
 */
export async function crawlWorker(url: string): Promise<CrawlResult> {
  const browser = await chromium.launch({
    headless: true,
  });

  try {
    const page = await browser.newPage();

    const result = await crawl(page, url);

    /**
     * SAFETY GUARD:
     * ensure crawler never returns undefined/null
     */
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
    /**
     * HARD FAILURE PROTECTION:
     * ensures CI always gets deterministic output
     */
    return {
      url,
      pdpPrice: null,
      cartPrice: null,
      match: false,
      status: 'FAIL',
      reason: 'CRAWL_FAILED',
      trace: [],
    };
  } finally {
    await browser.close();
  }
}
