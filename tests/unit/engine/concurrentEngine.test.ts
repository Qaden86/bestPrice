import { describe, expect, it, vi } from 'vitest';

import { normalizeUrls, SchedulerV421 } from '@crawler/engine/concurrentEngine';

describe('SchedulerV421 lease ownership', () => {
  it('ignores a stale completion after the watchdog re-leases a URL', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-24T12:00:00.000Z'));

    try {
      const scheduler = new SchedulerV421(['https://example.test/product']);
      const firstLease = scheduler.getNext();
      expect(firstLease).not.toBeNull();

      vi.advanceTimersByTime(150_001);
      scheduler.tickWatchdog(Date.now());

      vi.advanceTimersByTime(2_000);
      const secondLease = scheduler.getNext();
      expect(secondLease).not.toBeNull();
      expect(secondLease!.leaseId).toBeGreaterThan(firstLease!.leaseId);

      expect(
        scheduler.complete(firstLease!.url, firstLease!.leaseId, true, false),
      ).toBe(false);
      expect(scheduler.stats()).toMatchObject({ leased: 1, done: 0 });

      expect(
        scheduler.complete(secondLease!.url, secondLease!.leaseId, true, false),
      ).toBe(true);
      expect(scheduler.stats()).toMatchObject({ leased: 0, done: 1 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('deduplicates repeated URLs without corrupting ready counts', () => {
    const scheduler = new SchedulerV421([
      'https://example.test/product',
      'https://example.test/product',
    ]);

    const lease = scheduler.getNext();
    expect(lease).not.toBeNull();
    expect(scheduler.getNext()).toBeNull();
    expect(scheduler.complete(lease!.url, lease!.leaseId, true, false)).toBe(
      true,
    );
    expect(scheduler.isIdle()).toBe(true);
  });

  it('surfaces a terminal failure when watchdog retries are exhausted', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-24T12:00:00.000Z'));

    try {
      const scheduler = new SchedulerV421(['https://example.test/product']);

      for (let attempt = 1; attempt <= 3; attempt++) {
        expect(scheduler.getNext()).not.toBeNull();
        vi.advanceTimersByTime(150_001);
        const results = scheduler.tickWatchdog(Date.now());

        if (attempt < 3) {
          expect(results).toEqual([]);
          vi.advanceTimersByTime(1000 * 2 ** attempt);
        } else {
          expect(results).toHaveLength(1);
          expect(results[0]).toMatchObject({
            url: 'https://example.test/product',
            status: 'FAIL',
            reason: 'INTERNAL_ERROR',
            detail: 'Lease expired after 3 attempts',
          });
        }
      }

      expect(scheduler.stats()).toMatchObject({ leased: 0, dead: 1 });
      expect(scheduler.isIdle()).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('normalizes duplicate URL inputs before progress totals are calculated', () => {
    expect(
      normalizeUrls([
        'https://example.test/product',
        { url: 'https://example.test/product' },
        'https://example.test/other',
      ]),
    ).toEqual(['https://example.test/product', 'https://example.test/other']);
  });
});
