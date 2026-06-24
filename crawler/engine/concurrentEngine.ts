/**
 * This scheduler is optimized for single-node crawling (~10k URLs).
 * It is NOT designed for distributed frontier coordination.
 */

import { createBrowserPoolInstance, validateAsBrowserPool } from '../browser/browserPool';
import crawlWorker from '../workers/crawlWorker';
import { upsertResult, flushResults } from '../output/resultStore';
import type { CrawlResult } from '../types/CrawlResult';

/* ---------------- CONFIG ---------------- */

const BUCKET_MS = 1000;
const LEASE_MS = 120_000;
const MAX_ATTEMPTS = 3;

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
  leaseUntil: number;
  state: State;
  bucket: number;
};

/* ---------------- SCHEDULER ---------------- */

class SchedulerV421 {
  private tasks = new Map<string, Task>();

  // time buckets
  private buckets = new Map<number, Set<string>>();

  // deterministic counters (single source of truth)
  private readyCount = 0;
  private leasedCount = 0;
  private doneCount = 0;
  private deadCount = 0;

  constructor(urls: string[]) {
    for (const url of urls) {
      this.add(url);
    }
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

    if (set.size === 0) {
      this.buckets.delete(bucket);
    }
  }

  /* ---------------- TASK CREATE ---------------- */

  private add(url: string, delay = 0) {
    const now = this.now();

    const t: Task = {
      url,
      attempts: 0,
      nextRunAt: now + delay,
      leaseUntil: 0,
      state: State.READY,
      bucket: 0,
    };

    const bucket = this.bucketOf(t.nextRunAt);
    t.bucket = bucket;

    this.tasks.set(url, t);
    this.bucketAdd(bucket, url);

    this.readyCount++;
  }

  /* ---------------- LEASE REVIVAL (SAFE, NO OVERCOUNT) ---------------- */

  private revive(now: number) {
    const currentBucket = this.bucketOf(now);

    // check neighboring buckets to avoid boundary misses
    for (let b = currentBucket - 1; b <= currentBucket + 1; b++) {
      const set = this.buckets.get(b);
      if (!set) continue;

      for (const url of set) {
        const t = this.tasks.get(url);
        if (!t) continue;

        if (
          t.state === State.LEASED &&
          t.leaseUntil > 0 &&
          t.leaseUntil <= now
        ) {
          t.state = State.READY;
          t.nextRunAt = now;

          this.leasedCount--;
          this.readyCount++;
        }
      }
    }
  }

  /* ---------------- GET NEXT ---------------- */

  getNext(): string | null {
    const now = this.now();

    this.revive(now);

    const bucket = this.bucketOf(now);
    const set = this.buckets.get(bucket);

    if (!set) return null;

    for (const url of set) {
      const t = this.tasks.get(url);
      if (!t) continue;

      // race safety
      if (t.state !== State.READY) continue;
      if (t.nextRunAt > now) continue;

      // remove from bucket ONLY if still valid
      set.delete(url);

      t.state = State.LEASED;
      t.leaseUntil = now + LEASE_MS;

      this.readyCount--;
      this.leasedCount++;

      return url;
    }

    return null;
  }

  /* ---------------- RETRY ---------------- */

  scheduleRetry(url: string): boolean {
    const t = this.tasks.get(url);
    if (!t) return false;

    if (t.attempts >= MAX_ATTEMPTS) {
      if (t.state !== State.DEAD) {
        t.state = State.DEAD;
        this.deadCount++;
      }
      return false;
    }

    // remove old bucket safely
    this.bucketRemove(t.bucket, url);

    t.attempts++;

    const delay = 1000 * Math.pow(2, t.attempts);
    const now = this.now();

    t.nextRunAt = now + delay;
    t.bucket = this.bucketOf(t.nextRunAt);
    t.state = State.READY;

    this.bucketAdd(t.bucket, url);

    this.readyCount++;

    return true;
  }

  /* ---------------- COMPLETE (SINGLE SOURCE OF TRUTH) ---------------- */

  complete(url: string, ok: boolean) {
    const t = this.tasks.get(url);
    if (!t) return;

    if (t.state !== State.LEASED) return;

    this.leasedCount--;

    if (ok) {
      t.state = State.DONE;
      this.doneCount++;
      return;
    }

    // scheduler owns retry transitions
    this.scheduleRetry(url);
  }

  /* ---------------- IDLE ---------------- */

  isIdle(): boolean {
    return this.readyCount === 0 && this.leasedCount === 0;
  }

  /* ---------------- STATS (safe snapshot) ---------------- */

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
  const urls = params.urls.map(u => (typeof u === 'string' ? u : u.url));

  const pool = await createBrowserPoolInstance(params.concurrency);
  if (!validateAsBrowserPool(pool)) throw new Error('Invalid pool');
  if (pool.init) await pool.init();

  const scheduler = new SchedulerV421(urls);

  const workers = Array.from({ length: params.concurrency }, async () => {
    while (true) {
      const url = scheduler.getNext();

      if (!url) {
        if (scheduler.isIdle()) return;
        await new Promise(r => setTimeout(r, 25));
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

      const ok = result.status === 'OK';

      scheduler.complete(url, ok);

      if (ok) {
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