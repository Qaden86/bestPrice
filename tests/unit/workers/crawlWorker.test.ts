import { describe, expect, it, vi } from 'vitest';

import type {
  BrowserPoolInstance,
  PoolContext,
} from '@crawler/browser/browserPool';
import { crawlWorker, runWithDeadline } from '@crawler/workers/crawlWorker';

describe('crawlWorker cleanup', () => {
  it('releases its pooled context when navigation fails', async () => {
    const page = {
      goto: vi.fn().mockRejectedValue(new Error('navigation failed')),
    };
    const context = {
      newPage: vi.fn().mockResolvedValue(page),
    };
    const slot = {
      browser: {},
      context,
      _slotId: 0,
      leaseId: 1,
    } as unknown as PoolContext;
    const pool = {
      init: vi.fn(),
      acquireContext: vi.fn().mockResolvedValue(slot),
      releaseContext: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
    } satisfies BrowserPoolInstance;

    const result = await crawlWorker('https://example.test/product', pool);

    expect(result.status).toBe('FAIL');
    expect(result.reason).toBe('NAVIGATION_FAILED');
    expect(pool.releaseContext).toHaveBeenCalledOnce();
    expect(pool.releaseContext).toHaveBeenCalledWith(slot);
  });

  it('rejects on the deadline even when the operation never settles', async () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();

    try {
      const pending = runWithDeadline(
        new Promise<never>(() => {}),
        100,
        onTimeout,
      );
      const assertion = expect(pending).rejects.toThrow('Crawl exceeded 100ms');

      vi.advanceTimersByTime(100);

      await assertion;
      expect(onTimeout).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('times out a never-settling newPage and releases the pool lease', async () => {
    vi.useFakeTimers();
    const context = {
      newPage: vi.fn().mockReturnValue(new Promise(() => {})),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const slot = {
      browser: {},
      context,
      _slotId: 0,
      leaseId: 1,
    } as unknown as PoolContext;
    const pool = poolWithLease(slot);

    try {
      const resultPromise = crawlWorker('https://example.test/product', pool);
      await vi.waitFor(() => expect(context.newPage).toHaveBeenCalledOnce());
      vi.advanceTimersByTime(120_000);
      const result = await resultPromise;

      expect(result).toMatchObject({
        status: 'FAIL',
        reason: 'INTERNAL_ERROR',
        detail: 'Crawl exceeded 120000ms',
      });
      expect(context.close).toHaveBeenCalled();
      expect(pool.releaseContext).toHaveBeenCalledWith(slot);
    } finally {
      vi.useRealTimers();
    }
  });

  it('releases a pool lease that arrives after the deadline', async () => {
    vi.useFakeTimers();
    let resolveAcquire!: (lease: PoolContext) => void;
    const acquire = new Promise<PoolContext>((resolve) => {
      resolveAcquire = resolve;
    });
    const slot = {
      browser: {},
      context: {
        newPage: vi.fn(),
        close: vi.fn().mockResolvedValue(undefined),
      },
      _slotId: 0,
      leaseId: 1,
    } as unknown as PoolContext;
    const pool = {
      init: vi.fn(),
      acquireContext: vi.fn().mockReturnValue(acquire),
      releaseContext: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
    } satisfies BrowserPoolInstance;

    try {
      const resultPromise = crawlWorker('https://example.test/product', pool);
      vi.advanceTimersByTime(120_000);
      await expect(resultPromise).resolves.toMatchObject({
        status: 'FAIL',
        reason: 'INTERNAL_ERROR',
      });

      resolveAcquire(slot);
      await vi.waitFor(() => {
        expect(pool.releaseContext).toHaveBeenCalledWith(slot);
      });
      expect(slot.context.newPage).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

function poolWithLease(lease: PoolContext) {
  return {
    init: vi.fn(),
    acquireContext: vi.fn().mockResolvedValue(lease),
    releaseContext: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(),
  } satisfies BrowserPoolInstance;
}
