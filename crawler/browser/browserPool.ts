import { Browser, BrowserContext, chromium } from 'playwright';

export type PoolContext = {
  browser: Browser;
  context: BrowserContext;
  _slotId: number;
  leaseId: number;
};

export type BrowserPoolInstance = {
  init(): Promise<void>;
  acquireContext(): Promise<PoolContext>;
  releaseContext(ctx: PoolContext): Promise<void>;
  close(): Promise<void>;
};

export type BrowserPoolOptions = {
  waitTimeoutMs?: number;
  rotateAfterJobs?: number;
};

type Waiter = {
  resolve(value: PoolContext): void;
  reject(error: Error): void;
  timer: NodeJS.Timeout;
};

type Slot = {
  browser: Browser | null;
  leased: boolean;
  leaseId: number;
  disconnected: boolean;
  jobsServed: number;
};

export function createBrowserPoolInstance(
  size = 1,
  options: BrowserPoolOptions = {},
): BrowserPoolInstance {
  if (!Number.isInteger(size) || size < 1) {
    throw new Error('BrowserPool size must be a positive integer');
  }

  const waitTimeoutMs = options.waitTimeoutMs ?? 30_000;
  const configuredRotateAfter = Number(
    options.rotateAfterJobs ?? process.env.CRAWL_BROWSER_ROTATE_AFTER ?? 200,
  );
  const rotateAfterJobs =
    Number.isInteger(configuredRotateAfter) && configuredRotateAfter > 0
      ? configuredRotateAfter
      : 200;
  const slots: Slot[] = Array.from({ length: size }, () => ({
    browser: null,
    leased: false,
    leaseId: 0,
    disconnected: false,
    jobsServed: 0,
  }));
  const waiters: Waiter[] = [];
  let initialized = false;
  let closed = false;

  async function launch(slotId: number): Promise<Browser> {
    const browser = await chromium.launch({
      headless: true,
      args: ['--disable-dev-shm-usage', '--no-sandbox'],
    });
    const slot = slots[slotId];
    slot.browser = browser;
    slot.disconnected = false;
    browser.on('disconnected', () => {
      if (slot.browser !== browser) return;
      slot.browser = null;
      slot.disconnected = true;
      if (!slot.leased && !closed) void makeAvailable(slotId);
    });
    return browser;
  }

  async function ensureBrowser(slotId: number): Promise<Browser> {
    const slot = slots[slotId];
    if (slot.browser?.isConnected()) return slot.browser;
    return launch(slotId);
  }

  async function rotateBrowser(slotId: number): Promise<void> {
    const slot = slots[slotId];
    const previous = slot.browser;
    slot.browser = null;
    slot.disconnected = false;
    slot.jobsServed = 0;
    if (previous) await previous.close().catch(() => {});
    if (!closed) await launch(slotId);
  }

  async function createLease(slotId: number): Promise<PoolContext> {
    const slot = slots[slotId];
    slot.leased = true;
    try {
      const browser = await ensureBrowser(slotId);
      const context = await browser.newContext({
        locale: 'uk-UA',
        viewport: { width: 1280, height: 900 },
        userAgent:
          'Mozilla/5.0 (compatible; BestPriceCrawler/1.0; +https://bestprice.com.ua)',
      });
      slot.leaseId++;
      return { browser, context, _slotId: slotId, leaseId: slot.leaseId };
    } catch (error) {
      slot.leased = false;
      throw error;
    }
  }

  async function makeAvailable(slotId: number): Promise<void> {
    if (closed) return;
    const slot = slots[slotId];
    if (slot.leased) return;

    const waiter = waiters.shift();
    if (!waiter) return;
    clearTimeout(waiter.timer);

    try {
      waiter.resolve(await createLease(slotId));
    } catch (error) {
      waiter.reject(error instanceof Error ? error : new Error(String(error)));
      await makeAvailable(slotId);
    }
  }

  async function init(): Promise<void> {
    if (initialized) return;
    if (closed) throw new Error('BrowserPool is closed');
    initialized = true;
    await Promise.all(slots.map((_, index) => launch(index)));
  }

  async function acquireContext(): Promise<PoolContext> {
    if (!initialized) throw new Error('BrowserPool not initialized');
    if (closed) throw new Error('BrowserPool is closed');

    const slotId = slots.findIndex((slot) => !slot.leased);
    if (slotId >= 0) {
      return createLease(slotId);
    }

    return new Promise<PoolContext>((resolve, reject) => {
      const waiter = {} as Waiter;
      waiter.resolve = resolve;
      waiter.reject = reject;
      waiter.timer = setTimeout(() => {
        const index = waiters.indexOf(waiter);
        if (index >= 0) waiters.splice(index, 1);
        reject(new Error('BrowserPool acquire timeout'));
      }, waitTimeoutMs);
      waiters.push(waiter);
    });
  }

  async function releaseContext(ctx: PoolContext): Promise<void> {
    const slot = slots[ctx._slotId];
    await ctx.context.close().catch(() => {});
    if (!slot || slot.leaseId !== ctx.leaseId) return;

    slot.leased = false;
    if (closed) return;

    slot.jobsServed++;
    if (slot.jobsServed >= rotateAfterJobs) {
      await rotateBrowser(ctx._slotId).catch((error) => {
        console.error(
          `[BrowserPool] rotation failed for slot=${ctx._slotId}:`,
          error,
        );
      });
    } else if (slot.disconnected || !slot.browser?.isConnected()) {
      await ensureBrowser(ctx._slotId).catch((error) => {
        console.error(
          `[BrowserPool] relaunch failed for slot=${ctx._slotId}:`,
          error,
        );
      });
    }
    await makeAvailable(ctx._slotId);
  }

  async function close(): Promise<void> {
    if (closed) return;
    closed = true;

    for (const waiter of waiters.splice(0)) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error('BrowserPool shutdown'));
    }

    await Promise.all(
      slots.map(async (slot) => {
        const browser = slot.browser;
        slot.browser = null;
        if (browser) await browser.close().catch(() => {});
      }),
    );
  }

  return { init, acquireContext, releaseContext, close };
}

export function validateAsBrowserPool(
  obj: unknown,
): obj is BrowserPoolInstance {
  if (!obj || typeof obj !== 'object') return false;
  const pool = obj as Partial<BrowserPoolInstance>;
  return (
    typeof pool.init === 'function' &&
    typeof pool.acquireContext === 'function' &&
    typeof pool.releaseContext === 'function' &&
    typeof pool.close === 'function'
  );
}

export class BrowserPool implements BrowserPoolInstance {
  private readonly pool: BrowserPoolInstance;
  private readonly legacyLeases = new Map<Browser, PoolContext[]>();

  constructor(size = 2) {
    this.pool = createBrowserPoolInstance(size);
  }

  init(): Promise<void> {
    return this.pool.init();
  }

  acquireContext(): Promise<PoolContext> {
    return this.pool.acquireContext();
  }

  releaseContext(ctx: PoolContext): Promise<void> {
    return this.pool.releaseContext(ctx);
  }

  async acquire(): Promise<Browser> {
    const lease = await this.pool.acquireContext();
    const leases = this.legacyLeases.get(lease.browser) ?? [];
    leases.push(lease);
    this.legacyLeases.set(lease.browser, leases);
    return lease.browser;
  }

  release(browser: Browser): void {
    const leases = this.legacyLeases.get(browser);
    const lease = leases?.shift();
    if (!lease) return;
    if (leases && leases.length === 0) this.legacyLeases.delete(browser);
    void this.pool.releaseContext(lease);
  }

  close(): Promise<void> {
    this.legacyLeases.clear();
    return this.pool.close();
  }
}
