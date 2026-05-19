/**
 * BrowserPool
 *
 * Reuses browser instances only.
 * Contexts are intentionally NOT reused.
 *
 * This provides:
 * - stable isolation
 * - predictable Playwright lifecycle
 * - safe ecommerce crawling
 */

import { chromium, Browser } from 'playwright';

type PooledBrowser = {
  browser: Browser;
  inUse: boolean;
};

export class BrowserPool {
  private pool: PooledBrowser[] = [];
  private waiters: ((browser: Browser) => void)[] = [];

  constructor(private size = 2) {}

  /**
   * Initialize browser pool
   */
  async init() {
    for (let i = 0; i < this.size; i++) {
      const browser = await chromium.launch({
        headless: true,
      });

      this.pool.push({
        browser,
        inUse: false,
      });
    }
  }

  /**
   * Acquire browser instance
   */
  async acquire(): Promise<Browser> {
    const available = this.pool.find((b) => !b.inUse);

    if (available) {
      available.inUse = true;
      return available.browser;
    }

    /**
     * Wait until browser becomes available
     */
    return new Promise((resolve) => {
      this.waiters.push(resolve);
    });
  }

  /**
   * Release browser to pool
   */
  release(browser: Browser) {
    const item = this.pool.find((b) => b.browser === browser);

    if (!item) return;

    /**
     * Pass browser directly to next waiter
     */
    const waiter = this.waiters.shift();

    if (waiter) {
      waiter(browser);
      return;
    }

    item.inUse = false;
  }

  /**
   * Graceful shutdown
   */
  async close() {
    for (const item of this.pool) {
      await item.browser.close();
    }

    this.pool = [];
    this.waiters = [];
  }
}