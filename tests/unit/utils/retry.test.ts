import { describe, it, expect, vi } from 'vitest';
import { retry } from '@crawler/retry/retry';

const DEFAULT_DELAY = 10;

/**
 * Creates a function that fails N times before succeeding.
 */
function createFailThenSuccess(failTimes: number) {
  let calls = 0;

  return vi.fn(() => {
    calls++;

    if (calls <= failTimes) {
      return Promise.reject(new Error(`fail-${calls}`));
    }

    return Promise.resolve('success');
  });
}

/**
 * Creates a function that always fails.
 */
function createAlwaysFail() {
  return vi.fn(() => {
    return Promise.reject(new Error('always-fail'));
  });
}

describe('retry', () => {
  it('returns result immediately on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');

    const result = await retry(fn, {
      retries: 3,
      delay: DEFAULT_DELAY,
    });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries until function succeeds', async () => {
    const fn = createFailThenSuccess(2);

    const result = await retry(fn, {
      retries: 5,
      delay: DEFAULT_DELAY,
    });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws after exhausting all retries', async () => {
    const fn = createAlwaysFail();

    await expect(
      retry(fn, {
        retries: 2,
        delay: DEFAULT_DELAY,
      }),
    ).rejects.toThrow('always-fail');

    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it('respects retry contract (total attempts = retries + 1)', async () => {
    const fn = createAlwaysFail();

    try {
      await retry(fn, {
        retries: 4,
        delay: DEFAULT_DELAY,
      });
    } catch (e) {
      // expected
    }

    expect(fn).toHaveBeenCalledTimes(5);
  });

  it('does not mutate or leak state between retries', async () => {
    const fn = createFailThenSuccess(1);

    const result = await retry(fn, {
      retries: 3,
      delay: DEFAULT_DELAY,
    });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);

    // sanity check: retry should not call extra times
    expect(fn.mock.calls.length).toBe(2);
  });
});