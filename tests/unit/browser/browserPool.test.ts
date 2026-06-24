import { afterEach, describe, expect, it, vi } from 'vitest';

const { fakeBrowser, launch } = vi.hoisted(() => ({
  fakeBrowser: {
    newContext: vi.fn().mockImplementation(async () => ({
      close: vi.fn().mockResolvedValue(undefined),
    })),
    isConnected: vi.fn().mockReturnValue(true),
    on: vi.fn(),
    removeListener: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  },
  launch: vi.fn(),
}));

vi.mock('playwright', () => ({
  chromium: {
    launch: launch.mockResolvedValue(fakeBrowser),
  },
}));

import { createBrowserPoolInstance } from '@crawler/browser/browserPool';

describe('browser pool waiters', () => {
  afterEach(() => {
    vi.clearAllMocks();
    fakeBrowser.isConnected.mockReturnValue(true);
    fakeBrowser.newContext.mockImplementation(async () => ({
      close: vi.fn().mockResolvedValue(undefined),
    }));
  });

  it('rejects a timed-out waiter without producing an unhandled rejection', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);

    const pool = createBrowserPoolInstance(1, { waitTimeoutMs: 5 });

    try {
      await pool.init();
      const lease = await pool.acquireContext();
      const waiting = pool.acquireContext();

      await expect(waiting).rejects.toThrow('BrowserPool acquire timeout');
      await new Promise((resolve) => setImmediate(resolve));

      expect(unhandled).not.toHaveBeenCalled();
      await pool.releaseContext(lease);
    } finally {
      process.off('unhandledRejection', unhandled);
      await pool.close();
    }
  });

  it('reserves a slot before asynchronous context creation completes', async () => {
    let resolveContext!: (value: { close: () => Promise<void> }) => void;
    fakeBrowser.newContext.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveContext = resolve;
        }),
    );
    const pool = createBrowserPoolInstance(1, { waitTimeoutMs: 10 });

    try {
      await pool.init();
      const first = pool.acquireContext();
      const second = pool.acquireContext();

      await expect(second).rejects.toThrow('BrowserPool acquire timeout');
      resolveContext({ close: vi.fn().mockResolvedValue(undefined) });
      await pool.releaseContext(await first);
    } finally {
      await pool.close();
    }
  });

  it('hands a freed slot to a queued waiter after context creation fails', async () => {
    fakeBrowser.newContext
      .mockRejectedValueOnce(new Error('context failed'))
      .mockResolvedValueOnce({
        close: vi.fn().mockResolvedValue(undefined),
      });
    const pool = createBrowserPoolInstance(1, { waitTimeoutMs: 250 });

    try {
      await pool.init();
      const failed = pool.acquireContext();
      const waiting = pool.acquireContext();

      await expect(failed).rejects.toThrow('context failed');
      await expect(waiting).resolves.toMatchObject({
        browser: fakeBrowser,
      });
      const lease = await waiting;

      expect(lease.browser).toBe(fakeBrowser);
      expect(fakeBrowser.newContext).toHaveBeenCalledTimes(2);
      await pool.releaseContext(lease);
    } finally {
      await pool.close();
    }
  });

  it('frees the slot after context creation fails without waiters', async () => {
    fakeBrowser.newContext
      .mockRejectedValueOnce(new Error('context failed'))
      .mockResolvedValueOnce({
        close: vi.fn().mockResolvedValue(undefined),
      });
    const pool = createBrowserPoolInstance(1, { waitTimeoutMs: 100 });

    try {
      await pool.init();

      await expect(pool.acquireContext()).rejects.toThrow('context failed');
      const lease = await pool.acquireContext();

      expect(lease.browser).toBe(fakeBrowser);
      expect(fakeBrowser.newContext).toHaveBeenCalledTimes(2);
      await pool.releaseContext(lease);
    } finally {
      await pool.close();
    }
  });

  it('rotates a browser after the configured number of completed jobs', async () => {
    const replacementBrowser = {
      ...fakeBrowser,
      newContext: vi.fn().mockResolvedValue({
        close: vi.fn().mockResolvedValue(undefined),
      }),
      isConnected: vi.fn().mockReturnValue(true),
      on: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    };
    launch
      .mockResolvedValueOnce(fakeBrowser)
      .mockResolvedValueOnce(replacementBrowser);
    const pool = createBrowserPoolInstance(1, {
      waitTimeoutMs: 10,
      rotateAfterJobs: 1,
    });

    try {
      await pool.init();
      const lease = await pool.acquireContext();
      const waiting = pool.acquireContext();
      await pool.releaseContext(lease);
      const nextLease = await waiting;

      expect(fakeBrowser.close).toHaveBeenCalledOnce();
      expect(launch).toHaveBeenCalledTimes(2);
      expect(nextLease.browser).toBe(replacementBrowser);
      await pool.releaseContext(nextLease);
    } finally {
      await pool.close();
    }
  });

  it('closes launched browsers and allows retry after partial init failure', async () => {
    launch
      .mockResolvedValueOnce(fakeBrowser)
      .mockRejectedValueOnce(new Error('launch failed'))
      .mockResolvedValue(fakeBrowser);
    const pool = createBrowserPoolInstance(2);

    try {
      await expect(pool.init()).rejects.toThrow('launch failed');
      expect(fakeBrowser.close).toHaveBeenCalledOnce();

      await expect(pool.init()).resolves.toBeUndefined();
      expect(launch).toHaveBeenCalledTimes(4);
    } finally {
      await pool.close();
    }
  });
});
