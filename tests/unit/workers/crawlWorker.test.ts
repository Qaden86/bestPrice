import { describe, expect, it, vi } from 'vitest';

import type {
  BrowserPoolInstance,
  PoolContext,
} from '@crawler/browser/browserPool';
import { crawlWorker } from '@crawler/workers/crawlWorker';

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
});
