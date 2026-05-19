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
 *
 * Each browser is periodically rotated (close + relaunch) to bound
 * Playwright's per-browser Node-side bookkeeping (CDP channel state,
 * frame/network tracking) which otherwise grows monotonically and OOMs
 * Node on long crawls. Tune with CRAWL_BROWSER_ROTATE_AFTER.
 */

import { chromium, Browser } from 'playwright';

type PooledBrowser = {
  browser: Browser;
  inUse: boolean;
  jobsServed: number;
};

const DEFAULT_ROTATE_AFTER = 200;

function parseRotateAfter(): number {
  const raw = process.env.CRAWL_BROWSER_ROTATE_AFTER;
  if (!raw) return DEFAULT_ROTATE_AFTER;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_ROTATE_AFTER;
}

export class BrowserPool {
  private pool: PooledBrowser[] = [];
  private waiters: ((browser: Browser) => void)[] = [];
  private readonly rotateAfter = parseRotateAfter();

  constructor(private size = 2) {}

  private launch(): Promise<Browser> {
    return chromium.launch({
      headless: true,
      args: ['--disable-dev-shm-usage', '--no-sandbox'],
    });
  }

  /**
   * Initialize browser pool
   */
  async init(): Promise<void> {
    for (let i = 0; i < this.size; i++) {
      const browser = await this.launch();
      this.pool.push({ browser, inUse: false, jobsServed: 0 });
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

    return new Promise((resolve) => {
      this.waiters.push(resolve);
    });
  }

  /**
   * Release browser to pool. Synchronous by design — rotation runs in the
   * background and holds the slot reserved until the replacement is ready.
   */
  release(browser: Browser): void {
    const item = this.pool.find((b) => b.browser === browser);
    if (!item) return;

    item.jobsServed++;

    if (item.jobsServed >= this.rotateAfter) {
      void this.rotate(item);
      return;
    }

    this.handOff(item);
  }

  private async rotate(item: PooledBrowser): Promise<void> {
    try {
      await item.browser.close();
    } catch {
      /* best-effort */
    }

    try {
      item.browser = await this.launch();
      item.jobsServed = 0;
      this.handOff(item);
    } catch (e) {
      console.error('[browserPool] failed to relaunch browser', e);
      const idx = this.pool.indexOf(item);
      if (idx !== -1) this.pool.splice(idx, 1);
    }
  }

  private handOff(item: PooledBrowser): void {
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter(item.browser);
      return;
    }
    item.inUse = false;
  }

  /**
   * Graceful shutdown
   */
  async close(): Promise<void> {
    for (const item of this.pool) {
      try {
        await item.browser.close();
      } catch {
        /* best-effort */
      }
    }
    this.pool = [];
    this.waiters = [];
  }
}
