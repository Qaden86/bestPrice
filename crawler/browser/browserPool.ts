/**
 * BrowserPool
 *
 * Reuses browser instances only.
 * Contexts are intentionally NOT reused.
 *
 * See README for env-driven defaults: CRAWL_BROWSER_POOL_SIZE, CRAWL_BROWSER_ROTATE_AFTER
 */

import { chromium, Browser, BrowserContext } from 'playwright';

export type AcquireContextResult = {
  context: BrowserContext;
  browser: Browser;
  release: () => Promise<void>;
};

type Waiter = {
  resolve: (b: Browser) => void;
  reject: (err: Error) => void;
};

type PooledBrowser = {
  id: number;
  browser: Browser;
  inUse: boolean;
  jobsServed: number;
  rotating: boolean;
};

const DEFAULT_ROTATE_AFTER = 200;

/* parseRotateAfter / parsePoolSize helpers */
function parseRotateAfter(): number {
  const raw = process.env.CRAWL_BROWSER_ROTATE_AFTER;
  if (!raw) return DEFAULT_ROTATE_AFTER;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_ROTATE_AFTER;
}
function parsePoolSize(): number {
  const raw = process.env.CRAWL_BROWSER_POOL_SIZE;
  if (!raw) return 2;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 2;
}

export class BrowserPool {
  private pool: PooledBrowser[] = [];
  private waiters: Waiter[] = [];
  private readonly rotateAfter = parseRotateAfter();
  private closed = false;
  private nextId = 1;

  constructor(private size = parsePoolSize()) {}

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
      this.pool.push({
        id: this.nextId++,
        browser,
        inUse: false,
        jobsServed: 0,
        rotating: false,
      });
    }
    console.info(`[browserPool] initialized ${this.pool.length} browsers (rotateAfter=${this.rotateAfter})`);
  }

  /**
   * Acquire browser instance (keeps existing API for compatibility)
   * Rejects if the pool has been closed.
   */
  async acquire(): Promise<Browser> {
    if (this.closed) throw new Error('browser pool closed');

    // find a ready non-rotating slot
    const available = this.pool.find((b) => !b.inUse && !b.rotating);

    if (available) {
      available.inUse = true;
      console.debug(`[browserPool] acquire -> slot ${available.id} (jobsServed=${available.jobsServed})`);
      return available.browser;
    }

    // otherwise enqueue waiter and return a promise that resolves on handOff
    return new Promise<Browser>((resolve, reject) => {
      const waiter: Waiter = { resolve, reject };
      this.waiters.push(waiter);
      // If the pool is closed before we get a handoff, reject later in close()
    });
  }

  /**
   * Acquire a fresh BrowserContext for a job.
   * Returns typed result and an idempotent release() that closes the context
   * and returns the browser to the pool (best-effort).
   */
  async acquireContext(): Promise<AcquireContextResult> {
    if (this.closed) throw new Error('browser pool closed');

    const browser = await this.acquire();
    const context = await browser.newContext();

    let released = false;
    const release = async (): Promise<void> => {
      if (released) return;
      released = true;
      try {
        await context.close();
      } catch (e) {
        console.warn('[browserPool] context.close() failed (continuing to release browser):', e);
      }
      // always attempt to return the browser to the pool
      try {
        this.release(browser);
      } catch (e) {
        console.error('[browserPool] release() failed while returning browser to pool:', e);
      }
    };

    return { context, browser, release };
  }

  /**
   * Release browser to pool.
   * Rotation decision is made here; rotation is atomic per-slot via the `rotating` flag.
   */
  release(browser: Browser): void {
    const item = this.pool.find((b) => b.browser === browser);
    if (!item) {
      console.warn('[browserPool] release() unknown browser (ignoring)');
      return;
    }

    item.jobsServed++;
    console.debug(`[browserPool] release -> slot ${item.id} (jobsServed=${item.jobsServed})`);

    // If rotation threshold reached and not already rotating, schedule rotate()
    if (item.jobsServed >= this.rotateAfter && !item.rotating) {
      item.rotating = true;
      // schedule rotate but don't block release
      void this.rotate(item).catch((e) => {
        console.error(`[browserPool] rotate(slot=${item.id}) failed:`, e);
      });
      return;
    }

    // Normal handoff: give the slot back to waiter or mark free
    this.handOff(item);
  }

  /**
   * Atomically rotate the given pool slot: close + relaunch.
   * If relaunch fails, removes the slot from the pool (best-effort).
   */
  private async rotate(item: PooledBrowser): Promise<void> {
    console.info(`[browserPool] rotate START slot=${item.id} (jobsServed=${item.jobsServed})`);
    try {
      await item.browser.close();
    } catch (e) {
      console.warn(`[browserPool] rotate: failed to close browser slot=${item.id}:`, e);
    }

    if (this.closed) {
      // pool shutting down, don't relaunch; remove slot and reject any pending waiter(s)
      const idx = this.pool.indexOf(item);
      if (idx !== -1) this.pool.splice(idx, 1);
      item.rotating = false;
      console.info(`[browserPool] rotate: pool closed, removed slot=${item.id}`);
      return;
    }

    try {
      const newBrowser = await this.launch();
      item.browser = newBrowser;
      item.jobsServed = 0;
      item.rotating = false;
      console.info(`[browserPool] rotate DONE slot=${item.id}`);
      this.handOff(item);
    } catch (e) {
      console.error(`[browserPool] failed to relaunch browser for slot=${item.id}`, e);
      // remove the slot to avoid a broken slot; hand off will consider other slots / waiters
      const idx = this.pool.indexOf(item);
      if (idx !== -1) this.pool.splice(idx, 1);
      item.rotating = false;
      // attempt to hand off remaining waiters with other slots
      this.handOffFromRemovedSlot();
    }
  }

  /**
   * Hand off browser to next waiter or mark the slot available.
   */
  private handOff(item: PooledBrowser): void {
    // Give the browser to the oldest waiter if any
    const waiter = this.waiters.shift();
    if (waiter) {
      try {
        waiter.resolve(item.browser);
        // slot remains inUse (consumer will set inUse = true when they acquire)
        // we mark the slot as inUse to reflect it's now assigned
        item.inUse = true;
        console.debug(`[browserPool] handed slot ${item.id} to waiter`);
        return;
      } catch (e) {
        // in case resolve throws, try next waiter
        console.error(`[browserPool] error while resolving waiter for slot=${item.id}:`, e);
      }
    }
    // no waiters: mark slot free (if not rotating)
    item.inUse = false;
  }

  /**
   * Called when a slot was removed (failed rotate). Try to satisfy waiters with remaining slots.
   */
  private handOffFromRemovedSlot(): void {
    // Attempt to satisfy waiters with any available browser
    while (this.waiters.length > 0) {
      const available = this.pool.find((b) => !b.inUse && !b.rotating);
      const waiter = this.waiters.shift();
      if (!waiter) break;
      if (!available) {
        // put the waiter back and break
        this.waiters.unshift(waiter);
        break;
      }
      try {
        available.inUse = true;
        waiter.resolve(available.browser);
        console.debug(`[browserPool] handOffFromRemovedSlot -> gave slot ${available.id} to waiter`);
      } catch (e) {
        waiter.reject(new Error('failed to hand off browser'));
      }
    }
  }

  /**
   * Graceful shutdown: mark closed, reject waiters, close browsers.
   */
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;

    // reject all pending waiters
    for (const w of this.waiters) {
      try {
        w.reject(new Error('browser pool closed'));
      } catch {
        /* ignore */
      }
    }
    this.waiters = [];

    // close all browsers (wait for each)
    for (const item of this.pool) {
      try {
        await item.browser.close();
        console.info(`[browserPool] closed slot=${item.id}`);
      } catch (e) {
        console.warn(`[browserPool] error closing slot=${item.id}:`, e);
      }
    }

    this.pool = [];
  }
}
