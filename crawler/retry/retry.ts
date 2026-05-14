/**
 * RETRY POLICY
 *
 * Generic reusable retry utility.
 *
 * Architecture goals:
 * - reusable
 * - deterministic
 * - framework-agnostic
 * - observable
 */

type RetryOptions = {
  /**
   * Number of retry attempts AFTER initial execution.
   *
   * retries: 2
   * means:
   * - 1 initial attempt
   * - 2 retries
   * = 3 total attempts
   */
  retries: number;

  /**
   * Delay between attempts in milliseconds.
   */
  delay: number;
};

export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  let lastError: any;

  const totalAttempts = options.retries + 1;

  for (let attempt = 1; attempt <= totalAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;

      // Stop if this was the final attempt
      if (attempt >= totalAttempts) {
        break;
      }

      // Wait before next retry
      await new Promise((r) => setTimeout(r, options.delay));
    }
  }

  throw lastError;
}
