import { afterEach, describe, expect, it, vi } from 'vitest';

const { fakeBrowser } = vi.hoisted(() => ({
  fakeBrowser: {
    newContext: vi.fn().mockImplementation(async () => ({
      close: vi.fn().mockResolvedValue(undefined),
    })),
    on: vi.fn(),
    removeListener: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue(fakeBrowser),
  },
}));

import { createBrowserPoolInstance } from '@crawler/browser/browserPool';

describe('browser pool waiters', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a timed-out waiter without producing an unhandled rejection', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);

    const pool = createBrowserPoolInstance(1, { waitTimeoutMs: 5 });

    try {
      await pool.init();
      const lease = await pool.acquireContext();
      const waiting = pool.acquireContext();

      await expect(waiting).rejects.toThrow('canceled');
      await new Promise((resolve) => setImmediate(resolve));

      expect(unhandled).not.toHaveBeenCalled();
      await pool.releaseContext(lease);
    } finally {
      process.off('unhandledRejection', unhandled);
      await pool.close();
    }
  });
});
