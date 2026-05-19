/**
 * RETRY POLICY TESTS
 *
 * Verifies:
 * - retries are executed
 * - failures are propagated
 * - eventual success works
 */

import { describe, it, expect } from 'vitest';

import { retry } from '@crawler/retry/retry';

describe('retry', () => {
  it('should eventually succeed', async () => {
    let attempts = 0;

    const result = await retry(
      async () => {
        attempts++;

        if (attempts < 3) {
          throw new Error('temporary failure');
        }

        return 'success';
      },
      {
        retries: 3,
        delay: 10,
      },
    );

    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });

  it('should fail after max retries', async () => {
    let attempts = 0;

    await expect(
      retry(
        async () => {
          attempts++;

          throw new Error('always failing');
        },
        {
          retries: 2,
          delay: 10,
        },
      ),
    ).rejects.toThrow('always failing');

    expect(attempts).toBe(3);
  });
});
