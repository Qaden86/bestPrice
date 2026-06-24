/**
 * This scheduler is optimized for single-node crawling (~10k URLs).
 * It is NOT designed for distributed frontier coordination.
 *
 * Fault Tolerance Model:
 * - Tasks are leased to workers. If a worker crashes silently (process kill, OOM, unhandled rejection),
 *   the task might get stuck in LEASED state forever.
 * - To mitigate this, we use a "lease timeout watchdog" (reviveStuckLeases).
 *
 * Design rule:
 * - NO background timers inside scheduler.
 * - All state transitions are driven by engine loop.
 */

import {
  createBrowserPoolInstance,
  validateAsBrowserPool,
} from '../browser/browserPool';
import crawlWorker from '../workers/crawlWorker';
import { upsertResult, flushResults } from '../output/resultStore';
import { isShuttingDown, requestShutdown } from './shutdown';
import type { CrawlReason, CrawlResult } from '../types/CrawlResult';

/* ---------------- CONFIG ---------------- */

const BUCKET_MS = 1000;
const LEASE_TIMEOUT_MS = 60_000;
const MAX_ATTEMPTS = 3;

const RETRYABLE_REASONS: ReadonlySet<CrawlReason> = new Set<CrawlReason>([
  'NAVIGATION_FAILED',
  'CART_NOT_READY',
  'CRAWL_FAILED',
  'INTERNAL_ERROR',
]);

function isRetryable(result: CrawlResult): boolean {
  if (result.status === 'OK') return false;
  if (result.reason === 'SHUTDOWN') return false;
  return RETRYABLE_REASONS.has(result.reason);
}

/* ---------------- TYPES ---------------- */

enum State {
  READY = 'READY',
  LEASED = 'LEASED',
  DONE = 'DONE',
  DEAD = 'DEAD',
}

type Task = {
  url: string;
  attempts: number;
  nextRunAt: number;
  leasedAt?: number;
  state: State;
  bucket: number;
  inBucket?: number;
};

/* ---------------- SCHEDULER ---------------- */

class SchedulerV421 {
  private tasks = new Map<string, Task>();
  private buckets = new Map<number, Set<string>>();

  private readyCount = 0;
  private leasedCount = 0;
  private doneCount = 0;
  private deadCount = 0;

  constructor(urls: string[]) {
    for (const url of urls) this.add(url);
  }

  /* ---------------- TIME ---------------- */

  private now() {
    return Date.now();
  }

  private bucketOf(ts: number) {
    return Math.floor(ts / BUCKET_MS);
  }

  /* ---------------- BUCKET OPS ---------------- */

  private bucketAdd(bucket: number, url: string) {
    let set = this.buckets.get(bucket);
    if (!set) {
      set = new Set();
      this.buckets.set(bucket, set);
    }
    set.add(url);
  }

  private bucketRemove(bucket: number, url: string) {
    const set = this.buckets.get(bucket);
    if (!set) return;
    set.delete(url);
    if (set.size === 0) this.buckets.delete(bucket);
  }

  /* ---------------- TASK CREATE ---------------- */

  private add(url: string, delay = 0) {
    const now = this.now();

    const t: Task = {
      url,
      attempts: 0,
      nextRunAt: now + delay,
      state: State.READY,
      bucket: this.bucketOf(now + delay),
    };

    t.inBucket = t.bucket;

    this.tasks.set(url, t);
    this.bucketAdd(t.bucket, url);

    this.readyCount++;
  }

  /* ---------------- WATCHDOG (MANUAL TICK) ---------------- */

  tickWatchdog(now: number) {
    for (const [url, t] of this.tasks.entries()) {
      if (t.state !== State.LEASED || !t.leasedAt) continue;
      if (now - t.leasedAt <= LEASE_TIMEOUT_MS) continue;

      this.bucketRemove(t.inBucket!, url);
      t.inBucket = undefined;

      t.attempts++;

      if (t.attempts >= MAX_ATTEMPTS) {
        t.state = State.DEAD;
        this.leasedCount--;
        this.deadCount++;
        continue;
      }

      const delay = 1000 * Math.pow(2, t.attempts);
      t.nextRunAt = now + delay;
      t.bucket = this.bucketOf(t.nextRunAt);
      t.state = State.READY;

      this.leasedCount--;
      this.readyCount++;

      this.bucketAdd(t.bucket, url);
      t.inBucket = t.bucket;
    }
  }

  /* ---------------- GET NEXT ---------------- */

  getNext(): string | null {
    const now = this.now();
    const currentBucket = this.bucketOf(now);
    const dueBuckets = Array.from(this.buckets.keys())
      .filter((bucket) => bucket <= currentBucket)
      .sort((a, b) => a - b);

    for (const bucket of dueBuckets) {
      const set = this.buckets.get(bucket);
      if (!set) continue;

      for (const url of set) {
        const t = this.tasks.get(url);
        if (!t) continue;
        if (t.state !== State.READY) continue;
        if (t.nextRunAt > now) continue;

        set.delete(url);
        if (set.size === 0) this.buckets.delete(bucket);
        t.inBucket = undefined;

        t.state = State.LEASED;
        t.leasedAt = now;

        this.readyCount--;
        this.leasedCount++;

        return url;
      }

      if (set.size === 0) this.buckets.delete(bucket);
    }

    return null;
  }

  /* ---------------- RETRY ---------------- */

  private scheduleRetry(url: string): void {
    const t = this.tasks.get(url);
    if (!t) return;

    if (t.inBucket !== undefined) {
      this.bucketRemove(t.inBucket, url);
    }

    const now = this.now();
    const delay = 1000 * Math.pow(2, t.attempts);

    t.nextRunAt = now + delay;
    t.bucket = this.bucketOf(t.nextRunAt);
    t.state = State.READY;

    this.bucketAdd(t.bucket, url);
    t.inBucket = t.bucket;

    this.readyCount++;
  }

  /* ---------------- COMPLETE ---------------- */

  complete(url: string, ok: boolean, retryable: boolean): boolean {
    const t = this.tasks.get(url);
    if (!t || t.state !== State.LEASED) return true;

    this.leasedCount--;
    t.attempts++;

    if (ok) {
      t.state = State.DONE;
      this.doneCount++;
      return true;
    }

    if (retryable && t.attempts < MAX_ATTEMPTS && !isShuttingDown()) {
      this.scheduleRetry(url);
      return false;
    }

    t.state = State.DEAD;
    this.deadCount++;
    return true;
  }

  isIdle(): boolean {
    return this.readyCount === 0 && this.leasedCount === 0;
  }

  stats() {
    return {
      ready: this.readyCount,
      leased: this.leasedCount,
      done: this.doneCount,
      dead: this.deadCount,
    };
  }
}

/* ---------------- ENGINE ---------------- */

export async function runConcurrentEngine(params: {
  urls: (string | { url: string })[];
  concurrency: number;
}) {
  const urls = params.urls.map((u) => (typeof u === 'string' ? u : u.url));

  const pool = await createBrowserPoolInstance(params.concurrency);
  if (!validateAsBrowserPool(pool)) throw new Error('Invalid pool');
  if (pool.init) await pool.init();

  const scheduler = new SchedulerV421(urls);

  const workers = Array.from({ length: params.concurrency }, async () => {
    while (!isShuttingDown()) {
      scheduler.tickWatchdog(Date.now());

      const url = scheduler.getNext();

      if (!url) {
        if (scheduler.isIdle()) return;
        await new Promise((r) => setTimeout(r, 25));
        continue;
      }

      let result: CrawlResult;

      try {
        result = await crawlWorker(url, pool);
      } catch (e) {
        result = {
          url,
          pdpPrice: null,
          cartPrice: null,
          match: false,
          status: 'FAIL',
          reason: 'CRAWL_FAILED',
          trace: [
            {
              step: 'error',
              status: 'ERROR',
              message: String(e),
              ts: Date.now(),
            },
          ],
        };
      }

      const finalResult = scheduler.complete(
        url,
        result.status === 'OK',
        isRetryable(result),
      );

      if (finalResult) {
        upsertResult(result);
      }
    }
  });

  try {
    await Promise.all(workers);
    await flushResults();
  } finally {
    if (pool.close) await pool.close();
  }
}

export function installShutdownHandlers(): void {
  const onSignal = () => {
    if (isShuttingDown()) return;
    console.log('\n[SHUTDOWN] stopping workers...');
    requestShutdown();
  };

  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
}
