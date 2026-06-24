import { describe, expect, it, vi } from 'vitest';

import { SchedulerV421 } from '@crawler/engine/concurrentEngine';

describe('SchedulerV421 lease ownership', () => {
  it('ignores a stale completion after the watchdog re-leases a URL', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-24T12:00:00.000Z'));

    try {
      const scheduler = new SchedulerV421(['https://example.test/product']);
      const firstLease = scheduler.getNext();
      expect(firstLease).not.toBeNull();

      vi.advanceTimersByTime(60_001);
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
});
